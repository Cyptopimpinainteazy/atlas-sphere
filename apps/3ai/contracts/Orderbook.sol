// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Orderbook is ReentrancyGuard {
    struct Order {
        uint256 id;
        address maker;
        uint256 price;  // In wei for ETH, or scaled amount for tokens
        uint256 amount; // Amount to buy/sell
        bool isBuy;     // true for buy, false for sell
        bool active;
        address baseToken;  // Address(0) for ETH, ERC20 address for tokens
        address quoteToken; // Address(0) for ETH, ERC20 address for tokens
    }

    uint256 private orderIdCounter;
    mapping(uint256 => Order) public orders;
    mapping(address => mapping(address => uint256[])) public userOrders; // tokenPair to list of orderIds
    mapping(address => mapping(address => uint256)) public bestBid; // baseToken-quoteToken pair
    mapping(address => mapping(address => uint256)) public bestAsk;

    event OrderPlaced(uint256 indexed orderId, address indexed maker, uint256 price, uint256 amount, bool isBuy);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, uint256 indexed matchedOrderId, uint256 filledAmount);

    constructor() {}

    function placeOrder(
        uint256 price,
        uint256 amount,
        bool isBuy,
        address baseToken,
        address quoteToken
    ) external payable nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(price > 0, "Price must be > 0");
        require(baseToken != quoteToken, "Base and quote tokens must be different");

        uint256 orderId = ++orderIdCounter;

        if (isBuy) {
            // For buy orders, pay in quote token
            uint256 totalCost = price * amount / 1e18; // Assuming 18 decimals, adjust if needed
            if (quoteToken == address(0)) {
                require(msg.value >= totalCost, "Insufficient ETH");
            } else {
                IERC20(quoteToken).transferFrom(msg.sender, address(this), totalCost);
            }
        } else {
            // For sell orders, transfer base token
            if (baseToken == address(0)) {
                require(msg.value >= amount, "Insufficient ETH");
            } else {
                IERC20(baseToken).transferFrom(msg.sender, address(this), amount);
            }
        }

        orders[orderId] = Order({
            id: orderId,
            maker: msg.sender,
            price: price,
            amount: amount,
            isBuy: isBuy,
            active: true,
            baseToken: baseToken,
            quoteToken: quoteToken
        });

        userOrders[baseToken][quoteToken].push(orderId);

        // Update best prices
        if (isBuy) {
            if (bestBid[baseToken][quoteToken] == 0 || price > bestBid[baseToken][quoteToken]) {
                bestBid[baseToken][quoteToken] = price;
            }
        } else {
            if (bestAsk[baseToken][quoteToken] == 0 || price < bestAsk[baseToken][quoteToken]) {
                bestAsk[baseToken][quoteToken] = price;
            }
        }

        emit OrderPlaced(orderId, msg.sender, price, amount, isBuy);
    }

    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "Only maker can cancel");
        require(order.active, "Order not active");

        order.active = false;

        // Remove from user orders
        uint256[] storage userOrderList = userOrders[order.baseToken][order.quoteToken];
        for (uint256 i = 0; i < userOrderList.length; i++) {
            if (userOrderList[i] == orderId) {
                userOrderList[i] = userOrderList[userOrderList.length - 1];
                userOrderList.pop();
                break;
            }
        }

        // Refund tokens
        if (order.isBuy) {
            uint256 refundAmount = order.price * order.amount / 1e18;
            if (order.quoteToken == address(0)) {
                payable(order.maker).transfer(refundAmount);
            } else {
                IERC20(order.quoteToken).transfer(order.maker, refundAmount);
            }
        } else {
            if (order.baseToken == address(0)) {
                payable(order.maker).transfer(order.amount);
            } else {
                IERC20(order.baseToken).transfer(order.maker, order.amount);
            }
        }

        emit OrderCancelled(orderId);
    }

    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external nonReentrant {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];

        require(buyOrder.active && sellOrder.active, "Orders must be active");
        require(buyOrder.isBuy && !sellOrder.isBuy, "Must be buy and sell pair");
        require(buyOrder.price >= sellOrder.price, "Prices don't allow matching");
        require(buyOrder.baseToken == sellOrder.baseToken && buyOrder.quoteToken == sellOrder.quoteToken, "Token pairs must match");

        uint256 fillAmount = buyOrder.amount < sellOrder.amount ? buyOrder.amount : sellOrder.amount;

        // Execute transfer
        if (buyOrder.baseToken == address(0)) {
            payable(sellOrder.maker).transfer(fillAmount); // ETH to seller
        } else {
            IERC20(buyOrder.baseToken).transfer(sellOrder.maker, fillAmount);
        }

        uint256 paymentAmount = sellOrder.price * fillAmount / 1e18;
        if (sellOrder.quoteToken == address(0)) {
            payable(buyOrder.maker).transfer(paymentAmount); // ETH to buyer
        } else {
            IERC20(sellOrder.quoteToken).transfer(buyOrder.maker, paymentAmount);
        }

        // Update orders
        if (fillAmount == buyOrder.amount) {
            buyOrder.active = false;
            _removeFromUserOrders(buyOrderId, buyOrder.baseToken, buyOrder.quoteToken);
        } else {
            buyOrder.amount -= fillAmount;
        }

        if (fillAmount == sellOrder.amount) {
            sellOrder.active = false;
            _removeFromUserOrders(sellOrderId, sellOrder.baseToken, sellOrder.quoteToken);
        } else {
            sellOrder.amount -= fillAmount;
        }

        emit OrderFilled(buyOrderId, sellOrderId, fillAmount);
    }

    function _removeFromUserOrders(uint256 orderId, address baseToken, address quoteToken) private {
        uint256[] storage userOrderList = userOrders[baseToken][quoteToken];
        for (uint256 i = 0; i < userOrderList.length; i++) {
            if (userOrderList[i] == orderId) {
                userOrderList[i] = userOrderList[userOrderList.length - 1];
                userOrderList.pop();
                break;
            }
        }
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getBestPrices(address baseToken, address quoteToken) external view returns (uint256 bid, uint256 ask) {
        return (bestBid[baseToken][quoteToken], bestAsk[baseToken][quoteToken]);
    }
}
