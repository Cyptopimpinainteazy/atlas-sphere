"""
Configuration management for Trading Engine
Bridges Python config_loader.py with Next.js environment variables
"""

import os
import yaml
from typing import Dict, Any, Optional
from pathlib import Path

class TradingConfig:
    """Configuration manager for the trading engine"""

    def __init__(self):
        self.config_dir = Path(__file__).parent
        self.python_config_path = self.config_dir / "config.yaml"

        # Environment-based configuration
        self.api_host = os.getenv("TRADING_ENGINE_HOST", "0.0.0.0")
        self.api_port = int(os.getenv("TRADING_ENGINE_PORT", "8001"))
        self.api_debug = os.getenv("TRADING_ENGINE_DEBUG", "false").lower() == "true"

        # CORS configuration
        self.cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

        # Database configuration
        self.postgres_url = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/trading_db")

        # Redis configuration for job queue
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_queue_name = os.getenv("BULL_QUEUE_NAME", "trading-queue")

        # Trading parameters
        self.default_slippage = float(os.getenv("DEFAULT_SLIPPAGE", "1.0"))
        self.max_trade_amount = float(os.getenv("MAX_TRADE_AMOUNT_USD", "10000.0"))
        self.enable_order_splitting = os.getenv("ENABLE_ORDER_SPLITTING", "true").lower() == "true"

        # Risk management
        self.max_daily_loss = float(os.getenv("MAX_DAILY_LOSS_USD", "-1000.0"))
        self.max_concurrent_positions = int(os.getenv("MAX_CONCURRENT_POSITIONS", "10"))
        self.circuit_breaker_minutes = int(os.getenv("CIRCUIT_BREAKER_MINUTES", "30"))

        # Chain configurations
        self.chain_configs = self._load_chain_configs()

        # Logging configuration
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        self.log_file = os.getenv("LOG_FILE", "trading_engine.log")

        # Load Python-specific configuration
        self.python_config = self._load_python_config()

        # Validate configuration
        self._validate_config()

    def _load_chain_configs(self) -> Dict[str, Dict[str, Any]]:
        """Load blockchain network configurations"""
        return {
            "solana": {
                "name": "Solana",
                "rpc_url": os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"),
                "private_key": os.getenv("SOLANA_PRIVATE_KEY"),
                "native_token": "SOL",
                "dexes": ["Jupiter", "Raydium"],
                "enabled": os.getenv("SOLANA_ENABLED", "true").lower() == "true"
            },
            "ethereum": {
                "name": "Ethereum",
                "rpc_url": os.getenv("ETHEREUM_RPC_URL", "https://eth-mainnet.g.alchemy.com/v2/demo"),
                "private_key": os.getenv("ETHEREUM_PRIVATE_KEY"),
                "native_token": "ETH",
                "dexes": ["Uniswap V3", "Uniswap V2"],
                "enabled": os.getenv("ETHEREUM_ENABLED", "true").lower() == "true"
            },
            "base": {
                "name": "Base",
                "rpc_url": os.getenv("BASE_RPC_URL", "https://base-mainnet.g.alchemy.com/v2/demo"),
                "private_key": os.getenv("BASE_PRIVATE_KEY"),
                "native_token": "ETH",
                "dexes": ["Uniswap V3"],
                "enabled": os.getenv("BASE_ENABLED", "true").lower() == "true"
            },
            "polygon": {
                "name": "Polygon",
                "rpc_url": os.getenv("POLYGON_RPC_URL", "https://polygon-mainnet.g.alchemy.com/v2/demo"),
                "private_key": os.getenv("POLYGON_PRIVATE_KEY"),
                "native_token": "MATIC",
                "dexes": ["Uniswap V3", "QuickSwap"],
                "enabled": os.getenv("POLYGON_ENABLED", "true").lower() == "true"
            },
            "bsc": {
                "name": "BNB Smart Chain",
                "rpc_url": os.getenv("BSC_RPC_URL", "https://bsc-dataseed.binance.org"),
                "private_key": os.getenv("BSC_PRIVATE_KEY"),
                "native_token": "BNB",
                "dexes": ["PancakeSwap V3", "PancakeSwap V2"],
                "enabled": os.getenv("BSC_ENABLED", "true").lower() == "true"
            },
            "arbitrum": {
                "name": "Arbitrum",
                "rpc_url": os.getenv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
                "private_key": os.getenv("ARBITRUM_PRIVATE_KEY"),
                "native_token": "ETH",
                "dexes": ["Uniswap V3"],
                "enabled": os.getenv("ARBITRUM_ENABLED", "true").lower() == "true"
            },
            "optimism": {
                "name": "Optimism",
                "rpc_url": os.getenv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
                "private_key": os.getenv("OPTIMISM_PRIVATE_KEY"),
                "native_token": "ETH",
                "dexes": ["Uniswap V3"],
                "enabled": os.getenv("OPTIMISM_ENABLED", "true").lower() == "true"
            },
            "pulsechain": {
                "name": "PulseChain",
                "rpc_url": os.getenv("PULSECHAIN_RPC_URL", "https://rpc.pulsechain.com"),
                "private_key": os.getenv("PULSECHAIN_PRIVATE_KEY"),
                "native_token": "PLS",
                "dexes": ["Uniswap V3"],
                "enabled": os.getenv("PULSECHAIN_ENABLED", "true").lower() == "true"
            }
        }

    def _load_python_config(self) -> Dict[str, Any]:
        """Load Python-specific configuration from YAML"""
        if self.python_config_path.exists():
            try:
                with open(self.python_config_path, 'r') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                print(f"Warning: Could not load Python config: {e}")
                return {}
        return {}

    def _validate_config(self):
        """Validate required configuration"""
        required_vars = [
            "DATABASE_URL",
            "REDIS_URL"
        ]

        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)

        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

        # Validate at least one chain is enabled
        enabled_chains = [chain for chain, config in self.chain_configs.items() if config["enabled"]]
        if not enabled_chains:
            raise ValueError("At least one blockchain network must be enabled")

        # Validate private keys for enabled chains
        for chain_id, config in self.chain_configs.items():
            if config["enabled"] and not config["private_key"]:
                print(f"Warning: No private key configured for enabled chain {chain_id}")

    def get_chain_config(self, chain_id: str) -> Dict[str, Any]:
        """Get configuration for specific chain"""
        return self.chain_configs.get(chain_id, {})

    def get_enabled_chains(self) -> List[str]:
        """Get list of enabled chain IDs"""
        return [chain_id for chain_id, config in self.chain_configs.items() if config["enabled"]]

    def get_dexes_for_chain(self, chain_id: str) -> List[str]:
        """Get available DEXes for a chain"""
        config = self.get_chain_config(chain_id)
        return config.get("dexes", [])

    def to_dict(self) -> Dict[str, Any]:
        """Export configuration as dictionary"""
        return {
            "api": {
                "host": self.api_host,
                "port": self.api_port,
                "debug": self.api_debug,
                "cors_origins": self.cors_origins
            },
            "database": {
                "postgres_url": self.postgres_url
            },
            "redis": {
                "url": self.redis_url,
                "queue_name": self.redis_queue_name
            },
            "trading": {
                "default_slippage": self.default_slippage,
                "max_trade_amount": self.max_trade_amount,
                "enable_order_splitting": self.enable_order_splitting
            },
            "risk": {
                "max_daily_loss": self.max_daily_loss,
                "max_concurrent_positions": self.max_concurrent_positions,
                "circuit_breaker_minutes": self.circuit_breaker_minutes
            },
            "chains": self.chain_configs,
            "logging": {
                "level": self.log_level,
                "file": self.log_file
            }
        }

    def reload_config(self):
        """Hot-reload configuration from files and environment"""
        self.python_config = self._load_python_config()
        # Note: Environment variables require restart to reload

# Global configuration instance
config = TradingConfig()
