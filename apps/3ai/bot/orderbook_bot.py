#!/usr/bin/env python3
"""
3ai Chain Orderbook Bot
Automated trading bot that places orders, monitors the orderbook,
and matches trades on your custom EVM chain.
"""

import os
import time
from decimal import Decimal
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Chain configuration
RPC_URL = os.getenv('RPC_URL', 'http://localhost:8545')  # OP Stack devnet
PRIVATE_KEY = os.getenv('PRIVATE_KEY')  # Your account private key
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')  # Deployed orderbook address

# Token addresses (use Address(0) for ETH)
ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
# Example ERC20 tokens (deploy your own)
BASE_TOKEN = os.getenv('BASE_TOKEN', ETH_ADDRESS)
QUOTE_TOKEN = os.getenv('QUOTE_TOKEN', ETH_ADDRESS)

# ABI for Orderbook contract (minimal)
ORDERBOOK_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "price", "type": "uint256"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "bool", "name": "isBuy", "type": "bool"},
            {"internalType": "address", "name": "baseToken", "type": "address"},
            {"internalType": "address", "name": "quoteToken", "type": "address"}
        ],
        "name": "placeOrder",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "buyOrderId", "type": "uint256"},
            {"internalType": "uint256", "name": "sellOrderId", "type": "uint256"}
        ],
        "name": "matchOrders",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "baseToken", "type": "address"},
            {"internalType": "address", "name": "quoteToken", "type": "address"}
        ],
        "name": "getBestPrices",
        "outputs": [
            {"internalType": "uint256", "name": "bid", "type": "uint256"},
            {"internalType": "uint256", "name": "ask", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "orderIdCounter",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# ERC20 ABI for token approvals
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]

class OrderbookBot:
    def __init__(self):
        self.web3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not self.web3.is_connected():
            raise Exception("Cannot connect to RPC")

        self.account = Account.from_key(PRIVATE_KEY)
        self.contract = self.web3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT_ADDRESS),
            abi=ORDERBOOK_ABI
        )
        print(f"Connected to chain. Account: {self.account.address}")

    def place_order(self, price, amount, is_buy=True):
        """Place a limit order"""
        print(f"Placing {'buy' if is_buy else 'sell'} order: {amount} @ {price}")

        # Approve tokens if needed
        if not is_buy and BASE_TOKEN != ETH_ADDRESS:
            self._approve_token(BASE_TOKEN, amount)
        elif is_buy and QUOTE_TOKEN != ETH_ADDRESS:
            total_cost = int(Decimal(str(price)) * Decimal(str(amount)))
            self._approve_token(QUOTE_TOKEN, total_cost)

        # Build transaction
        tx_data = {
            'from': self.account.address,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.web3.eth.gas_price
        }

        # Add value for ETH transfers
        if (not is_buy and BASE_TOKEN == ETH_ADDRESS) or (is_buy and QUOTE_TOKEN == ETH_ADDRESS):
            if is_buy:
                total_cost = int(Decimal(str(price)) * Decimal(str(amount)))
                tx_data['value'] = total_cost
            else:
                tx_data['value'] = amount

        # Estimate gas
        try:
            gas_estimate = self.contract.functions.placeOrder(
                int(Decimal(str(price)) * Decimal('1e18')),  # Convert to wei
                amount,
                is_buy,
                Web3.to_checksum_address(BASE_TOKEN),
                Web3.to_checksum_address(QUOTE_TOKEN)
            ).estimate_gas(tx_data)
            tx_data['gas'] = int(gas_estimate * 1.2)  # Add 20% buffer
        except Exception as e:
            print(f"Gas estimation failed: {e}")
            tx_data['gas'] = 500000

        # Send transaction
        tx = self.contract.functions.placeOrder(
            int(Decimal(str(price)) * Decimal('1e18')),
            amount,
            is_buy,
            Web3.to_checksum_address(BASE_TOKEN),
            Web3.to_checksum_address(QUOTE_TOKEN)
        ).build_transaction(tx_data)

        signed_tx = self.web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Order placed. TX: {tx_hash.hex()}")

        return tx_hash

    def match_orders(self, buy_order_id, sell_order_id):
        """Match two orders"""
        print(f"Matching orders: {buy_order_id} and {sell_order_id}")

        tx_data = {
            'from': self.account.address,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.web3.eth.gas_price,
            'gas': 300000
        }

        tx = self.contract.functions.matchOrders(
            buy_order_id, sell_order_id
        ).build_transaction(tx_data)

        signed_tx = self.web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Orders matched. TX: {tx_hash.hex()}")

        return tx_hash

    def get_best_prices(self):
        """Get current best bid/ask"""
        bid, ask = self.contract.functions.getBestPrices(
            Web3.to_checksum_address(BASE_TOKEN),
            Web3.to_checksum_address(QUOTE_TOKEN)
        ).call()

        return Decimal(str(bid)) / Decimal('1e18'), Decimal(str(ask)) / Decimal('1e18')

    def _approve_token(self, token_address, amount):
        """Approve token spending"""
        token_contract = self.web3.eth.contract(
            address=Web3.to_checksum_address(token_address),
            abi=ERC20_ABI
        )

        tx_data = {
            'from': self.account.address,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.web3.eth.gas_price,
            'gas': 100000
        }

        tx = token_contract.functions.approve(
            CONTRACT_ADDRESS, amount
        ).build_transaction(tx_data)

        signed_tx = self.web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Token approved. TX: {tx_hash.hex()}")

        # Wait for confirmation
        self.web3.eth.wait_for_transaction_receipt(tx_hash)

def main():
    bot = OrderbookBot()

    while True:
        try:
            # Get current prices
            bid, ask = bot.get_best_prices()
            print(f"Best Bid: {bid}, Best Ask: {ask}")

            # Example strategy: Place buy order 1% below best bid
            if bid > 0:
                buy_price = bid * Decimal('0.99')
                bot.place_order(float(buy_price), 1000000000000000000, is_buy=True)  # 1 token

            # Place sell order 1% above best ask
            if ask > 0:
                sell_price = ask * Decimal('1.01')
                bot.place_order(float(sell_price), 1000000000000000000, is_buy=False)  # 1 token

            # Sleep before next cycle
            time.sleep(30)

        except Exception as e:
            print(f"Error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    main()
