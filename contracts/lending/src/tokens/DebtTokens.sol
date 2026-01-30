// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WadRayMath} from "../libraries/MathLibraries.sol";

/**
 * @title VariableDebtToken
 * @notice Token representing variable rate debt obligations
 * @dev Non-transferable - represents debt position
 *
 * Key mechanics:
 * - Scaled balance: Internal balance that stays constant
 * - Balance: Returns scaled * variableBorrowIndex (grows with interest)
 * - Interest compounds via index growth
 *
 * Security:
 * - Non-transferable (cannot sell debt to others)
 * - Only pool can mint/burn
 * - Credit delegation for borrowing on behalf
 */
contract VariableDebtToken is ERC20 {
    using WadRayMath for uint256;

    // ============ Constants ============

    uint256 internal constant RAY = 1e27;

    // ============ State ============

    /// @notice Pool contract
    address public immutable POOL;

    /// @notice Underlying asset this debt represents
    address public immutable UNDERLYING_ASSET;

    /// @notice Current variable borrow index
    uint256 public variableBorrowIndex;

    /// @notice Scaled balances (constant, grows via index)
    mapping(address => uint256) internal _scaledBalances;

    /// @notice Total scaled supply
    uint256 internal _totalScaledSupply;

    /// @notice Credit delegation allowances
    /// @dev borrower => delegatee => amount
    mapping(address => mapping(address => uint256)) public borrowAllowances;

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
        uint256 amount,
        uint256 balanceIncrease,
        uint256 index
    );

    event BorrowAllowanceDelegated(
        address indexed fromUser,
        address indexed toUser,
        address indexed asset,
        uint256 amount
    );

    // ============ Modifiers ============

    modifier onlyPool() {
        require(msg.sender == POOL, "DebtToken: only pool");
        _;
    }

    // ============ Constructor ============

    constructor(
        address pool,
        address underlyingAsset,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(pool != address(0), "DebtToken: zero pool");
        require(underlyingAsset != address(0), "DebtToken: zero underlying");

        POOL = pool;
        UNDERLYING_ASSET = underlyingAsset;
        variableBorrowIndex = RAY;
    }

    // ============ Core Functions ============

    /**
     * @notice Mint debt tokens when user borrows
     * @param user The address on behalf of which the debt is being minted
     * @param onBehalfOf The recipient of the debt (if delegated)
     * @param amount The amount of debt being minted
     * @param index The current variable borrow index
     * @return True if this is the user's first borrow, scaled amount minted
     */
    function mint(
        address user,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external onlyPool returns (bool, uint256) {
        // If borrowing on behalf, check credit delegation
        if (user != onBehalfOf) {
            _decreaseBorrowAllowance(onBehalfOf, user, amount);
        }

        variableBorrowIndex = index;

        uint256 scaledAmount = amount.rayDiv(index);
        require(scaledAmount > 0, "DebtToken: invalid mint amount");

        bool isFirstBorrow = _scaledBalances[onBehalfOf] == 0;

        uint256 previousBalance = _scaledBalances[onBehalfOf];
        _scaledBalances[onBehalfOf] += scaledAmount;
        _totalScaledSupply += scaledAmount;

        uint256 balanceIncrease = previousBalance.rayMul(index) -
            previousBalance.rayMul(variableBorrowIndex);

        emit Mint(user, onBehalfOf, amount, balanceIncrease, index);
        emit Transfer(address(0), onBehalfOf, amount);

        return (isFirstBorrow, scaledAmount);
    }

    /**
     * @notice Burn debt tokens when user repays
     * @param from The address from which debt is being burned
     * @param amount The amount of debt being burned
     * @param index The current variable borrow index
     * @return The scaled amount burned
     */
    function burn(
        address from,
        uint256 amount,
        uint256 index
    ) external onlyPool returns (uint256) {
        variableBorrowIndex = index;

        uint256 scaledAmount = amount.rayDiv(index);
        require(scaledAmount > 0, "DebtToken: invalid burn amount");

        uint256 previousBalance = _scaledBalances[from];
        require(
            previousBalance >= scaledAmount,
            "DebtToken: burn exceeds balance"
        );

        _scaledBalances[from] -= scaledAmount;
        _totalScaledSupply -= scaledAmount;

        uint256 balanceIncrease = previousBalance.rayMul(index) -
            previousBalance.rayMul(variableBorrowIndex);

        emit Burn(from, amount, balanceIncrease, index);
        emit Transfer(from, address(0), amount);

        return scaledAmount;
    }

    // ============ Credit Delegation ============

    /**
     * @notice Delegate borrowing power to another address
     * @param delegatee The address that can borrow on caller's behalf
     * @param amount The amount of credit delegated
     */
    function approveDelegation(address delegatee, uint256 amount) external {
        _approveDelegation(msg.sender, delegatee, amount);
    }

    /**
     * @notice Get the current delegation allowance
     * @param fromUser The delegator
     * @param toUser The delegatee
     * @return The current allowance
     */
    function borrowAllowance(
        address fromUser,
        address toUser
    ) external view returns (uint256) {
        return borrowAllowances[fromUser][toUser];
    }

    function _approveDelegation(
        address delegator,
        address delegatee,
        uint256 amount
    ) internal {
        require(delegatee != address(0), "DebtToken: zero delegatee");
        borrowAllowances[delegator][delegatee] = amount;
        emit BorrowAllowanceDelegated(
            delegator,
            delegatee,
            UNDERLYING_ASSET,
            amount
        );
    }

    function _decreaseBorrowAllowance(
        address delegator,
        address delegatee,
        uint256 amount
    ) internal {
        uint256 currentAllowance = borrowAllowances[delegator][delegatee];
        require(
            currentAllowance >= amount,
            "DebtToken: insufficient delegation"
        );
        unchecked {
            borrowAllowances[delegator][delegatee] = currentAllowance - amount;
        }
    }

    // ============ Overrides (Non-Transferable) ============

    /**
     * @dev Debt tokens are NOT transferable
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert("DebtToken: non-transferable");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        revert("DebtToken: non-transferable");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("DebtToken: non-transferable");
    }

    function allowance(
        address,
        address
    ) public pure override returns (uint256) {
        return 0;
    }

    // ============ View Functions ============

    /**
     * @notice Returns actual debt including accrued interest
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _scaledBalances[account].rayMul(variableBorrowIndex);
    }

    /**
     * @notice Returns scaled balance (constant)
     */
    function scaledBalanceOf(address account) external view returns (uint256) {
        return _scaledBalances[account];
    }

    /**
     * @notice Total debt including accrued interest
     */
    function totalSupply() public view override returns (uint256) {
        return _totalScaledSupply.rayMul(variableBorrowIndex);
    }

    /**
     * @notice Total scaled supply
     */
    function scaledTotalSupply() external view returns (uint256) {
        return _totalScaledSupply;
    }

    /**
     * @notice Get underlying asset
     */
    function getUnderlyingAsset() external view returns (address) {
        return UNDERLYING_ASSET;
    }

    /**
     * @notice Get current index
     */
    function getIndex() external view returns (uint256) {
        return variableBorrowIndex;
    }
}

/**
 * @title StableDebtToken
 * @notice Token representing stable rate debt obligations
 * @dev Similar to variable but with user-specific stable rates
 */
contract StableDebtToken is ERC20 {
    using WadRayMath for uint256;

    uint256 internal constant RAY = 1e27;

    address public immutable POOL;
    address public immutable UNDERLYING_ASSET;

    /// @notice User => stable rate at time of borrow
    mapping(address => uint256) public userStableRate;

    /// @notice User => timestamp of last update
    mapping(address => uint40) public userLastUpdateTimestamp;

    /// @notice Principal balance (without interest)
    mapping(address => uint256) internal _principalBalances;

    /// @notice Total principal
    uint256 internal _totalPrincipal;

    /// @notice Average stable rate across all borrowers
    uint256 public averageStableRate;

    /// @notice Timestamp of last average rate update
    uint40 public totalSupplyLastUpdated;

    /// @notice Credit delegation
    mapping(address => mapping(address => uint256)) public borrowAllowances;

    event Mint(
        address indexed user,
        address indexed onBehalfOf,
        uint256 amount,
        uint256 currentBalance,
        uint256 balanceIncrease,
        uint256 newRate,
        uint256 avgStableRate,
        uint256 newTotalSupply
    );

    event Burn(
        address indexed from,
        uint256 amount,
        uint256 currentBalance,
        uint256 balanceIncrease,
        uint256 avgStableRate,
        uint256 newTotalSupply
    );

    modifier onlyPool() {
        require(msg.sender == POOL, "StableDebtToken: only pool");
        _;
    }

    constructor(
        address pool,
        address underlyingAsset,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        POOL = pool;
        UNDERLYING_ASSET = underlyingAsset;
        totalSupplyLastUpdated = uint40(block.timestamp);
    }

    /**
     * @notice Mint stable debt tokens
     * @param user Initiator
     * @param onBehalfOf Debt recipient
     * @param amount Amount borrowed
     * @param rate The stable rate for this borrow
     * @return True if first borrow, current balance with interest
     */
    function mint(
        address user,
        address onBehalfOf,
        uint256 amount,
        uint256 rate
    ) external onlyPool returns (bool, uint256) {
        if (user != onBehalfOf) {
            uint256 allowance = borrowAllowances[onBehalfOf][user];
            require(
                allowance >= amount,
                "StableDebtToken: insufficient delegation"
            );
            unchecked {
                borrowAllowances[onBehalfOf][user] = allowance - amount;
            }
        }

        // Calculate current balance with accrued interest
        (
            ,
            uint256 currentBalance,
            uint256 balanceIncrease
        ) = _calculateBalanceIncrease(onBehalfOf);

        uint256 previousPrincipal = _principalBalances[onBehalfOf];
        bool isFirstBorrow = previousPrincipal == 0;

        // Update user's rate (weighted average of old and new)
        uint256 newStableRate;
        if (currentBalance == 0) {
            newStableRate = rate;
        } else {
            newStableRate =
                (userStableRate[onBehalfOf] * currentBalance + rate * amount) /
                (currentBalance + amount);
        }

        // Update principal
        _principalBalances[onBehalfOf] = currentBalance + amount;
        userStableRate[onBehalfOf] = newStableRate;
        userLastUpdateTimestamp[onBehalfOf] = uint40(block.timestamp);

        // Update totals
        _updateTotalSupply(amount, 0);

        emit Mint(
            user,
            onBehalfOf,
            amount,
            currentBalance + amount,
            balanceIncrease,
            newStableRate,
            averageStableRate,
            _totalPrincipal
        );

        return (isFirstBorrow, currentBalance + amount);
    }

    /**
     * @notice Burn stable debt tokens on repayment
     */
    function burn(
        address from,
        uint256 amount
    ) external onlyPool returns (uint256) {
        (
            ,
            uint256 currentBalance,
            uint256 balanceIncrease
        ) = _calculateBalanceIncrease(from);

        require(
            currentBalance >= amount,
            "StableDebtToken: burn exceeds balance"
        );

        uint256 newPrincipal = currentBalance - amount;
        _principalBalances[from] = newPrincipal;

        if (newPrincipal == 0) {
            userStableRate[from] = 0;
        }

        userLastUpdateTimestamp[from] = uint40(block.timestamp);

        _updateTotalSupply(0, amount);

        emit Burn(
            from,
            amount,
            newPrincipal,
            balanceIncrease,
            averageStableRate,
            _totalPrincipal
        );

        return newPrincipal;
    }

    function _calculateBalanceIncrease(
        address user
    ) internal view returns (uint256, uint256, uint256) {
        uint256 principal = _principalBalances[user];
        if (principal == 0) return (0, 0, 0);

        uint256 rate = userStableRate[user];
        uint256 lastUpdate = userLastUpdateTimestamp[user];

        // Calculate compound interest
        uint256 timeDelta = block.timestamp - lastUpdate;
        uint256 interest = (principal * rate * timeDelta) / (365 days * RAY);

        uint256 currentBalance = principal + interest;

        return (principal, currentBalance, interest);
    }

    function _updateTotalSupply(
        uint256 amountAdded,
        uint256 amountRemoved
    ) internal {
        uint256 currentTotal = totalSupply();
        uint256 newTotal = currentTotal + amountAdded - amountRemoved;

        _totalPrincipal = newTotal;
        totalSupplyLastUpdated = uint40(block.timestamp);
    }

    function balanceOf(address account) public view override returns (uint256) {
        (, uint256 currentBalance, ) = _calculateBalanceIncrease(account);
        return currentBalance;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalPrincipal;
    }

    function principalBalanceOf(
        address account
    ) external view returns (uint256) {
        return _principalBalances[account];
    }

    function getAverageStableRate() external view returns (uint256) {
        return averageStableRate;
    }

    function getUserStableRate(address user) external view returns (uint256) {
        return userStableRate[user];
    }

    function approveDelegation(address delegatee, uint256 amount) external {
        borrowAllowances[msg.sender][delegatee] = amount;
    }

    // Non-transferable
    function transfer(address, uint256) public pure override returns (bool) {
        revert("StableDebtToken: non-transferable");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        revert("StableDebtToken: non-transferable");
    }
}
