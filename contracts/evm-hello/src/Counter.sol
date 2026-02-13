// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Counter
 * @dev Minimal contract used by integration tests / demo of EVM compatibility
 */
contract Counter {
    uint256 private count;
    address public owner;

    event CounterIncremented(uint256 newCount, address indexed sender);
    event CounterDecremented(uint256 newCount, address indexed sender);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        count = 0;
    }

    function increment() external returns (uint256) {
        count += 1;
        emit CounterIncremented(count, msg.sender);
        return count;
    }

    function decrement() external returns (uint256) {
        require(count > 0, "Counter zero");
        count -= 1;
        emit CounterDecremented(count, msg.sender);
        return count;
    }

    function getCount() external view returns (uint256) {
        return count;
    }

    function reset() external onlyOwner {
        count = 0;
    }
}
