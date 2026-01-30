// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Provenance {
    event Anchored(bytes32 indexed id, address indexed owner, string metadata);

    function anchor(bytes32 id, string calldata metadata) external {
        emit Anchored(id, msg.sender, metadata);
    }
}