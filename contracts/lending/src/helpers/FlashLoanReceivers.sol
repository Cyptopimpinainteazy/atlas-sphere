// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IFlashLoanReceiver
 * @notice Interface for flash loan receiver contracts
 */
interface IFlashLoanReceiver {
    /**
     * @notice Callback for flash loan execution
     * @param assets Array of borrowed assets
     * @param amounts Array of borrowed amounts
     * @param premiums Array of premiums (fees) to pay
     * @param initiator Address that initiated the flash loan
     * @param params Arbitrary params passed to flash loan
     * @return True if operation succeeded
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title FlashLoanReceiverBase
 * @notice Base contract for flash loan receivers
 * @dev Implement executeOperation with your strategy
 *
 * Example use cases:
 * - Arbitrage between DEXes
 * - Collateral swaps
 * - Debt refinancing
 * - Liquidation bots
 * - Self-liquidation
 */
abstract contract FlashLoanReceiverBase is IFlashLoanReceiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The lending pool
    address public immutable POOL;

    /// @notice ADDRESSES_PROVIDER for access control
    address public immutable ADDRESSES_PROVIDER;

    constructor(address pool, address addressesProvider) {
        POOL = pool;
        ADDRESSES_PROVIDER = addressesProvider;
    }

    /**
     * @notice Callback implementation
     * @dev Override _executeOperation for your logic
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override nonReentrant returns (bool) {
        require(msg.sender == POOL, "FlashLoan: caller not pool");

        // Execute strategy
        bool success = _executeOperation(
            assets,
            amounts,
            premiums,
            initiator,
            params
        );

        require(success, "FlashLoan: operation failed");

        // Approve repayment
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            IERC20(assets[i]).safeApprove(POOL, amountOwed);
        }

        return true;
    }

    /**
     * @notice Override this with your flash loan logic
     */
    function _executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) internal virtual returns (bool);
}

/**
 * @title ArbitrageFlashLoan
 * @notice Example flash loan receiver for DEX arbitrage
 */
contract ArbitrageFlashLoan is FlashLoanReceiverBase {
    using SafeERC20 for IERC20;

    struct ArbitrageParams {
        address tokenIn;
        address tokenOut;
        address dexA; // Buy on this DEX
        address dexB; // Sell on this DEX
        uint256 minProfit;
        bytes swapDataA; // Calldata for first swap
        bytes swapDataB; // Calldata for second swap
    }

    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 profit
    );

    constructor(
        address pool,
        address addressesProvider
    ) FlashLoanReceiverBase(pool, addressesProvider) {}

    function _executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address /* initiator */,
        bytes calldata params
    ) internal override returns (bool) {
        require(assets.length == 1, "Arb: single asset only");

        ArbitrageParams memory arb = abi.decode(params, (ArbitrageParams));

        uint256 initialBalance = IERC20(arb.tokenIn).balanceOf(address(this));

        // Step 1: Swap on DEX A (buy tokenOut)
        IERC20(arb.tokenIn).safeApprove(arb.dexA, amounts[0]);
        (bool successA, ) = arb.dexA.call(arb.swapDataA);
        require(successA, "Arb: DEX A swap failed");

        // Step 2: Swap on DEX B (sell tokenOut for tokenIn)
        uint256 tokenOutBalance = IERC20(arb.tokenOut).balanceOf(address(this));
        IERC20(arb.tokenOut).safeApprove(arb.dexB, tokenOutBalance);
        (bool successB, ) = arb.dexB.call(arb.swapDataB);
        require(successB, "Arb: DEX B swap failed");

        // Step 3: Calculate profit
        uint256 finalBalance = IERC20(arb.tokenIn).balanceOf(address(this));
        uint256 amountOwed = amounts[0] + premiums[0];

        require(finalBalance >= amountOwed, "Arb: not profitable");

        uint256 profit = finalBalance - amountOwed;
        require(profit >= arb.minProfit, "Arb: profit below minimum");

        emit ArbitrageExecuted(arb.tokenIn, arb.tokenOut, profit);

        return true;
    }

    /**
     * @notice Withdraw profits
     */
    function withdrawProfits(address token, address to) external {
        // Add access control in production
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, balance);
    }
}

/**
 * @title LiquidationFlashLoan
 * @notice Flash loan receiver for liquidating underwater positions
 * @dev Borrows debt asset, liquidates position, receives collateral, sells for profit
 */
contract LiquidationFlashLoan is FlashLoanReceiverBase {
    using SafeERC20 for IERC20;

    struct LiquidationParams {
        address collateralAsset;
        address debtAsset;
        address user; // User to liquidate
        uint256 debtToCover;
        bool receiveAToken;
        address dex; // DEX to swap collateral
        bytes swapData; // Calldata for swap
        uint256 minProfit;
    }

    event LiquidationExecuted(
        address indexed user,
        address indexed collateralAsset,
        address indexed debtAsset,
        uint256 profit
    );

    constructor(
        address pool,
        address addressesProvider
    ) FlashLoanReceiverBase(pool, addressesProvider) {}

    function _executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address /* initiator */,
        bytes calldata params
    ) internal override returns (bool) {
        LiquidationParams memory liq = abi.decode(params, (LiquidationParams));

        require(assets[0] == liq.debtAsset, "Liq: wrong asset");

        // Step 1: Approve pool to spend debt asset
        IERC20(liq.debtAsset).safeApprove(POOL, amounts[0]);

        // Step 2: Execute liquidation
        // In production: IPool(POOL).liquidationCall(...)
        // This is a simplified version
        _executeLiquidation(liq);

        // Step 3: Swap received collateral back to debt asset
        uint256 collateralReceived = IERC20(liq.collateralAsset).balanceOf(
            address(this)
        );

        if (liq.collateralAsset != liq.debtAsset && collateralReceived > 0) {
            IERC20(liq.collateralAsset).safeApprove(
                liq.dex,
                collateralReceived
            );
            (bool success, ) = liq.dex.call(liq.swapData);
            require(success, "Liq: swap failed");
        }

        // Step 4: Verify profit
        uint256 debtBalance = IERC20(liq.debtAsset).balanceOf(address(this));
        uint256 amountOwed = amounts[0] + premiums[0];

        require(debtBalance >= amountOwed, "Liq: not enough to repay");

        uint256 profit = debtBalance - amountOwed;
        require(profit >= liq.minProfit, "Liq: profit below minimum");

        emit LiquidationExecuted(
            liq.user,
            liq.collateralAsset,
            liq.debtAsset,
            profit
        );

        return true;
    }

    function _executeLiquidation(LiquidationParams memory liq) internal {
        // Call pool's liquidationCall
        // IPool(POOL).liquidationCall(
        //     liq.collateralAsset,
        //     liq.debtAsset,
        //     liq.user,
        //     liq.debtToCover,
        //     liq.receiveAToken
        // );

        // Placeholder - in production, use actual pool interface
        (bool success, ) = POOL.call(
            abi.encodeWithSignature(
                "liquidationCall(address,address,address,uint256,bool)",
                liq.collateralAsset,
                liq.debtAsset,
                liq.user,
                liq.debtToCover,
                liq.receiveAToken
            )
        );
        require(success, "Liq: liquidation failed");
    }

    function withdrawProfits(address token, address to) external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, balance);
    }
}

/**
 * @title CollateralSwapFlashLoan
 * @notice Swap collateral without closing debt position
 */
contract CollateralSwapFlashLoan is FlashLoanReceiverBase {
    using SafeERC20 for IERC20;

    struct SwapParams {
        address fromCollateral;
        address toCollateral;
        uint256 amountToSwap;
        address dex;
        bytes swapData;
        uint256 minReceived;
    }

    constructor(
        address pool,
        address addressesProvider
    ) FlashLoanReceiverBase(pool, addressesProvider) {}

    function _executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata /* premiums */,
        address initiator,
        bytes calldata params
    ) internal override returns (bool) {
        SwapParams memory swap = abi.decode(params, (SwapParams));

        // 1. Withdraw original collateral
        // IPool(POOL).withdraw(swap.fromCollateral, swap.amountToSwap, address(this));

        // 2. Swap collateral
        IERC20(swap.fromCollateral).safeApprove(swap.dex, swap.amountToSwap);
        (bool success, ) = swap.dex.call(swap.swapData);
        require(success, "Swap: DEX failed");

        // 3. Verify received amount
        uint256 received = IERC20(swap.toCollateral).balanceOf(address(this));
        require(received >= swap.minReceived, "Swap: slippage too high");

        // 4. Deposit new collateral
        IERC20(swap.toCollateral).safeApprove(POOL, received);
        // IPool(POOL).deposit(swap.toCollateral, received, initiator, 0);

        return true;
    }
}
