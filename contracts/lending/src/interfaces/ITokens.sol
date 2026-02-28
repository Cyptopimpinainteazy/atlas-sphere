// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IAToken
 * @notice Interest-bearing token representing deposits
 * @dev Balance increases over time based on liquidity rate
 */
interface IAToken is IERC20 {
    /**
     * @notice Mints aTokens to a user
     * @param caller The caller address (pool)
     * @param onBehalfOf The recipient
     * @param amount The amount of underlying to deposit
     * @param index Current liquidity index
     * @return True if the previous balance was 0
     */
    function mint(
        address caller,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external returns (bool);
    
    /**
     * @notice Burns aTokens from user and sends underlying
     * @param from The owner of aTokens
     * @param receiverOfUnderlying Where to send underlying
     * @param amount Amount of underlying to withdraw
     * @param index Current liquidity index
     */
    function burn(
        address from,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external;
    
    /**
     * @notice Mints aTokens to the treasury
     * @param amount The amount to mint
     * @param index Current liquidity index
     */
    function mintToTreasury(uint256 amount, uint256 index) external;
    
    /**
     * @notice Transfers underlying to target
     * @param target Where to send underlying
     * @param amount Amount to transfer
     */
    function transferUnderlyingTo(address target, uint256 amount) external;
    
    /**
     * @notice Handle repayment transferring underlying from user
     * @param user The user repaying
     * @param onBehalfOf The debt holder
     * @param amount Amount to repay
     */
    function handleRepayment(
        address user,
        address onBehalfOf,
        uint256 amount
    ) external;
    
    /**
     * @notice Returns the scaled balance of a user
     * @dev scaledBalance = balance / liquidityIndex
     */
    function scaledBalanceOf(address user) external view returns (uint256);
    
    /**
     * @notice Returns the scaled total supply
     */
    function scaledTotalSupply() external view returns (uint256);
    
    /**
     * @notice Returns the underlying asset address
     */
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
    
    /**
     * @notice Returns the pool address
     */
    function POOL() external view returns (address);
}

/**
 * @title IDebtToken
 * @notice Base debt token interface (common to stable and variable)
 */
interface IDebtToken is IERC20 {
    /**
     * @notice Mints debt tokens
     * @param user The borrower
     * @param onBehalfOf The address receiving the debt
     * @param amount Amount to mint
     * @param index Current debt index
     * @return True if first borrow, scaled amount
     */
    function mint(
        address user,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external returns (bool, uint256);
    
    /**
     * @notice Burns debt tokens
     * @param from The debt holder
     * @param amount Amount to burn
     * @param index Current debt index
     * @return Scaled amount burned
     */
    function burn(
        address from,
        uint256 amount,
        uint256 index
    ) external returns (uint256);
    
    /**
     * @notice Returns the principal balance (excluding interest)
     */
    function principalBalanceOf(address user) external view returns (uint256);
    
    /**
     * @notice Returns the scaled balance
     */
    function scaledBalanceOf(address user) external view returns (uint256);
    
    /**
     * @notice Returns the scaled total supply
     */
    function scaledTotalSupply() external view returns (uint256);
    
    /**
     * @notice Returns the underlying asset
     */
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

/**
 * @title IVariableDebtToken
 * @notice Variable rate debt token interface
 */
interface IVariableDebtToken is IDebtToken {
    // Variable debt uses base IDebtToken interface
}

/**
 * @title IStableDebtToken
 * @notice Stable rate debt token interface
 */
interface IStableDebtToken is IDebtToken {
    /**
     * @notice Returns the average stable rate
     */
    function getAverageStableRate() external view returns (uint256);
    
    /**
     * @notice Returns the stable rate for a user
     */
    function getUserStableRate(address user) external view returns (uint256);
    
    /**
     * @notice Returns the timestamp of last update for user
     */
    function getUserLastUpdated(address user) external view returns (uint40);
    
    /**
     * @notice Returns total supply and average rate
     */
    function getTotalSupplyAndAvgRate() external view returns (uint256, uint256);
    
    /**
     * @notice Returns the timestamp of total supply last update
     */
    function getTotalSupplyLastUpdated() external view returns (uint40);
}
