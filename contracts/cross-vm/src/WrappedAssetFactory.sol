// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WrappedAsset
 * @notice ERC20 token representing a wrapped asset from another VM/chain
 */
contract WrappedAsset is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    /// @notice Source chain/VM identifier
    uint256 public immutable sourceChainId;

    /// @notice Original asset address (32 bytes for compatibility)
    bytes32 public immutable originalAsset;

    /// @notice Original asset decimals
    uint8 private immutable _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 _sourceChainId,
        bytes32 _originalAsset,
        address admin
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimals_;
        sourceChainId = _sourceChainId;
        originalAsset = _originalAsset;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BRIDGE_ROLE, admin);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function bridgeMint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
    }

    function bridgeBurn(address from, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }
}

/**
 * @title WrappedAssetFactory
 * @author X3 Chain Team
 * @notice Factory for creating wrapped assets from other VMs/chains
 * @dev Creates ERC20 representations of assets from SVM, X3VM, and other chains
 *
 * Supported Asset Types:
 * - SPL Tokens (Solana)
 * - X3 Tokens (X3VM)
 * - Native currencies (SOL, ETH derivatives)
 * - Other chain ERC20s
 *
 * Workflow:
 * 1. Lock original asset on source chain
 * 2. Relayer calls createWrappedAsset or mint existing wrapped
 * 3. User receives wrapped tokens on this chain
 * 4. To unlock: burn wrapped, relayer unlocks original
 */
contract WrappedAssetFactory is AccessControl, ReentrancyGuard {

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Source VM/Chain type
    enum SourceType {
        EVM,       // 0 - Other EVM chains
        SVM,       // 1 - Solana
        X3VM,      // 2 - X3 VM
        SUBSTRATE, // 3 - Substrate chains
        COSMOS,    // 4 - Cosmos chains
        BITCOIN    // 5 - Bitcoin (via bridge)
    }

    /// @notice Asset registration info
    struct AssetInfo {
        address wrappedToken;      // Deployed wrapped token address
        SourceType sourceType;     // Source VM/chain type
        uint256 sourceChainId;     // Source chain ID
        bytes32 originalAsset;     // Original asset address (32 bytes)
        string name;               // Token name
        string symbol;             // Token symbol
        uint8 decimals;            // Token decimals
        uint256 totalMinted;       // Total minted amount
        uint256 totalBurned;       // Total burned amount
        bool active;               // Whether asset is active
    }

    /// @notice Mint request for verification
    struct MintRequest {
        bytes32 requestId;
        bytes32 assetId;
        address recipient;
        uint256 amount;
        bytes32 sourceTxHash;
        uint256 timestamp;
        bool executed;
    }

    /// @notice Burn request for unlocking
    struct BurnRequest {
        bytes32 requestId;
        bytes32 assetId;
        address burner;
        bytes32 destAddress;       // Destination address on source chain
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Asset registry by asset ID
    mapping(bytes32 => AssetInfo) public assets;

    /// @notice Wrapped token to asset ID mapping
    mapping(address => bytes32) public tokenToAssetId;

    /// @notice Original asset to wrapped token mapping
    mapping(bytes32 => address) public originalToWrapped;

    /// @notice Mint requests by request ID
    mapping(bytes32 => MintRequest) public mintRequests;

    /// @notice Burn requests by request ID
    mapping(bytes32 => BurnRequest) public burnRequests;

    /// @notice All asset IDs
    bytes32[] public assetIds;

    /// @notice Request nonce
    uint256 private _requestNonce;

    /// @notice Paused assets
    mapping(bytes32 => bool) public pausedAssets;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event WrappedAssetCreated(
        bytes32 indexed assetId,
        address indexed wrappedToken,
        SourceType sourceType,
        uint256 sourceChainId,
        bytes32 originalAsset,
        string name,
        string symbol
    );

    event AssetMinted(
        bytes32 indexed assetId,
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount,
        bytes32 sourceTxHash
    );

    event AssetBurned(
        bytes32 indexed assetId,
        bytes32 indexed requestId,
        address indexed burner,
        bytes32 destAddress,
        uint256 amount
    );

    event AssetPaused(bytes32 indexed assetId);
    event AssetUnpaused(bytes32 indexed assetId);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error AssetAlreadyExists();
    error AssetNotFound();
    error AssetPausedError();
    error RequestAlreadyExecuted();
    error InvalidAmount();
    error InvalidRecipient();
    error UnauthorizedBurn();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ASSET CREATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new wrapped asset
     * @param sourceType Source VM/chain type
     * @param sourceChainId Source chain ID
     * @param originalAsset Original asset address
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @return assetId Unique asset identifier
     * @return wrappedToken Deployed wrapped token address
     */
    function createWrappedAsset(
        SourceType sourceType,
        uint256 sourceChainId,
        bytes32 originalAsset,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlyRole(DEPLOYER_ROLE) returns (bytes32 assetId, address wrappedToken) {
        // Generate asset ID
        assetId = keccak256(abi.encodePacked(
            sourceType,
            sourceChainId,
            originalAsset
        ));

        // Check if already exists
        if (assets[assetId].wrappedToken != address(0)) revert AssetAlreadyExists();

        // Deploy wrapped token
        wrappedToken = address(new WrappedAsset(
            string(abi.encodePacked("Wrapped ", name)),
            string(abi.encodePacked("w", symbol)),
            decimals,
            sourceChainId,
            originalAsset,
            address(this)
        ));

        // Grant bridge role to this factory
        WrappedAsset(wrappedToken).grantRole(
            WrappedAsset(wrappedToken).BRIDGE_ROLE(),
            address(this)
        );

        // Register asset
        assets[assetId] = AssetInfo({
            wrappedToken: wrappedToken,
            sourceType: sourceType,
            sourceChainId: sourceChainId,
            originalAsset: originalAsset,
            name: name,
            symbol: symbol,
            decimals: decimals,
            totalMinted: 0,
            totalBurned: 0,
            active: true
        });

        tokenToAssetId[wrappedToken] = assetId;
        originalToWrapped[originalAsset] = wrappedToken;
        assetIds.push(assetId);

        emit WrappedAssetCreated(
            assetId,
            wrappedToken,
            sourceType,
            sourceChainId,
            originalAsset,
            name,
            symbol
        );
    }

    /**
     * @notice Create wrapped asset for SPL token (Solana)
     */
    function createWrappedSPL(
        bytes32 mintAddress,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlyRole(DEPLOYER_ROLE) returns (bytes32 assetId, address wrappedToken) {
        return this.createWrappedAsset(
            SourceType.SVM,
            0, // Solana mainnet
            mintAddress,
            name,
            symbol,
            decimals
        );
    }

    /**
     * @notice Create wrapped asset for X3VM token
     */
    function createWrappedX3(
        bytes32 tokenAddress,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlyRole(DEPLOYER_ROLE) returns (bytes32 assetId, address wrappedToken) {
        return this.createWrappedAsset(
            SourceType.X3VM,
            1, // X3 chain ID
            tokenAddress,
            name,
            symbol,
            decimals
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MINTING (Bridge operations)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mint wrapped tokens after lock on source chain
     * @param assetId Asset identifier
     * @param recipient Recipient address
     * @param amount Amount to mint
     * @param sourceTxHash Transaction hash on source chain
     * @return requestId Mint request ID
     */
    function mint(
        bytes32 assetId,
        address recipient,
        uint256 amount,
        bytes32 sourceTxHash
    ) external onlyRole(BRIDGE_ROLE) nonReentrant returns (bytes32 requestId) {
        AssetInfo storage asset = assets[assetId];
        
        if (asset.wrappedToken == address(0)) revert AssetNotFound();
        if (pausedAssets[assetId]) revert AssetPausedError();
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        // Generate request ID
        unchecked { _requestNonce++; }
        requestId = keccak256(abi.encodePacked(
            assetId,
            recipient,
            amount,
            sourceTxHash,
            _requestNonce
        ));

        // Check for duplicate
        if (mintRequests[requestId].executed) revert RequestAlreadyExecuted();

        // Record request
        mintRequests[requestId] = MintRequest({
            requestId: requestId,
            assetId: assetId,
            recipient: recipient,
            amount: amount,
            sourceTxHash: sourceTxHash,
            timestamp: block.timestamp,
            executed: true
        });

        // Mint tokens
        WrappedAsset(asset.wrappedToken).bridgeMint(recipient, amount);
        asset.totalMinted += amount;

        emit AssetMinted(assetId, requestId, recipient, amount, sourceTxHash);
    }

    /**
     * @notice Batch mint for multiple recipients
     */
    function batchMint(
        bytes32 assetId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata sourceTxHashes
    ) external onlyRole(BRIDGE_ROLE) nonReentrant returns (bytes32[] memory requestIds) {
        require(
            recipients.length == amounts.length &&
            amounts.length == sourceTxHashes.length,
            "Array length mismatch"
        );

        requestIds = new bytes32[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            requestIds[i] = this.mint(
                assetId,
                recipients[i],
                amounts[i],
                sourceTxHashes[i]
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BURNING (Unlock on source chain)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Burn wrapped tokens to unlock on source chain
     * @param assetId Asset identifier
     * @param amount Amount to burn
     * @param destAddress Destination address on source chain
     * @return requestId Burn request ID
     */
    function burn(
        bytes32 assetId,
        uint256 amount,
        bytes32 destAddress
    ) external nonReentrant returns (bytes32 requestId) {
        AssetInfo storage asset = assets[assetId];
        
        if (asset.wrappedToken == address(0)) revert AssetNotFound();
        if (pausedAssets[assetId]) revert AssetPausedError();
        if (amount == 0) revert InvalidAmount();

        // Generate request ID
        unchecked { _requestNonce++; }
        requestId = keccak256(abi.encodePacked(
            assetId,
            msg.sender,
            destAddress,
            amount,
            _requestNonce
        ));

        // Record request
        burnRequests[requestId] = BurnRequest({
            requestId: requestId,
            assetId: assetId,
            burner: msg.sender,
            destAddress: destAddress,
            amount: amount,
            timestamp: block.timestamp,
            processed: false
        });

        // Burn tokens
        WrappedAsset(asset.wrappedToken).bridgeBurn(msg.sender, amount);
        asset.totalBurned += amount;

        emit AssetBurned(assetId, requestId, msg.sender, destAddress, amount);
    }

    /**
     * @notice Mark burn request as processed (relayer unlocked on source)
     */
    function markBurnProcessed(bytes32 requestId) external onlyRole(BRIDGE_ROLE) {
        burnRequests[requestId].processed = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function pauseAsset(bytes32 assetId) external onlyRole(GUARDIAN_ROLE) {
        pausedAssets[assetId] = true;
        emit AssetPaused(assetId);
    }

    function unpauseAsset(bytes32 assetId) external onlyRole(GUARDIAN_ROLE) {
        pausedAssets[assetId] = false;
        emit AssetUnpaused(assetId);
    }

    function setAssetActive(bytes32 assetId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assets[assetId].active = active;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getAsset(bytes32 assetId) external view returns (AssetInfo memory) {
        return assets[assetId];
    }

    function getWrappedToken(bytes32 originalAsset) external view returns (address) {
        return originalToWrapped[originalAsset];
    }

    function getAssetCount() external view returns (uint256) {
        return assetIds.length;
    }

    function getAllAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }

    function getCirculatingSupply(bytes32 assetId) external view returns (uint256) {
        AssetInfo storage asset = assets[assetId];
        return asset.totalMinted - asset.totalBurned;
    }

    function getMintRequest(bytes32 requestId) external view returns (MintRequest memory) {
        return mintRequests[requestId];
    }

    function getBurnRequest(bytes32 requestId) external view returns (BurnRequest memory) {
        return burnRequests[requestId];
    }
}
