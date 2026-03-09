// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeManager
 * @notice Centralized fee collection and distribution for X3 Chain
 * @dev Handles protocol fees from DEX, bridges, flash loans, and distributes to stakeholders
 * 
 * Fee Distribution:
 * - Validators: 40% (staking rewards)
 * - Treasury: 30% (protocol development)
 * - Buyback & Burn: 15% (deflationary pressure)
 * - Insurance Fund: 15% (security reserve)
 */
contract FeeManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant FEE_SETTER_ROLE = keccak256("FEE_SETTER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_FEE_BPS = 1000; // 10% max fee

    // Fee types
    uint8 public constant FEE_TYPE_SWAP = 0;
    uint8 public constant FEE_TYPE_BRIDGE = 1;
    uint8 public constant FEE_TYPE_FLASH_LOAN = 2;
    uint8 public constant FEE_TYPE_ATOMIC_SWAP = 3;
    uint8 public constant FEE_TYPE_CROSS_VM = 4;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    // Distribution addresses
    address public validatorRewardsPool;
    address public treasury;
    address public buybackContract;
    address public insuranceFund;

    // Distribution shares (in BPS)
    uint256 public validatorShareBps = 4000;  // 40%
    uint256 public treasuryShareBps = 3000;   // 30%
    uint256 public buybackShareBps = 1500;    // 15%
    uint256 public insuranceShareBps = 1500;  // 15%

    // Fee rates per type (in BPS)
    mapping(uint8 => uint256) public feeRates;

    // Accumulated fees per token
    mapping(address => uint256) public accumulatedFees;

    // Supported fee tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Native token (X3)
    address public x3Token;

    // Fee collection stats
    struct FeeStats {
        uint256 totalCollected;
        uint256 totalDistributed;
        uint256 lastDistribution;
        uint256 distributionCount;
    }
    mapping(address => FeeStats) public tokenStats;

    // Distribution history
    struct Distribution {
        uint256 timestamp;
        address token;
        uint256 amount;
        uint256 validatorAmount;
        uint256 treasuryAmount;
        uint256 buybackAmount;
        uint256 insuranceAmount;
    }
    Distribution[] public distributions;

    // Referral fee sharing - token-aware: referrer => token => balance
    mapping(address => mapping(address => uint256)) public referralBalances;
    uint256 public referralShareBps = 500; // 5% of fees to referrers

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event FeeCollected(
        address indexed token,
        uint256 amount,
        uint8 feeType,
        address indexed source
    );

    event FeesDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 validatorAmount,
        uint256 treasuryAmount,
        uint256 buybackAmount,
        uint256 insuranceAmount
    );

    event FeeRateUpdated(uint8 feeType, uint256 oldRate, uint256 newRate);
    event DistributionSharesUpdated(
        uint256 validator,
        uint256 treasury,
        uint256 buyback,
        uint256 insurance
    );
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event ReferralPaid(address indexed referrer, address indexed token, uint256 amount);
    event DistributionAddressUpdated(string addressType, address newAddress);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _x3Token,
        address _validatorRewardsPool,
        address _treasury,
        address _buybackContract,
        address _insuranceFund
    ) {
        require(_x3Token != address(0), "Invalid X3 token");
        require(_validatorRewardsPool != address(0), "Invalid validator pool");
        require(_treasury != address(0), "Invalid treasury");
        require(_buybackContract != address(0), "Invalid buyback");
        require(_insuranceFund != address(0), "Invalid insurance");

        x3Token = _x3Token;
        validatorRewardsPool = _validatorRewardsPool;
        treasury = _treasury;
        buybackContract = _buybackContract;
        insuranceFund = _insuranceFund;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COLLECTOR_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(FEE_SETTER_ROLE, msg.sender);

        // Set default fee rates
        feeRates[FEE_TYPE_SWAP] = 30;          // 0.30%
        feeRates[FEE_TYPE_BRIDGE] = 10;        // 0.10%
        feeRates[FEE_TYPE_FLASH_LOAN] = 9;     // 0.09%
        feeRates[FEE_TYPE_ATOMIC_SWAP] = 15;   // 0.15%
        feeRates[FEE_TYPE_CROSS_VM] = 5;       // 0.05%

        // Add X3 as supported token
        supportedTokens[_x3Token] = true;
        tokenList.push(_x3Token);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE COLLECTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Collect fees from a protocol operation
     * @param token The fee token
     * @param amount The fee amount
     * @param feeType The type of fee
     * @param referrer Optional referrer for fee sharing
     */
    function collectFee(
        address token,
        uint256 amount,
        uint8 feeType,
        address referrer
    ) external nonReentrant whenNotPaused onlyRole(COLLECTOR_ROLE) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Handle referral share - store per-token
        uint256 referralAmount = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralAmount = (amount * referralShareBps) / BPS_DENOMINATOR;
            referralBalances[referrer][token] += referralAmount;
            amount -= referralAmount;
        }

        accumulatedFees[token] += amount;
        tokenStats[token].totalCollected += amount;

        emit FeeCollected(token, amount, feeType, msg.sender);
    }

    /**
     * @notice Collect native ETH/gas token fees
     */
    function collectNativeFee(
        uint8 feeType,
        address referrer
    ) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Zero value");

        uint256 amount = msg.value;
        uint256 referralAmount = 0;

        if (referrer != address(0) && referrer != msg.sender) {
            referralAmount = (amount * referralShareBps) / BPS_DENOMINATOR;
            // Store native referral balance (mapped to address(0))
            referralBalances[referrer][address(0)] += referralAmount;
            amount -= referralAmount;
        }

        accumulatedFees[address(0)] += amount;
        tokenStats[address(0)].totalCollected += amount;

        emit FeeCollected(address(0), amount, feeType, msg.sender);
    }

    /**
     * @notice Calculate fee for a given amount and type
     */
    function calculateFee(
        uint256 amount,
        uint8 feeType
    ) external view returns (uint256) {
        return (amount * feeRates[feeType]) / BPS_DENOMINATOR;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Distribute accumulated fees for a token
     * @param token The token to distribute
     */
    function distributeFees(
        address token
    ) external nonReentrant whenNotPaused onlyRole(DISTRIBUTOR_ROLE) {
        _distributeFees(token);
    }

    /**
     * @notice Internal fee distribution logic
     * @param token The token to distribute
     */
    function _distributeFees(address token) internal {
        uint256 amount = accumulatedFees[token];
        require(amount > 0, "No fees to distribute");

        accumulatedFees[token] = 0;

        uint256 validatorAmount = (amount * validatorShareBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = (amount * treasuryShareBps) / BPS_DENOMINATOR;
        uint256 buybackAmount = (amount * buybackShareBps) / BPS_DENOMINATOR;
        uint256 insuranceAmount = amount - validatorAmount - treasuryAmount - buybackAmount;

        if (token == address(0)) {
            // Native token distribution
            _safeTransferETH(validatorRewardsPool, validatorAmount);
            _safeTransferETH(treasury, treasuryAmount);
            _safeTransferETH(buybackContract, buybackAmount);
            _safeTransferETH(insuranceFund, insuranceAmount);
        } else {
            IERC20(token).safeTransfer(validatorRewardsPool, validatorAmount);
            IERC20(token).safeTransfer(treasury, treasuryAmount);
            IERC20(token).safeTransfer(buybackContract, buybackAmount);
            IERC20(token).safeTransfer(insuranceFund, insuranceAmount);
        }

        // Update stats
        tokenStats[token].totalDistributed += amount;
        tokenStats[token].lastDistribution = block.timestamp;
        tokenStats[token].distributionCount++;

        // Record distribution
        distributions.push(Distribution({
            timestamp: block.timestamp,
            token: token,
            amount: amount,
            validatorAmount: validatorAmount,
            treasuryAmount: treasuryAmount,
            buybackAmount: buybackAmount,
            insuranceAmount: insuranceAmount
        }));

        emit FeesDistributed(
            token,
            amount,
            validatorAmount,
            treasuryAmount,
            buybackAmount,
            insuranceAmount
        );
    }

    /**
     * @notice Distribute all accumulated fees for all tokens
     */
    function distributeAllFees() external nonReentrant whenNotPaused onlyRole(DISTRIBUTOR_ROLE) {
        // Distribute native token fees
        if (accumulatedFees[address(0)] > 0) {
            _distributeFees(address(0));
        }

        // Distribute ERC20 token fees
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (accumulatedFees[tokenList[i]] > 0) {
                _distributeFees(tokenList[i]);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REFERRAL SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Claim referral rewards for a specific token
     * @param token The token to claim (address(0) for native)
     */
    function claimReferralRewards(address token) external nonReentrant whenNotPaused {
        uint256 amount = referralBalances[msg.sender][token];
        require(amount > 0, "No rewards to claim");

        referralBalances[msg.sender][token] = 0;

        if (token == address(0)) {
            _safeTransferETH(msg.sender, amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit ReferralPaid(msg.sender, token, amount);
    }

    /**
     * @notice Get referral balance for a specific token
     * @param referrer The referrer address
     * @param token The token address (address(0) for native)
     */
    function getReferralBalance(address referrer, address token) external view returns (uint256) {
        return referralBalances[referrer][token];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set fee rate for a fee type
     */
    function setFeeRate(
        uint8 feeType,
        uint256 newRate
    ) external onlyRole(FEE_SETTER_ROLE) {
        require(newRate <= MAX_FEE_BPS, "Fee too high");

        uint256 oldRate = feeRates[feeType];
        feeRates[feeType] = newRate;

        emit FeeRateUpdated(feeType, oldRate, newRate);
    }

    /**
     * @notice Update distribution shares
     */
    function setDistributionShares(
        uint256 _validatorBps,
        uint256 _treasuryBps,
        uint256 _buybackBps,
        uint256 _insuranceBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _validatorBps + _treasuryBps + _buybackBps + _insuranceBps == BPS_DENOMINATOR,
            "Shares must sum to 100%"
        );

        validatorShareBps = _validatorBps;
        treasuryShareBps = _treasuryBps;
        buybackShareBps = _buybackBps;
        insuranceShareBps = _insuranceBps;

        emit DistributionSharesUpdated(
            _validatorBps,
            _treasuryBps,
            _buybackBps,
            _insuranceBps
        );
    }

    /**
     * @notice Add a supported fee token
     */
    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }

    /**
     * @notice Remove a supported fee token
     */
    function removeSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(supportedTokens[token], "Not supported");
        require(token != x3Token, "Cannot remove X3");
        
        supportedTokens[token] = false;
        
        // Remove from list
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }

    /**
     * @notice Update distribution addresses
     */
    function setValidatorRewardsPool(address newPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPool != address(0), "Invalid address");
        validatorRewardsPool = newPool;
        emit DistributionAddressUpdated("validatorRewardsPool", newPool);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid address");
        treasury = newTreasury;
        emit DistributionAddressUpdated("treasury", newTreasury);
    }

    function setBuybackContract(address newBuyback) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newBuyback != address(0), "Invalid address");
        buybackContract = newBuyback;
        emit DistributionAddressUpdated("buybackContract", newBuyback);
    }

    function setInsuranceFund(address newInsurance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newInsurance != address(0), "Invalid address");
        insuranceFund = newInsurance;
        emit DistributionAddressUpdated("insuranceFund", newInsurance);
    }

    function setReferralShare(uint256 newShareBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newShareBps <= 2000, "Max 20% referral");
        referralShareBps = newShareBps;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getTokenList() external view returns (address[] memory) {
        return tokenList;
    }

    function getDistributionCount() external view returns (uint256) {
        return distributions.length;
    }

    function getDistribution(uint256 index) external view returns (Distribution memory) {
        return distributions[index];
    }

    function getPendingFees(address token) external view returns (uint256) {
        return accumulatedFees[token];
    }

    function getTotalPendingFees() external view returns (uint256 total) {
        total = accumulatedFees[address(0)];
        for (uint256 i = 0; i < tokenList.length; i++) {
            total += accumulatedFees[tokenList[i]];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    receive() external payable {}
}
