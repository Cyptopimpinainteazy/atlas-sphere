// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter counter;
    address deployer = address(0xDeAdBeef);

    function setUp() public {
        vm.prank(deployer);
        counter = new Counter();
    }

    function testInitialCountIsZero() public {
        uint256 c = counter.getCount();
        assertEq(c, 0);
        assertEq(counter.owner(), deployer);
    }

    function testIncrementAndDecrement() public {
        vm.prank(deployer);
        uint256 v1 = counter.increment();
        assertEq(v1, 1);
        assertEq(counter.getCount(), 1);

        vm.prank(deployer);
        uint256 v2 = counter.increment();
        assertEq(v2, 2);
        assertEq(counter.getCount(), 2);

        vm.prank(deployer);
        uint256 v3 = counter.decrement();
        assertEq(v3, 1);
        assertEq(counter.getCount(), 1);
    }

    function testOnlyOwnerCanReset() public {
        // non-owner cannot reset
        address attacker = address(0xBEEF);
        vm.prank(attacker);
        vm.expectRevert(bytes("Only owner"));
        counter.reset();

        // owner can reset
        vm.prank(deployer);
        counter.reset();
        assertEq(counter.getCount(), 0);
    }
}
