use anyhow::{Result, anyhow};
use ethers::{
    abi::Abi,
    contract::Contract,
    middleware::SignerMiddleware,
    providers::{Http, Middleware, Provider},
    signers::LocalWallet,
    types::{Address, TransactionRequest as EthTransactionRequest, U256},
};
use shared::{Account, BalanceQuery, BalanceResult, SwapRequest, SwapResult, TransactionResult};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;
use tracing::{info, warn};

// Type alias for the Ethereum provider
pub type EthProvider = Arc<Provider<Http>>;

pub type SignerProvider = Arc<SignerMiddleware<EthProvider, LocalWallet>>;

// Uniswap V2 Router address on Ethereum mainnet
const UNISWAP_V2_ROUTER: &str = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

// WETH address on Ethereum mainnet
const WETH_ADDRESS: &str = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

#[derive(Clone)]
pub struct BlockchainService {
    provider: EthProvider,
    erc20_abi: Abi,
    uniswap_router_abi: Abi,
    token_registry: HashMap<String, TokenInfo>,
}

#[derive(Debug, Clone)]
pub struct TokenInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
    pub name: String,
}

impl BlockchainService {
    pub fn new(provider: EthProvider) -> Result<Self> {
        // Try to load ERC20 ABI from file
        let erc20_abi = match Self::load_abi_from_file("./data/erc20_abi.json") {
            Ok(abi) => {
                info!("Successfully loaded ERC20 ABI from file");
                abi
            }
            Err(e) => {
                warn!("Failed to load ERC20 ABI from file: {}", e);
                warn!("Using default ERC20 ABI");
                Self::get_default_erc20_abi()?
            }
        };

        // Try to load Uniswap Router ABI
        let uniswap_router_abi = match Self::load_abi_from_file("./data/uniswap_v2_router_abi.json")
        {
            Ok(abi) => {
                info!("Successfully loaded Uniswap Router ABI from file");
                abi
            }
            Err(e) => {
                warn!("Failed to load Uniswap Router ABI: {}", e);
                warn!("Swap functionality will be limited");
                Self::get_default_uniswap_router_abi()?
            }
        };

        let token_registry = Self::build_token_registry();

        Ok(Self {
            provider,
            erc20_abi,
            uniswap_router_abi,
            token_registry,
        })
    }

    fn load_abi_from_file<P: AsRef<Path>>(path: P) -> Result<Abi> {
        let abi_content = fs::read_to_string(path)?;
        let abi: Abi = serde_json::from_str(&abi_content)?;
        Ok(abi)
    }

    fn get_default_erc20_abi() -> Result<Abi> {
        let abi_json = r#"[
          {
              "constant": true,
              "inputs": [{"name": "_owner", "type": "address"}],
              "name": "balanceOf",
              "outputs": [{"name": "balance", "type": "uint256"}],
              "type": "function"
          },
          {
              "constant": true,
              "inputs": [],
              "name": "decimals",
              "outputs": [{"name": "", "type": "uint8"}],
              "type": "function"
          },
          {
              "constant": true,
              "inputs": [],
              "name": "symbol",
              "outputs": [{"name": "", "type": "string"}],
              "type": "function"
          },
          {
              "constant": true,
              "inputs": [],
              "name": "name",
              "outputs": [{"name": "", "type": "string"}],
              "type": "function"
          },
          {
              "constant": false,
              "inputs": [
                  {"name": "_to", "type": "address"},
                  {"name": "_value", "type": "uint256"}
              ],
              "name": "transfer",
              "outputs": [{"name": "", "type": "bool"}],
              "type": "function"
          },
          {
              "constant": false,
              "inputs": [
                  {"name": "_spender", "type": "address"},
                  {"name": "_value", "type": "uint256"}
              ],
              "name": "approve",
              "outputs": [{"name": "", "type": "bool"}],
              "type": "function"
          },
          {
              "constant": true,
              "inputs": [
                  {"name": "_owner", "type": "address"},
                  {"name": "_spender", "type": "address"}
              ],
              "name": "allowance",
              "outputs": [{"name": "remaining", "type": "uint256"}],
              "type": "function"
          },
          {
              "constant": false,
              "inputs": [
                  {"name": "_from", "type": "address"},
                  {"name": "_to", "type": "address"},
                  {"name": "_value", "type": "uint256"}
              ],
              "name": "transferFrom",
              "outputs": [{"name": "", "type": "bool"}],
              "type": "function"
          },
          {
              "constant": true,
              "inputs": [],
              "name": "totalSupply",
              "outputs": [{"name": "", "type": "uint256"}],
              "type": "function"
          }
      ]"#;

        let abi = serde_json::from_str(abi_json)?;
        Ok(abi)
    }

    fn get_default_uniswap_router_abi() -> Result<Abi> {
        // This is a minimal ABI for Uniswap V2 Router with just the methods we need
        let abi_json = r#"[
          {
              "inputs": [
                  {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                  {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                  {"internalType": "address[]", "name": "path", "type": "address[]"},
                  {"internalType": "address", "name": "to", "type": "address"},
                  {"internalType": "uint256", "name": "deadline", "type": "uint256"}
              ],
              "name": "swapExactTokensForTokens",
              "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
              "stateMutability": "nonpayable",
              "type": "function"
          },
          {
              "inputs": [
                  {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                  {"internalType": "address[]", "name": "path", "type": "address[]"},
                  {"internalType": "address", "name": "to", "type": "address"},
                  {"internalType": "uint256", "name": "deadline", "type": "uint256"}
              ],
              "name": "swapExactETHForTokens",
              "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
              "stateMutability": "payable",
              "type": "function"
          },
          {
              "inputs": [
                  {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                  {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                  {"internalType": "address[]", "name": "path", "type": "address[]"},
                  {"internalType": "address", "name": "to", "type": "address"},
                  {"internalType": "uint256", "name": "deadline", "type": "uint256"}
              ],
              "name": "swapExactTokensForETH",
              "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
              "stateMutability": "nonpayable",
              "type": "function"
          },
          {
              "inputs": [
                  {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                  {"internalType": "address[]", "name": "path", "type": "address[]"}
              ],
              "name": "getAmountsOut",
              "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
              "stateMutability": "view",
              "type": "function"
          }
      ]"#;

        let abi = serde_json::from_str(abi_json)?;
        Ok(abi)
    }

    fn build_token_registry() -> HashMap<String, TokenInfo> {
        let mut registry = HashMap::new();

        // Add major tokens on Ethereum mainnet
        registry.insert(
            "usdc".to_string(),
            TokenInfo {
                address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
                symbol: "USDC".to_string(),
                decimals: 6,
                name: "USD Coin".to_string(),
            },
        );

        registry.insert(
            "usdt".to_string(),
            TokenInfo {
                address: "0xdAC17F958D2ee523a2206206994597C13D831ec7".to_string(),
                symbol: "USDT".to_string(),
                decimals: 6,
                name: "Tether USD".to_string(),
            },
        );

        registry.insert(
            "dai".to_string(),
            TokenInfo {
                address: "0x6B175474E89094C44Da98b954EedeAC495271d0F".to_string(),
                symbol: "DAI".to_string(),
                decimals: 18,
                name: "Dai Stablecoin".to_string(),
            },
        );

        registry.insert(
            "weth".to_string(),
            TokenInfo {
                address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".to_string(),
                symbol: "WETH".to_string(),
                decimals: 18,
                name: "Wrapped Ether".to_string(),
            },
        );

        registry.insert(
            "uni".to_string(),
            TokenInfo {
                address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984".to_string(),
                symbol: "UNI".to_string(),
                decimals: 18,
                name: "Uniswap".to_string(),
            },
        );

        registry.insert(
            "link".to_string(),
            TokenInfo {
                address: "0x514910771AF9Ca656af840dff83E8264EcF986CA".to_string(),
                symbol: "LINK".to_string(),
                decimals: 18,
                name: "ChainLink Token".to_string(),
            },
        );

        registry.insert(
            "wbtc".to_string(),
            TokenInfo {
                address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".to_string(),
                symbol: "WBTC".to_string(),
                decimals: 8,
                name: "Wrapped BTC".to_string(),
            },
        );

        // Add by address as well for direct lookups
        let address_entries: Vec<(String, TokenInfo)> = registry
            .values()
            .cloned()
            .map(|token| (token.address.to_lowercase(), token))
            .collect();

        for (addr, token) in address_entries {
            registry.insert(addr, token);
        }

        registry
    }

    pub async fn get_balance(&self, query: BalanceQuery) -> Result<BalanceResult> {
        let address = Address::from_str(&query.address)?;

        match query.token {
            None => {
                // ETH balance
                let balance = self.provider.get_balance(address, None).await?;
                Ok(BalanceResult {
                    address: query.address,
                    balance: self.format_balance(balance, 18),
                    token: None,
                    decimals: 18,
                })
            }
            Some(token_identifier) => {
                if token_identifier.to_lowercase() == "eth" {
                    let balance = self.provider.get_balance(address, None).await?;
                    return Ok(BalanceResult {
                        address: query.address,
                        balance: self.format_balance(balance, 18),
                        token: Some("ETH".to_string()),
                        decimals: 18,
                    });
                }
                // ERC20 token balance
                self.get_erc20_balance(&query.address, &token_identifier)
                    .await
            }
        }
    }

    async fn get_erc20_balance(
        &self,
        address: &str,
        token_identifier: &str,
    ) -> Result<BalanceResult> {
        // Resolve token info
        let token_info = self.resolve_token(token_identifier).await?;

        // Create contract instance
        let token_address = Address::from_str(&token_info.address)?;
        let contract = Contract::new(token_address, self.erc20_abi.clone(), self.provider.clone());

        // Get balance
        let owner_address = Address::from_str(address)?;
        let balance: U256 = contract
            .method::<_, U256>("balanceOf", owner_address)?
            .call()
            .await?;

        Ok(BalanceResult {
            address: address.to_string(),
            balance: self.format_balance(balance, token_info.decimals),
            token: Some(token_info.symbol),
            decimals: token_info.decimals,
        })
    }

    async fn resolve_token(&self, identifier: &str) -> Result<TokenInfo> {
        // Try to find by symbol first (case insensitive)
        if let Some(token) = self.token_registry.get(&identifier.to_lowercase()) {
            return Ok(token.clone());
        }

        // Try to find by address
        if identifier.starts_with("0x") && identifier.len() == 42 {
            if let Some(token) = self.token_registry.get(&identifier.to_lowercase()) {
                return Ok(token.clone());
            } else {
                // If not in registry, try to fetch token info from contract
                return self.fetch_token_info_from_contract(identifier).await;
            }
        }

        Err(anyhow::anyhow!("Unknown token: {}", identifier))
    }

    async fn fetch_token_info_from_contract(&self, address: &str) -> Result<TokenInfo> {
        let token_addr = Address::from_str(address)?;

        let contract = Contract::new(token_addr, self.erc20_abi.clone(), self.provider.clone());

        // Fetch token info from contract
        let symbol: String = contract
            .method::<_, String>("symbol", ())?
            .call()
            .await
            .unwrap_or_else(|_| "UNKNOWN".to_string());

        let decimals: u8 = contract
            .method::<_, u8>("decimals", ())?
            .call()
            .await
            .unwrap_or(18);

        let name: String = contract
            .method::<_, String>("name", ())?
            .call()
            .await
            .unwrap_or_else(|_| "Unknown Token".to_string());

        Ok(TokenInfo {
            address: address.to_string(),
            symbol,
            decimals,
            name,
        })
    }

    fn get_signer_provider(&self, account: &Account) -> Result<SignerProvider> {
        let wallet = LocalWallet::from_str(&account.private_key)?;
        let signer_provider = SignerMiddleware::new(self.provider.clone(), wallet);
        Ok(Arc::new(signer_provider))
    }

    pub async fn send_transaction(
        &self,
        from_account: &Account,
        to_address: &str,
        amount: &str,
    ) -> Result<TransactionResult> {
        info!(
            "Sending {} ETH from {} to {}",
            amount, from_account.address, to_address
        );

        // Parse amount as ether
        let amount_wei = ethers::utils::parse_ether(amount)?;

        // Create signer provider
        let signer_provider = self.get_signer_provider(from_account)?;

        // Create transaction request
        let to_addr = Address::from_str(to_address)?;
        let tx = EthTransactionRequest::new().to(to_addr).value(amount_wei);

        // Send transaction
        let pending_tx = signer_provider.send_transaction(tx, None).await?;

        // Get transaction hash
        let tx_hash = format!("{:#x}", pending_tx.tx_hash());

        // Wait for transaction to be mined
        match pending_tx.await {
            Ok(Some(receipt)) => {
                // Transaction was mined
                let status = if receipt.status == Some(1.into()) {
                    "success".to_string()
                } else {
                    "failed".to_string()
                };

                Ok(TransactionResult {
                    hash: tx_hash,
                    status,
                    block_number: receipt.block_number.map(|bn| bn.as_u64()),
                    gas_used: receipt.gas_used.map(|gas| gas.as_u64()),
                })
            }
            Ok(None) => {
                // Transaction was not mined yet
                Ok(TransactionResult {
                    hash: tx_hash,
                    status: "pending".to_string(),
                    block_number: None,
                    gas_used: None,
                })
            }
            Err(e) => Err(anyhow!("Transaction failed: {}", e)),
        }
    }

    fn parse_token_amount(&self, amount: &str, decimals: u8) -> Result<U256> {
        // Parse amount as float
        let amount_float: f64 = amount.parse()?;

        // Convert to token units
        let multiplier = 10u64.pow(decimals as u32) as f64;
        let amount_raw = (amount_float * multiplier).round() as u64;

        Ok(U256::from(amount_raw))
    }

    pub async fn check_contract_deployed(&self, address: &str) -> Result<bool> {
        let addr = Address::from_str(address)?;
        let code = self.provider.get_code(addr, None).await?;
        Ok(!code.is_empty())
    }

    fn format_balance(&self, balance: U256, decimals: u8) -> String {
        let divisor = U256::from(10).pow(U256::from(decimals));
        let integer_part = balance / divisor;
        let fractional_part = balance % divisor;

        if fractional_part.is_zero() {
            integer_part.to_string()
        } else {
            let fractional_str = format!("{:0width$}", fractional_part, width = decimals as usize);
            let fractional_trimmed = fractional_str.trim_end_matches('0');
            if fractional_trimmed.is_empty() {
                integer_part.to_string()
            } else {
                format!("{}.{}", integer_part, fractional_trimmed)
            }
        }
    }

    pub fn get_supported_tokens(&self) -> Vec<&TokenInfo> {
        self.token_registry
            .values()
            .filter(|token| token.address.starts_with("0x") && token.address.len() == 42)
            .collect()
    }

    // Send ERC20 token transaction
    pub async fn send_erc20(
        &self,
        from_account: &Account,
        to_address: &str,
        token_identifier: &str,
        amount: &str,
    ) -> Result<TransactionResult> {
        // Resolve token info
        let token_info = self.resolve_token(token_identifier).await?;

        info!(
            "Sending {} {} from {} to {}",
            amount, token_info.symbol, from_account.address, to_address
        );

        // Parse amount based on token decimals
        let amount_value = self.parse_token_amount(amount, token_info.decimals)?;

        // Create signer provider
        let signer_provider = self.get_signer_provider(from_account)?;

        // Create contract instance with signer
        let token_addr = Address::from_str(&token_info.address)?;
        let token_contract =
            Contract::new(token_addr, self.erc20_abi.clone(), signer_provider.clone());

        // Create transfer call
        let to_addr = Address::from_str(to_address)?;
        let transfer_call =
            token_contract.method::<_, bool>("transfer", (to_addr, amount_value))?;

        // Send transaction
        let pending_tx = transfer_call.send().await?;

        // Get transaction hash
        let tx_hash = format!("{:#x}", pending_tx.tx_hash());

        // Wait for transaction to be mined
        match pending_tx.await {
            Ok(Some(receipt)) => {
                // Transaction was mined
                let status = if receipt.status == Some(1.into()) {
                    "success".to_string()
                } else {
                    "failed".to_string()
                };

                Ok(TransactionResult {
                    hash: tx_hash,
                    status,
                    block_number: receipt.block_number.map(|bn| bn.as_u64()),
                    gas_used: receipt.gas_used.map(|gas| gas.as_u64()),
                })
            }
            Ok(None) => {
                // Transaction was not mined yet
                Ok(TransactionResult {
                    hash: tx_hash,
                    status: "pending".to_string(),
                    block_number: None,
                    gas_used: None,
                })
            }
            Err(e) => Err(anyhow!("Transaction failed: {}", e)),
        }
    }

    // Approve tokens for Uniswap Router
    async fn approve_token_for_router(
        &self,
        from_account: &Account,
        token_address: &str,
        amount: &str,
        decimals: u8,
    ) -> Result<()> {
        // Skip approval for ETH
        if token_address.to_lowercase() == "eth" {
            return Ok(());
        }

        info!(
            "Approving Uniswap Router to spend {} from {}",
            amount, from_account.address
        );

        // Parse amount
        let amount_value = self.parse_token_amount(amount, decimals)?;

        // Create signer provider
        let signer_provider = self.get_signer_provider(from_account)?;

        // Create contract instance with signer
        let token_addr = Address::from_str(token_address)?;
        let token_contract =
            Contract::new(token_addr, self.erc20_abi.clone(), signer_provider.clone());

        // Create approve call
        let router_addr = Address::from_str(UNISWAP_V2_ROUTER)?;
        let approve_call =
            token_contract.method::<_, bool>("approve", (router_addr, amount_value))?;

        // Send transaction
        let pending_tx = approve_call.send().await?;

        // Wait for transaction to be mined
        match pending_tx.await {
            Ok(Some(receipt)) => {
                if receipt.status != Some(1.into()) {
                    return Err(anyhow!("Token approval failed"));
                }
                Ok(())
            }
            Ok(None) => Err(anyhow!("Token approval failed")),
            Err(e) => Err(anyhow!("Token approval failed: {}", e)),
        }
    }

    pub async fn swap_tokens(
        &self,
        from_account: &Account,
        swap_request: SwapRequest,
    ) -> Result<SwapResult> {
        // Resolve token info

        // Create signer provider
        let signer_provider = self.get_signer_provider(from_account)?;
        let uniswap_router_abi = self.uniswap_router_abi.clone();

        // Create router contract instance
        let router_addr = Address::from_str(UNISWAP_V2_ROUTER)?; // Uniswap V2 Router
        let router_contract =
            Contract::new(router_addr, uniswap_router_abi, signer_provider.clone());

        // Constants
        let weth_address = WETH_ADDRESS; // WETH on mainnet
        let deadline = U256::from(chrono::Utc::now().timestamp() + 3600); // 1 hour from now
        let min_amount_out = U256::from(0); // No slippage protection for simplicity
        let receiver = Address::from_str(&from_account.address)?;

        info!(
            "Swapping {} {} for {} from account {}",
            swap_request.amount,
            swap_request.from_token,
            swap_request.to_token,
            from_account.address
        );

        // Get path for swap and determine swap type
        let from_is_eth = swap_request.from_token.to_lowercase() == "eth";
        let to_is_eth = swap_request.to_token.to_lowercase() == "eth";

        // Execute the swap based on token types
        if from_is_eth {
            let to_token = self.resolve_token(&swap_request.to_token).await?;
            // ETH to Token swap
            let to_token_addr = Address::from_str(&to_token.address)?;
            let path = vec![Address::from_str(weth_address)?, to_token_addr];

            // Parse amount as ether
            let amount_in = ethers::utils::parse_ether(&swap_request.amount)?;

            // Call swapExactETHForTokens
            let swap_call = router_contract.method::<_, Vec<U256>>(
                "swapExactETHForTokens",
                (min_amount_out, path, receiver, deadline),
            )?;

            // Send transaction with ETH
            let value_call = swap_call.value(amount_in);
            let pending_tx = value_call.send().await?;

            // Get transaction hash and wait for it to be mined
            return self
                .process_swap_transaction(
                    pending_tx,
                    "ETH".to_string(),
                    to_token.symbol,
                    swap_request.amount.to_string(),
                )
                .await;
        } else if to_is_eth {
            let from_token = self.resolve_token(&swap_request.from_token).await?;
            // Token to ETH swap
            let from_token_addr = Address::from_str(&from_token.address)?;
            let path = vec![from_token_addr, Address::from_str(weth_address)?];

            // Parse amount based on token decimals
            let amount_in = self.parse_token_amount(&swap_request.amount, from_token.decimals)?;

            // First approve the router to spend tokens
            self.approve_token_for_router(
                from_account,
                &from_token.address,
                &swap_request.amount,
                from_token.decimals,
            )
            .await?;

            // Call swapExactTokensForETH
            let swap_call = router_contract.method::<_, Vec<U256>>(
                "swapExactTokensForETH",
                (amount_in, min_amount_out, path, receiver, deadline),
            )?;

            // Send transaction
            let pending_tx = swap_call.send().await?;

            // Get transaction hash and wait for it to be mined
            return self
                .process_swap_transaction(
                    pending_tx,
                    from_token.symbol,
                    "ETH".to_string(),
                    swap_request.amount.to_string(),
                )
                .await;
        } else {
            let from_token = self.resolve_token(&swap_request.from_token).await?;
            let to_token = self.resolve_token(&swap_request.to_token).await?;
            // Token to Token swap
            let from_token_addr = Address::from_str(&from_token.address)?;
            let to_token_addr = Address::from_str(&to_token.address)?;

            // Build path - if neither token is WETH, route through WETH
            let path = if from_token.address != weth_address && to_token.address != weth_address {
                vec![
                    from_token_addr,
                    Address::from_str(weth_address)?,
                    to_token_addr,
                ]
            } else {
                vec![from_token_addr, to_token_addr]
            };

            // Parse amount based on token decimals
            let amount_in = self.parse_token_amount(&swap_request.amount, from_token.decimals)?;

            // First approve the router to spend tokens
            self.approve_token_for_router(
                from_account,
                &from_token.address,
                &swap_request.amount,
                from_token.decimals,
            )
            .await?;

            // Call swapExactTokensForTokens
            let swap_call = router_contract.method::<_, Vec<U256>>(
                "swapExactTokensForTokens",
                (amount_in, min_amount_out, path, receiver, deadline),
            )?;

            // Send transaction
            let pending_tx = swap_call.send().await?;

            // Get transaction hash and wait for it to be mined
            return self
                .process_swap_transaction(
                    pending_tx,
                    from_token.symbol,
                    to_token.symbol,
                    swap_request.amount.to_string(),
                )
                .await;
        }
    }

    // Helper method to process a swap transaction and create a result
    async fn process_swap_transaction(
        &self,
        pending_tx: ethers::providers::PendingTransaction<'_, Http>,
        from_token: String,
        to_token: String,
        amount_in: String,
    ) -> Result<SwapResult> {
        // Get transaction hash
        let tx_hash = format!("{:#x}", pending_tx.tx_hash());

        // Wait for transaction to be mined
        match pending_tx.await {
            Ok(Some(receipt)) => {
                // Transaction was mined
                let status = if receipt.status == Some(1.into()) {
                    "success".to_string()
                } else {
                    "failed".to_string()
                };

                // In a real implementation, you would parse the swap event logs
                // to get the exact amount received. For simplicity, we're just
                // returning "Unknown" for the amount_out.

                Ok(SwapResult {
                    hash: tx_hash,
                    status,
                    from_token,
                    to_token,
                    amount_in,
                    amount_out: "Unknown".to_string(), // Would require event parsing
                    block_number: receipt.block_number.map(|bn| bn.as_u64()),
                    gas_used: receipt.gas_used.map(|gas| gas.as_u64()),
                })
            }
            Ok(None) => Err(anyhow!("Swap failed")),
            Err(e) => Err(anyhow!("Swap failed: {}", e)),
        }
    }
}
