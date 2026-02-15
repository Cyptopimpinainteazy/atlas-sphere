use anyhow::Result;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

pub struct MCPClient {
    server_addr: String,
    request_id: AtomicU64,
}

impl MCPClient {
    pub fn new(server_addr: &str) -> Result<Self> {
        Ok(Self {
            server_addr: server_addr.to_string(),
            request_id: AtomicU64::new(1),
        })
    }

    async fn send_request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);

        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        let request_str = serde_json::to_string(&request)?;

        let stream = TcpStream::connect(&self.server_addr).await?;
        let (reader, mut writer) = stream.into_split();

        writer.write_all(request_str.as_bytes()).await?;
        writer.write_all(b"\n").await?;

        let mut reader = BufReader::new(reader);
        let mut line = String::new();

        reader.read_line(&mut line).await?;

        let response: Value = serde_json::from_str(&line)?;

        if let Some(error) = response.get("error") {
            return Err(anyhow::anyhow!("MCP error: {}", error));
        }

        Ok(response["result"].clone())
    }

    pub async fn get_balance(&self, params: Value) -> Result<Value> {
        self.send_request("get_balance", params).await
    }

    pub async fn send_eth(&self, params: Value) -> Result<Value> {
        self.send_request("send_eth", params).await
    }

    pub async fn check_contract(&self, params: Value) -> Result<Value> {
        self.send_request("check_contract", params).await
    }

    pub async fn search_web(&self, params: Value) -> Result<Value> {
        self.send_request("search_web", params).await
    }

    pub async fn get_token_price(&self, params: Value) -> Result<Value> {
        self.send_request("get_token_price", params).await
    }

    pub async fn swap_tokens(&self, params: Value) -> Result<Value> {
        self.send_request("swap_tokens", params).await
    }

    pub async fn search_docs(&self, params: Value) -> Result<Value> {
        self.send_request("search_docs", params).await
    }

    pub async fn get_document(&self, params: Value) -> Result<Value> {
        self.send_request("get_document", params).await
    }
}
