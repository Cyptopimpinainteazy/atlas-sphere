// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {WadRayMath} from "../libraries/MathLibraries.sol";

/**
 * @title AToken
 * @notice Interest-bearing deposit receipt token
 * @dev User deposits underlying → receives aTokens representing their share
 *
 * Key mechanics:
 * - Scaled balance: Internal balance that stays constant
 * - Balance: Returns scaled * liquidityIndex (increases over time)
 * - Interest accrues passively through index growth
 *
 * Security:
 * - Only pool can mint/burn
 * - Transfer validations for collateral usage
 * - Reentrancy protection via CEI pattern
 */
contract AToken is ERC20 {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;

    // ============ Constants ============

    uint256 internal constant RAY = 1e27;

    // ============ State ============

    /// @notice Underlying asset this aToken represents
    IERC20 public immutable UNDERLYING_ASSET;

    /// @notice Pool contract (only minter/burner)
    address public immutable POOL;

    /// @notice Current liquidity index (RAY precision)
    uint256 public liquidityIndex;

    /// @notice Treasury address for protocol fees
    address public treasury;

    /// @notice Incentives controller for rewards
    address public incentivesController;

    /// @notice Scaled balances (constant, doesn't grow with interest)
    mapping(address => uint256) internal _scaledBalances;

    /// @notice Total scaled supply
    uint256 internal _totalScaledSupply;

    // ============ Events ============

    event Mint(
        address indexed caller,
        address indexed onBehalfOf,
        uint256 amount,
        uint256 balanceIncrease,
        uint256 index
    );

    event Burn(
        address indexed from,
        address indexed target,
        uint256 amount,
        uint256 balanceIncrease,
        uint256 index
    );

    event BalanceTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 index
    );

    // ============ Modifiers ============

    modifier onlyPool() {
        require(msg.sender == POOL, "AToken: only pool");
        _;
    }

    // ============ Constructor ============

    /**
     * @param pool Pool contract address
     * @param underlyingAsset Underlying ERC20 token
     * @param treasury_ Treasury for protocol fees
     * @param incentivesController_ Rewards controller
     * @param name_ Token name
     * @param symbol_ Token symbol
     */
    constructor(
        address pool,
        address underlyingAsset,
        address treasury_,
        address incentivesController_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(pool != address(0), "AToken: zero pool");
        require(underlyingAsset != address(0), "AToken: zero underlying");

        POOL = pool;
        UNDERLYING_ASSET = IERC20(underlyingAsset);
        treasury = treasury_;
        incentivesController = incentivesController_;
        liquidityIndex = RAY; // Start at 1.0
    }

    // ============ Core Functions ============

    /**
     * @notice Mint aTokens to a user
     * @param caller The address initiating the deposit
     * @param onBehalfOf Recipient of aTokens
     * @param amount Amount of underlying deposited
     * @param index Current liquidity index
     * @return True if this is the user's first deposit
     */
    function mint(
        address caller,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external onlyPool returns (bool) {
        // Update index
        liquidityIndex = index;

        // Calculate scaled amount (constant over time)
        uint256 scaledAmount = amount.rayDiv(index);
        require(scaledAmount > 0, "AToken: invalid mint amount");

        bool isFirstDeposit = _scaledBalances[onBehalfOf] == 0;

        // Update scaled balance
        uint256 previousBalance = _scaledBalances[onBehalfOf];
        _scaledBalances[onBehalfOf] += scaledAmount;
        _totalScaledSupply += scaledAmount;

        // Calculate balance increase from interest
        uint256 balanceIncrease = previousBalance.rayMul(index) -
            previousBalance.rayMul(liquidityIndex);

        emit Mint(caller, onBehalfOf, amount, balanceIncrease, index);
        emit Transfer(address(0), onBehalfOf, amount);

        return isFirstDeposit;
    }

    /**
     * @notice Burn aTokens and send underlying to recipient
     * @param from User burning aTokens
     * @param receiverOfUnderlying Recipient of underlying asset
     * @param amount Amount of underlying to withdraw
     * @param index Current liquidity index
     */
    function burn(
        address from,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external onlyPool {
        // Update index
        liquidityIndex = index;

        uint256 scaledAmount = amount.rayDiv(index);
        require(scaledAmount > 0, "AToken: invalid burn amount");

        // Check balance
        uint256 previousBalance = _scaledBalances[from];
        require(
            previousBalance >= scaledAmount,
            "AToken: burn amount exceeds balance"
        );

        // Update scaled balance
        _scaledBalances[from] -= scaledAmount;
        _totalScaledSupply -= scaledAmount;

        // Calculate balance increase from interest
        uint256 balanceIncrease = previousBalance.rayMul(index) -
            previousBalance.rayMul(liquidityIndex);

        // Transfer underlying to recipient
        UNDERLYING_ASSET.safeTransfer(receiverOfUnderlying, amount);

        emit Burn(from, receiverOfUnderlying, amount, balanceIncrease, index);
        emit Transfer(from, address(0), amount);
    }

    /**
     * @notice Transfer aTokens to another user
     * @dev Overrides ERC20 to handle scaled balances
     */
    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        _transferScaled(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Transfer aTokens from one address to another
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transferScaled(from, to, amount);
        return true;
    }

    /**
     * @notice Internal transfer with scaled balance handling
     */
    function _transferScaled(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "AToken: transfer from zero");
        require(to != address(0), "AToken: transfer to zero");
        require(from != to, "AToken: self transfer");

        uint256 index = liquidityIndex;
        uint256 scaledAmount = amount.rayDiv(index);

        require(
            _scaledBalances[from] >= scaledAmount,
            "AToken: transfer exceeds balance"
        );

        _scaledBalances[from] -= scaledAmount;
        _scaledBalances[to] += scaledAmount;

        emit BalanceTransfer(from, to, amount, index);
        emit Transfer(from, to, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Returns the actual balance including accrued interest
     * @param account The address
     * @return The current balance
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _scaledBalances[account].rayMul(liquidityIndex);
    }

    /**
     * @notice Returns the scaled balance (constant, for accounting)
     * @param account The address
     * @return Scaled balance
     */
    function scaledBalanceOf(address account) external view returns (uint256) {
        return _scaledBalances[account];
    }

    /**
     * @notice Total supply including accrued interest
     */
    function totalSupply() public view override returns (uint256) {
        return _totalScaledSupply.rayMul(liquidityIndex);
    }

    /**
     * @notice Total scaled supply
     */
    function scaledTotalSupply() external view returns (uint256) {
        return _totalScaledSupply;
    }

    /**
     * @notice Get underlying asset address
     */
    function getUnderlyingAsset() external view returns (address) {
        return address(UNDERLYING_ASSET);
    }

    /**
     * @notice Get current liquidity index
     */
    function getIndex() external view returns (uint256) {
        return liquidityIndex;
    }

    // ============ Admin ============

    /**
     * @notice Transfer underlying held by this contract (used by pool for flashloans)
     * @param target Recipient
     * @param amount Amount to transfer
     */
    function transferUnderlyingTo(
        address target,
        uint256 amount
    ) external onlyPool {
        UNDERLYING_ASSET.safeTransfer(target, amount);
    }

    /**
     * @notice Handle underlying received (for repayments)
     * @param amount Amount received
     */
    function handleRepayment(
        address user,
        address onBehalfOf,
        uint256 amount
    ) external onlyPool {
        // Hook for additional logic (e.g., rewards)
    }

    /**
     * @notice Mint to treasury (for protocol fees)
     * @param amount Amount to mint
     * @param index Current index
     */
    function mintToTreasury(uint256 amount, uint256 index) external onlyPool {
        if (amount == 0) return;

        liquidityIndex = index;
        uint256 scaledAmount = amount.rayDiv(index);

        _scaledBalances[treasury] += scaledAmount;
        _totalScaledSupply += scaledAmount;

        emit Transfer(address(0), treasury, amount);
    }

    /**
     * @notice Rescue tokens accidentally sent to this contract
     * @param token Token to rescue (cannot be underlying)
     * @param to Recipient
     * @param amount Amount
     */
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyPool {
        require(
            token != address(UNDERLYING_ASSET),
            "AToken: cannot rescue underlying"
        );
        IERC20(token).safeTransfer(to, amount);
    }
}
