// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title NFTLaunchpad
 * @notice NFT drop platform with multiple sale mechanics
 * @dev Supports whitelists, dutch auctions, and reveal mechanics
 */
contract NFTLaunchpad is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10%

    // ============ Enums ============

    enum DropType {
        FIXED_PRICE,
        DUTCH_AUCTION,
        ALLOWLIST_ONLY,
        FREE_CLAIM
    }

    enum DropStatus {
        CREATED,
        ALLOWLIST_ACTIVE,
        PUBLIC_ACTIVE,
        ENDED,
        REVEALED
    }

    // ============ Structs ============

    struct Drop {
        uint256 dropId;
        address creator;
        address nftContract;
        DropType dropType;
        DropStatus status;
        uint256 maxSupply;
        uint256 minted;
        uint256 price;
        uint256 startPrice; // For Dutch auction
        uint256 endPrice;
        uint256 priceDecrement;
        uint256 decrementInterval;
        uint256 maxPerWallet;
        uint256 maxPerTx;
        uint256 allowlistStart;
        uint256 publicStart;
        uint256 endTime;
        bytes32 allowlistRoot;
        string baseURI;
        string unrevealedURI;
        bool revealed;
        uint256 royaltyBps;
        address royaltyReceiver;
        uint256 platformFeeBps;
    }

    struct MintRecord {
        uint256 count;
        uint256 totalPaid;
        uint256[] tokenIds;
    }

    // ============ State Variables ============

    mapping(uint256 => Drop) public drops;
    uint256 public dropCount;

    // Mint records: dropId => user => record
    mapping(uint256 => mapping(address => MintRecord)) public mintRecords;

    // Treasury
    address public treasury;
    uint256 public defaultPlatformFee;

    // ============ Events ============

    event DropCreated(
        uint256 indexed dropId,
        address indexed creator,
        address nftContract,
        uint256 maxSupply
    );

    event Minted(
        uint256 indexed dropId,
        address indexed minter,
        uint256 quantity,
        uint256 totalPaid
    );

    event DropRevealed(uint256 indexed dropId, string baseURI);

    event DropStatusChanged(uint256 indexed dropId, DropStatus status);

    // ============ Errors ============

    error InvalidDrop();
    error DropNotActive();
    error MaxSupplyReached();
    error MaxPerWalletReached();
    error MaxPerTxReached();
    error NotAllowlisted();
    error InsufficientPayment();
    error AlreadyRevealed();
    error Unauthorized();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _treasury
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        treasury = _treasury;
        defaultPlatformFee = 250; // 2.5%
    }

    // ============ Drop Creation ============

    /**
     * @notice Create a new NFT drop
     */
    function createDrop(
        address nftContract,
        DropType dropType,
        uint256 maxSupply,
        uint256 price,
        uint256 startPrice,
        uint256 endPrice,
        uint256 priceDecrement,
        uint256 decrementInterval,
        uint256 maxPerWallet,
        uint256 maxPerTx,
        uint256 allowlistStart,
        uint256 publicStart,
        uint256 endTime,
        bytes32 allowlistRoot,
        string calldata unrevealedURI,
        uint256 royaltyBps,
        address royaltyReceiver
    ) external returns (uint256 dropId) {
        require(maxSupply > 0, "Invalid supply");
        require(endTime > block.timestamp, "Invalid end time");

        dropId = ++dropCount;

        drops[dropId] = Drop({
            dropId: dropId,
            creator: msg.sender,
            nftContract: nftContract,
            dropType: dropType,
            status: DropStatus.CREATED,
            maxSupply: maxSupply,
            minted: 0,
            price: price,
            startPrice: startPrice,
            endPrice: endPrice,
            priceDecrement: priceDecrement,
            decrementInterval: decrementInterval,
            maxPerWallet: maxPerWallet,
            maxPerTx: maxPerTx,
            allowlistStart: allowlistStart,
            publicStart: publicStart,
            endTime: endTime,
            allowlistRoot: allowlistRoot,
            baseURI: "",
            unrevealedURI: unrevealedURI,
            revealed: false,
            royaltyBps: royaltyBps,
            royaltyReceiver: royaltyReceiver,
            platformFeeBps: defaultPlatformFee
        });

        emit DropCreated(dropId, msg.sender, nftContract, maxSupply);
    }

    // ============ Minting ============

    /**
     * @notice Mint NFTs from a drop
     */
    function mint(
        uint256 dropId,
        uint256 quantity,
        bytes32[] calldata proof
    ) external payable nonReentrant {
        Drop storage drop = drops[dropId];
        if (drop.dropId == 0) revert InvalidDrop();

        _updateDropStatus(drop);

        // Check active
        bool isAllowlist = drop.status == DropStatus.ALLOWLIST_ACTIVE;
        bool isPublic = drop.status == DropStatus.PUBLIC_ACTIVE;
        if (!isAllowlist && !isPublic) revert DropNotActive();

        // Allowlist check
        if (isAllowlist && drop.allowlistRoot != bytes32(0)) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            if (!MerkleProof.verify(proof, drop.allowlistRoot, leaf)) {
                revert NotAllowlisted();
            }
        }

        // Limits
        MintRecord storage record = mintRecords[dropId][msg.sender];
        if (drop.minted + quantity > drop.maxSupply) revert MaxSupplyReached();
        if (record.count + quantity > drop.maxPerWallet)
            revert MaxPerWalletReached();
        if (quantity > drop.maxPerTx) revert MaxPerTxReached();

        // Price
        uint256 totalPrice = _getCurrentPrice(drop) * quantity;
        if (msg.value < totalPrice) revert InsufficientPayment();

        // Mint (assumes NFT contract has mint function)
        uint256[] memory tokenIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = drop.minted + i + 1;
            tokenIds[i] = tokenId;

            // Call NFT contract mint
            (bool success, ) = drop.nftContract.call(
                abi.encodeWithSignature(
                    "mint(address,uint256)",
                    msg.sender,
                    tokenId
                )
            );
            require(success, "Mint failed");
        }

        // Update state
        drop.minted += quantity;
        record.count += quantity;
        record.totalPaid += totalPrice;

        for (uint256 i = 0; i < quantity; i++) {
            record.tokenIds.push(tokenIds[i]);
        }

        // Refund excess
        if (msg.value > totalPrice) {
            (bool refunded, ) = msg.sender.call{value: msg.value - totalPrice}(
                ""
            );
            require(refunded, "Refund failed");
        }

        emit Minted(dropId, msg.sender, quantity, totalPrice);
    }

    // ============ Creator Functions ============

    /**
     * @notice Reveal the NFT collection
     */
    function reveal(uint256 dropId, string calldata baseURI) external {
        Drop storage drop = drops[dropId];
        if (msg.sender != drop.creator && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        if (drop.revealed) revert AlreadyRevealed();

        drop.baseURI = baseURI;
        drop.revealed = true;
        drop.status = DropStatus.REVEALED;

        emit DropRevealed(dropId, baseURI);
    }

    /**
     * @notice Withdraw sale proceeds
     */
    function withdraw(uint256 dropId) external nonReentrant {
        Drop storage drop = drops[dropId];
        if (msg.sender != drop.creator) revert Unauthorized();

        uint256 balance = address(this).balance;
        if (balance == 0) return;

        // Platform fee
        uint256 platformFee = (balance * drop.platformFeeBps) / BPS_PRECISION;
        uint256 creatorAmount = balance - platformFee;

        (bool success1, ) = treasury.call{value: platformFee}("");
        (bool success2, ) = drop.creator.call{value: creatorAmount}("");
        require(success1 && success2, "Transfer failed");
    }

    // ============ View Functions ============

    function getDrop(uint256 dropId) external view returns (Drop memory) {
        return drops[dropId];
    }

    function getMintRecord(
        uint256 dropId,
        address user
    ) external view returns (MintRecord memory) {
        return mintRecords[dropId][user];
    }

    function getCurrentPrice(uint256 dropId) external view returns (uint256) {
        return _getCurrentPrice(drops[dropId]);
    }

    function getDropStatus(uint256 dropId) external view returns (DropStatus) {
        Drop storage drop = drops[dropId];
        _checkStatus(drop);
        return drop.status;
    }

    // ============ Admin Functions ============

    function setTreasury(
        address _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = _treasury;
    }

    function setDefaultFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fee <= MAX_PLATFORM_FEE, "Fee too high");
        defaultPlatformFee = _fee;
    }

    // ============ Internal Functions ============

    function _getCurrentPrice(
        Drop storage drop
    ) internal view returns (uint256) {
        if (drop.dropType == DropType.DUTCH_AUCTION) {
            if (block.timestamp <= drop.allowlistStart) return drop.startPrice;

            uint256 elapsed = block.timestamp - drop.allowlistStart;
            uint256 decrements = elapsed / drop.decrementInterval;
            uint256 reduction = decrements * drop.priceDecrement;

            if (drop.startPrice <= reduction + drop.endPrice) {
                return drop.endPrice;
            }
            return drop.startPrice - reduction;
        } else if (drop.dropType == DropType.FREE_CLAIM) {
            return 0;
        }
        return drop.price;
    }

    function _updateDropStatus(Drop storage drop) internal {
        _checkStatus(drop);
    }

    function _checkStatus(Drop storage drop) internal view {
        if (block.timestamp >= drop.endTime || drop.minted >= drop.maxSupply) {
            // Would be ENDED
        } else if (block.timestamp >= drop.publicStart) {
            // Would be PUBLIC_ACTIVE
        } else if (block.timestamp >= drop.allowlistStart) {
            // Would be ALLOWLIST_ACTIVE
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    receive() external payable {}
}
