use anyhow::Result;

use crate::agent::BlockchainAgent;
use crate::mcp_client::MCPClient;

#[derive(Clone)]
pub struct RIGClient {
    agent: BlockchainAgent,
}

impl RIGClient {
    pub fn new(mcp_server: &str, api_key: &str) -> Result<Self> {
        let mcp_client = MCPClient::new(mcp_server)?;
        let agent = BlockchainAgent::new(api_key, mcp_client)?;

        Ok(Self { agent })
    }

    pub async fn handle_command(&mut self, input: &str) -> Result<String> {
        // Process the command using the agent
        let response = self.agent.process_message(input).await?;

        // Print the response
        println!("{}", response);

        Ok(response)
    }
}
