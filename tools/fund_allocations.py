"""Fund a deployed RewardDistributor with allocations from DB (allocations table)

Usage examples:
  # local eth-tester flow (no args)
  python tools/fund_allocations.py --use-eth-tester

  # remote chain
  python tools/fund_allocations.py --rpc https://rpc.testnet.example --private-key 0x... --distributor 0xabc --token 0xdef

This script will:
 - read allocations from DB (allocations table)
 - deploy MockToken and RewardDistributor if needed
 - transfer total tokens to distributor
 - call setAllocations with (addresses, amounts)

This is a convenience helper for testnet/dev usage. Use with care on mainnet.
"""
import argparse
import json
import os
from typing import Optional
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
import solcx
from swarm.db import SessionLocal, models


def load_allocations():
    session = SessionLocal()
    try:
        allocs = session.query(models.Allocation).all()
        result = {}
        for alloc in allocs:
            result[alloc.contributor_id] = alloc.amount
        return result
    finally:
        session.close()


def compile_contract(source_path, contract_name):
    with open(source_path, 'r') as fh:
        src = fh.read()
    solcx.install_solc('0.8.17')
    compiled = solcx.compile_standard({
        'language': 'Solidity',
        'sources': {os.path.basename(source_path): {'content': src}},
        'settings': {'outputSelection': {'*': {'*': ['abi','evm.bytecode']}}}
    }, solc_version='0.8.17')
    cont = compiled['contracts'][os.path.basename(source_path)][contract_name]
    return cont['abi'], cont['evm']['bytecode']['object']


def deploy_token_and_distributor(w3: Web3, acct=None, abi_rd: Optional[list] = None, bc_rd: Optional[str] = None):
    # Deploy MockToken then RewardDistributor
    token_source = '''
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.17;
    contract MockToken {
        string public name = "MockToken";
        string public symbol = "MTK";
        uint8 public decimals = 18;
        mapping(address => uint256) public balanceOf;
        constructor() { balanceOf[msg.sender] = 1000000 ether; }
        function transfer(address to, uint256 amount) external returns (bool) {
            require(balanceOf[msg.sender] >= amount, "insufficient");
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
            return true;
        }
        function transferFrom(address from, address to, uint256 amount) external returns (bool) { 
            require(balanceOf[from] >= amount, "insufficient");
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            return true;
        }
    }
    '''
    solcx.install_solc('0.8.17')
    compiled = solcx.compile_standard({
        'language':'Solidity',
        'sources': {'MockToken.sol': {'content': token_source}},
        'settings': {'outputSelection': {'*': {'*': ['abi','evm.bytecode']}}}
    }, solc_version='0.8.17')
    token_cont = compiled['contracts']['MockToken.sol']['MockToken']
    abi_token = token_cont['abi']
    bytecode_token = token_cont['evm']['bytecode']['object']

    acct = acct or w3.eth.accounts[0]
    Token = w3.eth.contract(abi=abi_token, bytecode=bytecode_token)
    tx = Token.constructor().transact({'from': acct})
    r = w3.eth.wait_for_transaction_receipt(tx)
    token_addr = r.contractAddress

    # Use pre-compiled RewardDistributor if provided, otherwise compile it
    if abi_rd is None or bc_rd is None:
        abi_rd, bc_rd = compile_contract('swarm/ref_app/solidity/RewardDistributor.sol', 'RewardDistributor')
    RD = w3.eth.contract(abi=abi_rd, bytecode=bc_rd)
    tx2 = RD.constructor(token_addr).transact({'from': acct})
    r2 = w3.eth.wait_for_transaction_receipt(tx2)
    rd_addr = r2.contractAddress
    print(f"Deployed MockToken at {token_addr}, RewardDistributor at {rd_addr}")
    return acct, w3.eth.contract(address=token_addr, abi=abi_token), w3.eth.contract(address=rd_addr, abi=abi_rd)


def fund_allocations(rpc=None, private_key=None, distributor=None, token=None, threshold=None):
    # support eth-tester when rpc is None
    if rpc:
        w3 = Web3(Web3.HTTPProvider(rpc))
        # Add POA middleware for testnets
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        acct = w3.eth.account.from_key(private_key)
        sender = acct.address
    else:
        from web3.providers.eth_tester import EthereumTesterProvider
        provider = EthereumTesterProvider()
        w3 = Web3(provider)
        sender = w3.eth.accounts[0]
        acct = None  # deploy_token_and_distributor handles None by using w3.eth.accounts[0]

    # Compile RewardDistributor once at the start to avoid repeated compilations
    abi_rd, bc_rd = compile_contract('swarm/ref_app/solidity/RewardDistributor.sol', 'RewardDistributor')

    allocs = load_allocations()
    addresses = list(allocs.keys())
    amounts = list(allocs.values())

    # convert amounts to wei for consistency (assume token uses 18 decimals)
    amounts_wei = [int(a) for a in amounts]

    if not distributor or not token:
        # deploy_token_and_distributor handles acct=None by defaulting to w3.eth.accounts[0]
        acct_addr, token_contract, rd_contract = deploy_token_and_distributor(w3, acct=acct, abi_rd=abi_rd, bc_rd=bc_rd)
        distributor = rd_contract.address
        token = token_contract.address
    else:
        # attach to existing contracts using pre-compiled ABI
        rd_contract = w3.eth.contract(address=distributor, abi=abi_rd)
        # Create minimal token contract for transfer - full ABI not available for existing contracts
        min_abi = [
            {"constant":False,"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"}
        ]
        token_contract = w3.eth.contract(address=token, abi=min_abi)

    # transfer total tokens to distributor from sender
    total = sum(amounts_wei)
    print(f"Funding distributor {distributor} with total: {total}")
    
    if rpc:
        # build and sign transactions for remote provider
        raise RuntimeError("Remote RPC flow not implemented in helper; use eth-tester or extend script")
    else:
        # Use token_contract to transfer tokens (either from deploy or attached above)
        token_contract.functions.transfer(distributor, total).transact({'from': sender})
        # Use rd_contract to set allocations (either from deploy or attached above)
        rd_contract.functions.setAllocations(addresses, amounts_wei).transact({'from': sender})
        print("Allocations set on distributor")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--rpc', help='RPC URL (optional)')
    parser.add_argument('--private-key', help='Private key to sign transactions')
    parser.add_argument('--distributor', help='Existing distributor address')
    parser.add_argument('--token', help='Existing token address')
    args = parser.parse_args()
    fund_allocations(rpc=args.rpc, private_key=args.private_key, distributor=args.distributor, token=args.token)
