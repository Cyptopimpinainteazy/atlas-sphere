pub mod server;
pub mod tools;
pub mod blockchain;
pub mod external_apis;
pub mod rag_service;

use anyhow::Result;
use ethers::providers::{Http, Provider};
use std::sync::Arc;

pub type EthProvider = Arc<Provider<Http>>;

pub async fn create_provider(rpc_url: &str) -> Result<EthProvider> {
  let provider = Provider::<Http>::try_from(rpc_url)?;
  Ok(Arc::new(provider))
}