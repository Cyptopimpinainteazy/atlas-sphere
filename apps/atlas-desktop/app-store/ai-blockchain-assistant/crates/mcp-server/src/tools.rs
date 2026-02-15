use anyhow::Result;
use async_trait::async_trait;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info};

use shared::{Account, DocumentQuery};

use crate::blockchain::BlockchainService;
use crate::external_apis::ExternalAPIService;
use crate::rag_service::RAGService;

#[derive(Clone)]
pub struct ToolContext {
    pub blockchain_service: Arc<BlockchainService>,
    pub accounts: Arc<HashMap<String, Account>>,
    pub external_apis: Arc<ExternalAPIService>,
    pub rag_service: Arc<RAGService>,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value>;
}

pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn register_tool(&mut self, tool: Box<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    pub fn get_tool(&self, name: &str) -> Result<&dyn Tool> {
        self.tools
            .get(name)
            .map(|t| t.as_ref())
            .ok_or_else(|| anyhow::anyhow!("Tool not found: {}", name))
    }

    pub fn register_default_tools(&mut self) {
        self.register_tool(Box::new(SearchWebTool));
        self.register_tool(Box::new(TokenPriceTool));
        self.register_tool(Box::new(SearchDocsTool));
        self.register_tool(Box::new(GetDocsTool));
        self.register_tool(Box::new(SwapTokensTool));
    }
}

// Search Web Tool
pub struct SearchWebTool;

#[async_trait]
impl Tool for SearchWebTool {
    fn name(&self) -> &'static str {
        "search_web"
    }

    fn description(&self) -> &'static str {
        "Search the web for information"
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value> {
        let query = params["query"].as_str().unwrap_or("");
        info!("Searching web for: {}", query);

        let results = context.external_apis.search_brave(query).await?;
        Ok(json!(results))
    }
}

// Token Price Tool
pub struct TokenPriceTool;

#[async_trait]
impl Tool for TokenPriceTool {
    fn name(&self) -> &'static str {
        "get_token_price"
    }

    fn description(&self) -> &'static str {
        "Get the current price of a token"
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value> {
        let token = params["token"].as_str().unwrap_or("").to_uppercase();
        info!("Getting price for token: {}", token);

        // // Mock price data
        // let price = match token.as_str() {
        //     "ETH" => 3500.0,
        //     "USDC" => 1.0,
        //     "USDT" => 1.0,
        //     "DAI" => 1.0,
        //     "WETH" => 3500.0,
        //     "UNI" => 7.5,
        //     "LINK" => 15.0,
        //     "WBTC" => 60000.0,
        //     _ => return Err(anyhow::anyhow!("Unknown token: {}", token)),
        // };

        // Ok(json!({
        //     "token": token,
        //     "price_usd": price,
        //     "timestamp": chrono::Utc::now().timestamp()
        // }))
        let token = params["token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing token parameter"))?;

        let price = context.external_apis.get_defi_llama_price(token).await?;
        Ok(json!(price))
    }
}

// Search Docs Tool
pub struct SearchDocsTool;

#[async_trait]
impl Tool for SearchDocsTool {
    fn name(&self) -> &'static str {
        "search_docs"
    }

    fn description(&self) -> &'static str {
        "Search documentation and code examples for blockchain development"
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value> {
        let query = params["query"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing query parameter"))?;
        let limit = params["limit"].as_u64().unwrap_or(5) as usize;
        let source = params["source"].as_str().map(|s| s.to_string());

        let doc_query = DocumentQuery {
            query: query.to_string(),
            limit,
            source,
        };

        let results = context.rag_service.search_documents(doc_query).await?;

        Ok(json!(results))
    }
}

// Get Docs Tool
pub struct GetDocsTool;

#[async_trait]
impl Tool for GetDocsTool {
    fn name(&self) -> &'static str {
        "get_docs"
    }

    fn description(&self) -> &'static str {
        "Get documentation and code examples for blockchain development"
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value> {
        let id = params["id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing id parameter"))?;

        let document = context.rag_service.get_document(id).await?;

        if let Some(doc) = document {
            Ok(json!(doc))
        } else {
            Err(anyhow::anyhow!("Document not found"))
        }
    }
}

// Swap Tokens Tool
pub struct SwapTokensTool;

#[async_trait]
impl Tool for SwapTokensTool {
    fn name(&self) -> &'static str {
        "swap_tokens"
    }

    fn description(&self) -> &'static str {
        "Swap tokens using a decentralized exchange"
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<Value> {
        let from_token = params["from_token"].as_str().unwrap_or("").to_string();
        let to_token = params["to_token"].as_str().unwrap_or("").to_string();
        let amount = params["amount"].as_str().unwrap_or("0").to_string();
        let recipient = params["recipient"].as_str().unwrap_or("").to_string();
        let slippage = params["slippage"].as_str().unwrap_or("0.5").to_string();

        let from_account = context
            .accounts
            .get(&recipient)
            .ok_or_else(|| anyhow::anyhow!("Recipient account not found: {}", recipient))?;

        info!(
            "Swapping {} {} for {} to {}",
            amount, from_token, to_token, recipient
        );

        // Resolve recipient if it's a named account
        let recipient_address = if let Some(account) = context.accounts.get(&recipient) {
            account.address.clone()
        } else {
            recipient
        };

        // In a real implementation, you would:
        // 1. Resolve token addresses
        // 2. Calculate exchange rate
        // 3. Execute swap via DEX (e.g., Uniswap)

        // Create a swap request
        let swap_request = shared::SwapRequest {
            from_token: from_token.clone(),
            to_token: to_token.clone(),
            amount: amount.clone(),
            slippage: Some(slippage.parse::<f64>().unwrap_or(0.5)),
        };

        // Execute the actual swap using the blockchain service
        match context
            .blockchain_service
            .swap_tokens(&from_account, swap_request)
            .await
        {
            Ok(result) => {
                // Return the successful swap result
                Ok(json!({
                    "from_token": from_token,
                    "to_token": to_token,
                    "input_amount": amount,
                    "output_amount": result.amount_out,
                    "recipient": recipient_address,
                    "transaction_hash": result.hash,
                    "status": result.status,
                    "block_number": result.block_number,
                    "gas_used": result.gas_used
                }))
            }
            Err(e) => {
                error!("Token swap failed: {}", e);
                Err(anyhow::anyhow!("Failed to swap tokens: {}", e))
            }
        }
    }
}
