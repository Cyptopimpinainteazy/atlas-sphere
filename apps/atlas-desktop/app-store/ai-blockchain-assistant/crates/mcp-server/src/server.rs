use anyhow::Result;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tracing::{error, info};

use crate::blockchain::BlockchainService;
use crate::external_apis::ExternalAPIService;
use crate::rag_service::RAGService;
use crate::tools::{ToolContext, ToolRegistry};
use shared::{Account, BalanceQuery};

pub struct Server {
    blockchain_service: Arc<BlockchainService>,
    rag_service: Arc<RAGService>,
    tool_registry: Arc<ToolRegistry>,
    external_apis: Arc<ExternalAPIService>,
    accounts: Arc<std::collections::HashMap<String, Account>>,
}

impl Server {
    pub fn new(
        blockchain_service: BlockchainService,
        tool_registry: ToolRegistry,
        accounts: std::collections::HashMap<String, Account>,
    ) -> Self {
        Self {
            blockchain_service: Arc::new(blockchain_service),
            tool_registry: Arc::new(tool_registry),
            rag_service: Arc::new(RAGService::new("./data").unwrap()),
            external_apis: Arc::new(ExternalAPIService::new()),
            accounts: Arc::new(accounts),
        }
    }

    pub async fn run(&self, addr: &str) -> Result<()> {
        let listener = TcpListener::bind(addr).await?;
        info!("Server listening on {}", addr);

        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    info!("New connection from {}", addr);

                    let blockchain_service = self.blockchain_service.clone();
                    let tool_registry = self.tool_registry.clone();
                    let accounts = self.accounts.clone();
                    let rag_service = self.rag_service.clone();
                    let external_apis = self.external_apis.clone();

                    tokio::spawn(async move {
                        if let Err(e) = Self::handle_connection(
                            stream,
                            blockchain_service,
                            tool_registry,
                            accounts,
                            rag_service,
                            external_apis,
                        )
                        .await
                        {
                            error!("Error handling connection: {}", e);
                        }
                    });
                }
                Err(e) => {
                    error!("Error accepting connection: {}", e);
                }
            }
        }
    }

    async fn handle_connection(
        stream: TcpStream,
        blockchain_service: Arc<BlockchainService>,
        tool_registry: Arc<ToolRegistry>,
        accounts: Arc<std::collections::HashMap<String, Account>>,
        rag_service: Arc<RAGService>,
        external_apis: Arc<ExternalAPIService>,
    ) -> Result<()> {
        let (reader, mut writer) = stream.into_split();
        let mut reader = BufReader::new(reader);
        let mut line = String::new();

        reader.read_line(&mut line).await?;

        let request: Value = serde_json::from_str(&line)?;

        let id = request["id"].as_u64().unwrap_or(0);
        let method = request["method"].as_str().unwrap_or("");
        let params = request["params"].clone();

        info!("Received request: method={}, id={}", method, id);

        let result = Self::handle_request(
            method,
            params,
            blockchain_service,
            tool_registry,
            accounts,
            rag_service,
            external_apis,
        )
        .await?;

        let response = json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        });

        let response_str = serde_json::to_string(&response)?;
        writer.write_all(response_str.as_bytes()).await?;
        writer.write_all(b"\n").await?;

        Ok(())
    }

    async fn handle_request(
        method: &str,
        params: Value,
        blockchain_service: Arc<BlockchainService>,
        tool_registry: Arc<ToolRegistry>,
        accounts: Arc<std::collections::HashMap<String, Account>>,
        rag_service: Arc<RAGService>,
        external_apis: Arc<ExternalAPIService>,
    ) -> Result<Value> {
        
        let context = ToolContext {
            blockchain_service: blockchain_service.clone(),
            accounts: accounts.clone(),
            rag_service: rag_service.clone(),
            external_apis: external_apis.clone(),
        };
        
        match method {
            "get_balance" => {
                let address = params["address"].as_str().unwrap_or("").to_string();
                let token = params["token"].as_str().map(|s| s.to_string());

                // Resolve named accounts
                let resolved_address = if let Some(account) = accounts.get(&address) {
                    account.address.clone()
                } else {
                    address
                };

                let query = BalanceQuery {
                    address: resolved_address,
                    token,
                };

                let result = blockchain_service.get_balance(query).await?;
                Ok(json!(result))
            }
            "send_eth" => {
                let from = params["from"].as_str().unwrap_or("").to_string();
                let to = params["to"].as_str().unwrap_or("").to_string();
                let amount = params["amount"].as_str().unwrap_or("0").to_string();

                // Resolve named accounts
                let from_account = if let Some(account) = accounts.get(&from) {
                    account.clone()
                } else {
                    return Err(anyhow::anyhow!("Unknown account: {}", from));
                };

                let to_address = if let Some(account) = accounts.get(&to) {
                    account.address.clone()
                } else {
                    to
                };

                let result = blockchain_service
                    .send_transaction(&from_account, &to_address, &amount)
                    .await?;
                Ok(json!(result))
            }
            "check_contract" => {
                let address = params["address"].as_str().unwrap_or("").to_string();
                let result = blockchain_service.check_contract_deployed(&address).await?;
                Ok(json!({"deployed": result}))
            }
            "search_web" => {
                let query = params["query"].as_str().unwrap_or("").to_string();
                let search_tool = tool_registry.get_tool("search_web")?;
                let result = search_tool
                    .execute(json!({"query": query}), &context)
                    .await?;

                Ok(result)
            }
            "get_token_price" => {
                let token = params["token"].as_str().unwrap_or("").to_string();
                let price_tool = tool_registry.get_tool("get_token_price")?;
                let result = price_tool
                    .execute(json!({"token": token}), &context)
                    .await?;

                Ok(result)
            }
            "search_docs" => {
                let query = params["query"].as_str().unwrap_or("").to_string();
                let limit = params["limit"].as_u64().unwrap_or(5) as usize;
                let docs_tool = tool_registry.get_tool("search_docs")?;
                let result = docs_tool
                    .execute(json!({"query": query, "limit": limit}), &context)
                    .await?;

                Ok(result)
            }
            "get_document" => {
                let id = params["id"].as_str().unwrap_or("").to_string();
                let docs_tool = tool_registry.get_tool("get_docs")?;
                let result = docs_tool
                    .execute(json!({"id": id}), &context)
                    .await?;
                
                Ok(result)
            }
            "list_supported_tokens" => {
                let tokens = blockchain_service.get_supported_tokens();
                let token_list: Vec<Value> = tokens
                    .iter()
                    .map(|token| {
                        json!({
                            "symbol": token.symbol,
                            "name": token.name,
                            "address": token.address,
                            "decimals": token.decimals
                        })
                    })
                    .collect();

                Ok(json!({"tokens": token_list}))
            }
            "swap_tokens" => {
                let from_token = params["from_token"].as_str().unwrap_or("").to_string();
                let to_token = params["to_token"].as_str().unwrap_or("").to_string();
                let amount = params["amount"].as_str().unwrap_or("0").to_string();
                let recipient = params["recipient"].as_str().unwrap_or("").to_string();

                let swap_tool = tool_registry.get_tool("swap_tokens")?;
                let result = swap_tool
                    .execute(
                        json!({
                            "from_token": from_token,
                            "to_token": to_token,
                            "amount": amount,
                            "recipient": recipient
                        }),
                        &context,
                    )
                    .await?;

                Ok(result)
            }
            _ => Err(anyhow::anyhow!("Unknown method: {}", method)),
        }
    }
}
