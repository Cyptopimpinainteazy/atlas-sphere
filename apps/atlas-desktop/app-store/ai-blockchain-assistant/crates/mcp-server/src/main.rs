use anyhow::Result;
use ethers::providers::{Provider, Http};
use std::sync::Arc;
use tracing_subscriber::FmtSubscriber;

// Type alias for the Ethereum provider
pub type EthProvider = Arc<Provider<Http>>;

use mcp_server::blockchain::BlockchainService;
use mcp_server::tools::ToolRegistry;
use mcp_server::server::Server;
use shared::get_test_accounts;

#[tokio::main]
async fn main() -> Result<()> {
  // Initialize tracing
  let subscriber = FmtSubscriber::builder()
      .with_max_level(tracing::Level::INFO)
      .finish();
  tracing::subscriber::set_global_default(subscriber)?;
  
  // Create Ethereum provider
  let provider_url = std::env::var("ETH_RPC_URL").unwrap_or_else(|_| "http://localhost:8545".to_string());
  let provider = Provider::<Http>::try_from(provider_url)?;
  let provider = Arc::new(provider);
  
  // Create blockchain service
  let blockchain_service = BlockchainService::new(provider)?;
  
  // Create and register tools
  let mut tool_registry = ToolRegistry::new();
  tool_registry.register_default_tools();
  
  // Get test accounts
  let accounts = get_test_accounts();
  
  // Create server
  let server = Server::new(blockchain_service, tool_registry, accounts);
  
  // Run server
  let server_addr = std::env::var("SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_string());
  server.run(&server_addr).await?;
  
  Ok(())
}