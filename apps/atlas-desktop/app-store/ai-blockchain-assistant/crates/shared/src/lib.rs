use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod abi_loader;
pub mod rag;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub address: String,
    pub private_key: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRequest {
    pub from: String,
    pub to: String,
    pub value: String,
    pub data: Option<String>,
    pub gas_limit: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub hash: String,
    pub status: String,
    pub block_number: Option<u64>,
    pub gas_used: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceQuery {
    pub address: String,
    pub token: Option<String>, // None for ETH, Some(address) for ERC20
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceResult {
    pub address: String,
    pub balance: String,
    pub token: Option<String>,
    pub decimals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractCall {
    pub contract_address: String,
    pub function_signature: String,
    pub parameters: Vec<String>,
    pub from: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRequest {
  pub from_token: String,   // Token to swap from (symbol or address)
  pub to_token: String,     // Token to swap to (symbol or address)
  pub amount: String,       // Amount to swap (as a string, e.g. "1.5")
  pub slippage: Option<f64>, // Optional slippage tolerance in percentage
}

// Result of a swap operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResult {
  pub hash: String,         // Transaction hash
  pub status: String,       // Transaction status: "pending", "success", "failed"
  pub from_token: String,   // Token swapped from
  pub to_token: String,     // Token swapped to
  pub amount_in: String,    // Amount sent
  pub amount_out: String,   // Amount received (if known)
  pub block_number: Option<u64>, // Block number where the transaction was mined
  pub gas_used: Option<u64>, // Gas used by the transaction
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentQuery {
    pub query: String,
    pub limit: usize,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenConfig {
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
    pub name: String,
    pub abi_path: Option<String>,
}

// Test accounts from Anvil
pub fn get_test_accounts() -> HashMap<String, Account> {
    let mut accounts = HashMap::new();

    accounts.insert(
        "alice".to_string(),
        Account {
            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".to_string(),
            private_key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                .to_string(),
            name: "Alice".to_string(),
        },
    );

    accounts.insert(
        "bob".to_string(),
        Account {
            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".to_string(),
            private_key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
                .to_string(),
            name: "Bob".to_string(),
        },
    );

    // Add more test accounts...
    let additional_accounts = [
        (
            "charlie",
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        ),
        (
            "david",
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        ),
        (
            "eve",
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
        ),
    ];

    for (name, address, private_key) in additional_accounts {
        accounts.insert(
            name.to_string(),
            Account {
                address: address.to_string(),
                private_key: private_key.to_string(),
                name: name.to_string(),
            },
        );
    }

    accounts
}

// Common contract addresses
pub fn get_common_contracts() -> HashMap<String, String> {
    let mut contracts = HashMap::new();

    contracts.insert(
        "uniswap_v2_router".to_string(),
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".to_string(),
    );
    contracts.insert(
        "uniswap_v2_factory".to_string(),
        "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f".to_string(),
    );
    contracts.insert(
        "weth".to_string(),
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".to_string(),
    );
    contracts.insert(
        "usdc".to_string(),
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
    );

    contracts
}

// Load token configuration from file
pub fn load_token_config() -> Result<Vec<TokenConfig>, Box<dyn std::error::Error>> {
    use std::fs;

    let config_path = "../../../data/tokens.json";
    if std::path::Path::new(config_path).exists() {
        let content = fs::read_to_string(config_path)?;
        let tokens: Vec<TokenConfig> = serde_json::from_str(&content)?;
        Ok(tokens)
    } else {
        // Return default configuration
        Ok(get_default_token_config())
    }
}

fn get_default_token_config() -> Vec<TokenConfig> {
    vec![
        TokenConfig {
            symbol: "USDC".to_string(),
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
            decimals: 6,
            name: "USD Coin".to_string(),
            abi_path: Some("./data/erc20_abi.json".to_string()),
        },
        TokenConfig {
            symbol: "USDT".to_string(),
            address: "0xdAC17F958D2ee523a2206206994597C13D831ec7".to_string(),
            decimals: 6,
            name: "Tether USD".to_string(),
            abi_path: Some("./data/erc20_abi.json".to_string()),
        },
        TokenConfig {
            symbol: "DAI".to_string(),
            address: "0x6B175474E89094C44Da98b954EedeAC495271d0F".to_string(),
            decimals: 18,
            name: "Dai Stablecoin".to_string(),
            abi_path: Some("./data/erc20_abi.json".to_string()),
        },
    ]
}

pub mod utils {
    use ethers::types::{Address, U256};
    use std::str::FromStr;

    pub fn parse_address(addr: &str) -> Result<Address, anyhow::Error> {
        Address::from_str(addr).map_err(|e| anyhow::anyhow!("Invalid address: {}", e))
    }

    pub fn parse_amount(amount: &str, decimals: u8) -> Result<U256, anyhow::Error> {
        let amount_f64: f64 = amount.parse()?;
        let multiplier = 10_u64.pow(decimals as u32);
        let amount_wei = (amount_f64 * multiplier as f64) as u64;
        Ok(U256::from(amount_wei))
    }

    pub fn format_balance(balance: U256, decimals: u8) -> String {
        let divisor = 10_u128.pow(decimals as u32);
        let balance_u128: u128 = balance.as_u128();
        let formatted = balance_u128 as f64 / divisor as f64;
        format!("{:.6}", formatted)
    }
}
