use anyhow::Result;
use tracing::info;

use crate::agent::BlockchainAgent;
use crate::mcp_client::MCPClient;
use crate::repl::REPL;

pub struct RIGClient {
    agent: BlockchainAgent,
    repl: REPL,
}

impl RIGClient {
    pub fn new(mcp_server: &str, api_key: &str) -> Result<Self> {
        let mcp_client = MCPClient::new(mcp_server)?;
        let agent = BlockchainAgent::new(api_key, mcp_client)?;

        Ok(Self { agent, repl })
    }

    pub async fn run(&mut self) -> Result<()> {
        info!("Starting RIG Blockchain Client REPL");
        info!("Type 'help' for available commands");

        self.repl.run(&self.agent).await?;

        Ok(())
    }
}
