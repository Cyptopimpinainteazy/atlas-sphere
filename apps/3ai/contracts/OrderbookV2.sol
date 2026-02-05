// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OrderbookV2 is ReentrancyGuard, Ownable {
    enum OrderType { MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT }
    enum OrderStatus { ACTIVE, FILLED, CANCELLED, PARTIALLY_FILLED }
    
    struct Order {
        uint256 id;
        address maker;
        uint256 price;          // In wei for ETH, or scaled amount for tokens
        uint256 amount;         // Total order amount
        uint256 filledAmount;    // Amount already filled
        OrderType orderType;
        OrderStatus status;
        address baseToken;       // Address(0) for ETH, ERC20 address for tokens
        address quoteToken;      // Address(0) for ETH, ERC20 address for tokens
        uint256 createdAt;
        uint256 expiresAt;       // 0 for never expire
    }

    // Fee configuration
    struct FeeConfig {
        uint256 makerFee;        // Basis points (1/100 of a percent)
        uint256 takerFee;        // Basis points (1/100 of a percent)
        address feeRecipient;    // Address to receive fees
    }

    uint256 public orderIdCounter;
    mapping(uint256 => Order) public orders;
    mapping(address => mapping(address => uint256[])) public userOrders;
    mapping(address => mapping(address => uint256)) public bestBid;
    mapping(address => mapping(address => uint256)) public bestAsk;
    
    // Fee configuration
    FeeConfig public feeConfig;
    
    // Events with more detailed information
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        uint256 price,
        uint256 amount,
        OrderType orderType,
        address baseToken,
        address quoteToken
    );
    
    event OrderCancelled(uint256 indexed orderId, address indexed maker);
    event OrderFilled(
        uint256 indexed orderId,
        uint256 indexed matchedOrderId,
        uint256 filledAmount,
        uint256 price,
        uint256 feePaid
    );
    event FeeCollected(address indexed token, uint256 amount);

    constructor(address _feeRecipient) Ownable() {
        // Initialize with default fee of 0.3% for both maker and taker
        feeConfig = FeeConfig({
            makerFee: 3,  // 0.03%
            takerFee: 3,  // 0.03%
            feeRecipient: _feeRecipient
        });
    }

    function updateFeeConfig(uint256 _makerFee, uint256 _takerFee, address _feeRecipient) external onlyOwner {
        require(_makerFee <= 100, "Maker fee too high");  // Max 1%
        require(_takerFee <= 100, "Taker fee too high");  // Max 1%
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        feeConfig = FeeConfig({
            makerFee: _makerFee,
            takerFee: _takerFee,
            feeRecipient: _feeRecipient
        });
    }

    function placeOrder(
        uint256 price,
        uint256 amount,
        bool isBuy,
        address baseToken,
        address quoteToken,
        OrderType orderType,
        uint256 expiresIn
    ) external payable nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(price > 0 || orderType == OrderType.MARKET, "Price must be > 0 for non-market orders");
        require(baseToken != quoteToken, "Base and quote tokens must be different");

        uint256 orderId = ++orderIdCounter;
        uint256 expiresAt = expiresIn > 0 ? block.timestamp + expiresIn : 0;
        
        // For market orders, use current best price if available
        if (orderType == OrderType.MARKET) {
            price = isBuy ? bestAsk[baseToken][quoteToken] : bestBid[baseToken][quoteToken];
            require(price > 0, "No liquidity available for market order");
        }

        // Handle token transfers based on order type
        if (isBuy) {
            uint256 totalCost = (price * amount) / 1e18;
            uint256 fee = (totalCost * feeConfig.takerFee) / 10000;
            uint256 totalToTransfer = totalCost + fee;
            
            if (quoteToken == address(0)) {
                require(msg.value >= totalToTransfer, "Insufficient ETH");
                // Refund excess ETH
                if (msg.value > totalToTransfer) {
                    payable(msg.sender).transfer(msg.value - totalToTransfer);
                }
            } else {
                IERC20(quoteToken).transferFrom(msg.sender, address(this), totalToTransfer);
            }
        } else {
            uint256 totalAmount = amount;
            uint256 fee = (totalAmount * feeConfig.makerFee) / 10000;
            
            if (baseToken == address(0)) {
                require(msg.value >= totalAmount + fee, "Insufficient ETH");
                // Refund excess ETH
                if (msg.value > totalAmount + fee) {
                    payable(msg.sender).transfer(msg.value - (totalAmount + fee));
                }
            } else {
                IERC20(baseToken).transferFrom(msg.sender, address(this), totalAmount + fee);
            }
        }

        // Create and store the order
        Order memory newOrder = Order({
            id: orderId,
            maker: msg.sender,
            price: price,
            amount: amount,
            filledAmount: 0,
            orderType: orderType,
            status: OrderStatus.ACTIVE,
            baseToken: baseToken,
            quoteToken: quoteToken,
            createdAt: block.timestamp,
            expiresAt: expiresAt
        });
        
        orders[orderId] = newOrder;
        userOrders[msg.sender][baseToken].push(orderId);

        // Update best prices for limit orders
        if (orderType == OrderType.LIMIT) {
            if (isBuy) {
                if (bestBid[baseToken][quoteToken] == 0 || price > bestBid[baseToken][quoteToken]) {
                    bestBid[baseToken][quoteToken] = price;
                }
            } else {
                if (bestAsk[baseToken][quoteToken] == 0 || price < bestAsk[baseToken][quoteToken]) {
                    bestAsk[baseToken][quoteToken] = price;
                }
            }
        }

        emit OrderPlaced(orderId, msg.sender, price, amount, orderType, baseToken, quoteToken);
        return orderId;
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "Only maker can cancel");
        require(order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED, "Order not active");
        require(order.expiresAt == 0 || block.timestamp < order.expiresAt, "Order already expired");

        order.status = OrderStatus.CANCELLED;

        // Refund remaining amount
        uint256 remainingAmount = order.amount - order.filledAmount;
        if (remainingAmount > 0) {
            if (order.orderType == OrderType.MARKET || order.orderType == OrderType.LIMIT) {
                if (order.orderType == OrderType.MARKET || order.orderType == OrderType.LIMIT) {
                    // For buy orders, refund the quote token
                    uint256 refundAmount = (order.price * remainingAmount) / 1e18;
                    _transfer(order.quoteToken, order.maker, refundAmount);
                } else {
                    // For sell orders, refund the base token
                    _transfer(order.baseToken, order.maker, remainingAmount);
                }
            }
        }

        emit OrderCancelled(orderId, msg.sender);
    }

    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external nonReentrant {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];

        require(buyOrder.status == OrderStatus.ACTIVE || buyOrder.status == OrderStatus.PARTIALLY_FILLED, "Buy order not active");
        require(sellOrder.status == OrderStatus.ACTIVE || sellOrder.status == OrderStatus.PARTIALLY_FILLED, "Sell order not active");
        require(buyOrder.orderType != OrderType.STOP_LOSS && buyOrder.orderType != OrderType.TAKE_PROFIT, "Complex orders must be matched through the contract");
        require(sellOrder.orderType != OrderType.STOP_LOSS && sellOrder.orderType != OrderType.TAKE_PROFIT, "Complex orders must be matched through the contract");
        require(buyOrder.baseToken == sellOrder.baseToken && buyOrder.quoteToken == sellOrder.quoteToken, "Token pairs must match");
        require(buyOrder.price >= sellOrder.price, "Prices don't allow matching");

        uint256 buyRemaining = buyOrder.amount - buyOrder.filledAmount;
        uint256 sellRemaining = sellOrder.amount - sellOrder.filledAmount;
        uint256 fillAmount = buyRemaining < sellRemaining ? buyRemaining : sellRemaining;
        
        // Calculate execution price (weighted average for partial fills)
        uint256 executionPrice = (buyOrder.price + sellOrder.price) / 2;
        
        // Calculate fees
        uint256 tradeValue = (executionPrice * fillAmount) / 1e18;
        uint256 makerFee = (tradeValue * feeConfig.makerFee) / 10000;
        uint256 takerFee = (tradeValue * feeConfig.takerFee) / 10000;
        
        // Execute the trade
        _transfer(sellOrder.baseToken, buyOrder.maker, fillAmount);
        _transfer(buyOrder.quoteToken, sellOrder.maker, tradeValue - takerFee);
        
        // Collect fees
        if (makerFee > 0) {
            _transfer(sellOrder.quoteToken, feeConfig.feeRecipient, makerFee);
            emit FeeCollected(sellOrder.quoteToken, makerFee);
        }
        if (takerFee > 0) {
            _transfer(buyOrder.quoteToken, feeConfig.feeRecipient, takerFee);
            emit FeeCollected(buyOrder.quoteToken, takerFee);
        }

        // Update order statuses
        _updateOrderFill(buyOrder, fillAmount);
        _updateOrderFill(sellOrder, fillAmount);

        emit OrderFilled(
            buyOrderId,
            sellOrderId,
            fillAmount,
            executionPrice,
            takerFee + makerFee
        );
    }

    // Internal helper functions
    function _updateOrderFill(Order storage order, uint256 fillAmount) internal {
        order.filledAmount += fillAmount;
        
        if (order.filledAmount == order.amount) {
            order.status = OrderStatus.FILLED;
        } else {
            order.status = OrderStatus.PARTIALLY_FILLED;
        }
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    // View functions
    function getOrder(uint256 orderId) external view returns (
        uint256 id,
        address maker,
        uint256 price,
        uint256 amount,
        uint256 filledAmount,
        OrderType orderType,
        OrderStatus status,
        address baseToken,
        address quoteToken,
        uint256 createdAt,
        uint256 expiresAt
    ) {
        Order storage order = orders[orderId];
        return (
            order.id,
            order.maker,
            order.price,
            order.amount,
            order.filledAmount,
            order.orderType,
            order.status,
            order.baseToken,
            order.quoteToken,
            order.createdAt,
            order.expiresAt
        );
    }

    function getBestPrices(address baseToken, address quoteToken) external view returns (uint256 bid, uint256 ask) {
        return (bestBid[baseToken][quoteToken], bestAsk[baseToken][quoteToken]);
    }
}
