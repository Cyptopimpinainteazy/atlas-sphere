#!/usr/bin/env python3
"""
X3 Treasury Integration for Xeepy Twitter Automation
Automatically routes 50% of service revenue to X3 Treasury
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import sys

# Configuration
CONFIG_PATH = Path(__file__).parent / "x3_treasury_config.json"
LOG_PATH = Path(__file__).parent / "treasury_transactions.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("X3TreasuryIntegration")


class XeepyTreasuryIntegration:
    """Handles automatic revenue splitting for Xeepy automation services"""

    def __init__(self, config_path: Path = CONFIG_PATH):
        self.config = self._load_config(config_path)
        self.enabled = self.config.get("enabled", False)
        self.split_percentage = self.config.get("treasury_split_percentage", 50)
        self.services = self.config.get("monetization", {}).get("services", [])
        logger.info(f"Xeepy Treasury integration initialized (enabled={self.enabled}, split={self.split_percentage}%)")

    def _load_config(self, config_path: Path) -> Dict[str, Any]:
        """Load treasury configuration"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}

    def calculate_split(self, revenue: float, currency: str = "USD") -> tuple[float, float]:
        """Calculate operator and treasury splits"""
        if not self.enabled:
            return revenue, 0.0

        treasury_amount = revenue * (self.split_percentage / 100)
        operator_amount = revenue - treasury_amount

        logger.info(f"Split calculation: {revenue} {currency} -> Operator: {operator_amount}, Treasury: {treasury_amount}")
        return operator_amount, treasury_amount

    def route_to_treasury(
        self,
        amount: float,
        currency: str,
        chain: str,
        service: str,
        campaign_info: Dict[str, Any]
    ) -> bool:
        """Route treasury portion to X3 wallet"""
        if not self.enabled or amount <= 0:
            return False

        try:
            treasury_address = self.config["supported_chains"].get(
                chain.lower(),
                self.config["x3_treasury_address"]
            )

            transaction = {
                "timestamp": datetime.now().isoformat(),
                "amount": amount,
                "currency": currency,
                "chain": chain,
                "service": service,
                "treasury_address": treasury_address,
                "campaign_info": campaign_info,
                "type": "automation_revenue_split"
            }

            # Log transaction
            self._log_transaction(transaction)

            # TODO: Implement actual blockchain transaction
            # This would integrate with web3.py or solana-py
            logger.info(f"Treasury routing: {amount} {currency} on {chain} to {treasury_address}")

            return True

        except Exception as e:
            logger.error(f"Failed to route to treasury: {e}")
            return False

    def _log_transaction(self, transaction: Dict[str, Any]):
        """Log treasury transaction"""
        log_file = Path(self.config["transaction_logging"]["log_file"])
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(transaction) + "\n")
        except Exception as e:
            logger.error(f"Failed to log transaction: {e}")

    def process_service_revenue(
        self,
        revenue: float,
        currency: str,
        service_type: str,
        campaign_data: Dict[str, Any],
        chain: str = "ethereum"
    ) -> Dict[str, float]:
        """
        Process service revenue and split it

        Args:
            revenue: Total revenue amount
            currency: Currency symbol (USD, USDT, etc.)
            service_type: Service type (follower_growth, content_automation, etc.)
            campaign_data: Campaign metrics and information
            chain: Blockchain to use for treasury transfer

        Returns:
            Dictionary with 'operator' and 'treasury' amounts
        """
        operator_amount, treasury_amount = self.calculate_split(revenue, currency)

        if treasury_amount > 0:
            success = self.route_to_treasury(
                treasury_amount,
                currency,
                chain,
                service_type,
                campaign_data
            )

            if not success:
                logger.warning("Treasury routing failed, operator receives full amount")
                return {"operator": revenue, "treasury": 0.0}

        return {
            "operator": operator_amount,
            "treasury": treasury_amount
        }

    def process_subscription_payment(
        self,
        amount: float,
        currency: str,
        subscriber_id: str,
        plan: str,
        chain: str = "ethereum"
    ) -> Dict[str, float]:
        """Process subscription payment with treasury split"""
        campaign_data = {
            "type": "subscription",
            "subscriber_id": subscriber_id,
            "plan": plan,
            "amount": amount
        }

        return self.process_service_revenue(
            amount,
            currency,
            "subscription",
            campaign_data,
            chain
        )

    def get_revenue_stats(self) -> Dict[str, Any]:
        """Get treasury revenue statistics"""
        try:
            log_file = Path(self.config["transaction_logging"]["log_file"])
            if not log_file.exists():
                return {"total_transactions": 0, "total_treasury_amount": 0.0}

            total_amount = 0.0
            transaction_count = 0

            with open(log_file, 'r') as f:
                for line in f:
                    try:
                        tx = json.loads(line)
                        total_amount += tx.get("amount", 0.0)
                        transaction_count += 1
                    except:
                        continue

            return {
                "total_transactions": transaction_count,
                "total_treasury_amount": total_amount,
                "split_percentage": self.split_percentage
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}


# Global instance
treasury = XeepyTreasuryIntegration()


def wrap_payment_processor(original_processor):
    """
    Decorator to wrap payment processing functions
    Intercepts revenue and routes through treasury integration
    """
    def wrapped_processor(payment_data: Dict[str, Any]):
        # Extract payment information
        amount = payment_data.get("amount", 0.0)
        currency = payment_data.get("currency", "USD")
        service = payment_data.get("service_type", "unknown")
        campaign_data = payment_data.get("campaign_data", {})
        chain = payment_data.get("chain", "ethereum")

        # Process through treasury
        split_result = treasury.process_service_revenue(
            amount, currency, service, campaign_data, chain
        )

        # Update payment data with split information
        payment_data["original_amount"] = amount
        payment_data["operator_amount"] = split_result["operator"]
        payment_data["treasury_amount"] = split_result["treasury"]
        payment_data["treasury_integrated"] = True

        # Call original processor with updated data
        return original_processor(payment_data)

    return wrapped_processor


if __name__ == "__main__":
    # Test the integration
    logger.info("Testing X3 Treasury Integration for Xeepy")

    # Test 1: Service revenue
    print("\n=== Test 1: Service Revenue ===")
    result1 = treasury.process_service_revenue(
        revenue=200.0,
        currency="USDT",
        service_type="follower_growth",
        campaign_data={
            "client": "test_client",
            "followers_gained": 1000,
            "duration_days": 30
        },
        chain="ethereum"
    )
    print(f"Service Revenue: 200 USDT")
    print(f"Operator Receives: {result1['operator']} USDT")
    print(f"Treasury Receives: {result1['treasury']} USDT")

    # Test 2: Subscription payment
    print("\n=== Test 2: Subscription Payment ===")
    result2 = treasury.process_subscription_payment(
        amount=50.0,
        currency="USD",
        subscriber_id="sub_12345",
        plan="premium",
        chain="polygon"
    )
    print(f"Subscription: 50 USD")
    print(f"Operator Receives: {result2['operator']} USD")
    print(f"Treasury Receives: {result2['treasury']} USD")

    # Test 3: Statistics
    print("\n=== Test 3: Revenue Statistics ===")
    stats = treasury.get_revenue_stats()
    print(f"Stats: {json.dumps(stats, indent=2)}")
