use anthropic_sdk::{
    Anthropic, ContentBlock, MessageContent, MessageCreateBuilder, MessageParam, Role, Tool,
    ToolResult, ToolResultContent, ToolUse,
};
use anyhow::Result;
use serde_json::{from_value, json, Value};
use std::sync::Arc;
use tracing::info;

use crate::mcp_client::MCPClient;

#[derive(Clone)]
pub struct BlockchainAgent {
    client: Arc<Anthropic>,
    mcp_client: Arc<MCPClient>,
    conversation_history: Vec<MessageParam>,
}

impl BlockchainAgent {
    pub fn new(api_key: &str, mcp_client: MCPClient) -> Result<Self> {
        let client = Arc::new(Anthropic::new(api_key).expect("Creating Agent has been failed"));
        // Define initial system message
        let system_message = "You are a helpful AI assistant specialized in Ethereum blockchain operations. \
          You can help users interact with the Ethereum blockchain using natural language. \
          You can perform operations like checking balances, sending transactions, and interacting with smart contracts. \
          You also have access to documentation about blockchain protocols and smart contracts through the RAG system. \
          When users ask you to perform blockchain operations, use the appropriate tools to fulfill their requests. \
          When users ask about how blockchain protocols or smart contracts work, use the search_docs tool to find relevant information. \
          Always explain what you're doing in simple terms.";

        let conversation_history = vec![MessageParam {
            role: Role::User,
            content: MessageContent::Text(system_message.to_string()),
        }];

        Ok(Self {
            client,
            mcp_client: Arc::new(mcp_client),
            conversation_history,
        })
    }

    pub async fn process_message(&mut self, user_message: &str) -> Result<String> {
        // Add user message to history
        self.conversation_history.push(MessageParam {
            role: Role::User,
            content: MessageContent::Text(user_message.to_string()),
        });

        // Define available tools
        let tools = vec![
            Tool {
                name: "get_balance".to_string(),
                description: "Get the balance of an Ethereum address or named account".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "address": {
                            "type": "string",
                            "description": "The Ethereum address or named account (alice, bob) to check balance for"
                        },
                        "token": {
                            "type": "string",
                            "description": "Optional token address to check balance for. If not provided, ETH balance is returned."
                        }
                    },
                    "required": ["address"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "send_eth".to_string(),
                description: "Send ETH from one account to another".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "from": {
                            "type": "string",
                            "description": "The sender's address or named account (alice, bob)"
                        },
                        "to": {
                            "type": "string",
                            "description": "The recipient's address or named account (alice, bob)"
                        },
                        "amount": {
                            "type": "string",
                            "description": "The amount of ETH to send (e.g., '1.0')"
                        }
                    },
                    "required": ["from", "to", "amount"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "check_contract".to_string(),
                description: "Check if a contract is deployed at a specific address".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "address": {
                            "type": "string",
                            "description": "The contract address or name (e.g., 'uniswap_v2_router')"
                        }
                    },
                    "required": ["address"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "search_web".to_string(),
                description: "Search the web for information".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query"
                        }
                    },
                    "required": ["query"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "get_token_price".to_string(),
                description: "Get the current price of a token".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "token": {
                            "type": "string",
                            "description": "The token address or symbol"
                        }
                    },
                    "required": ["token"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "swap_tokens".to_string(),
                description: "Swap tokens using Uniswap".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "from_token": {
                            "type": "string",
                            "description": "The address or symbol of the token to swap from"
                        },
                        "to_token": {
                            "type": "string",
                            "description": "The address or symbol of the token to swap to"
                        },
                        "amount": {
                            "type": "string",
                            "description": "The amount to swap"
                        },
                        "recipient": {
                            "type": "string",
                            "description": "The recipient address or named account"
                        }
                    },
                    "required": ["from_token", "to_token", "amount", "recipient"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "search_docs".to_string(),
                description: "Search the documentation for information about blockchain protocols and smart contracts".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "The maximum number of results to return (default: 5)"
                        },
                        "source": {
                            "type": "string",
                            "description": "Optional source to filter results (e.g., 'uniswap-v2', 'contracts')"
                        }
                    },
                    "required": ["query"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
            Tool {
                name: "get_document".to_string(),
                description: "Get a specific document by ID".to_string(),
                input_schema: from_value(json!({
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "The document ID"
                        }
                    },
                    "required": ["id"]
                })).expect("Failed to deserilize ToolInputSchema"),
            },
        ];

        let mut params = MessageCreateBuilder::new("claude-sonnet-4-20250514", 2000)
            .tools(tools)
            .build();
        params.messages = self.conversation_history.clone();

        // Create message with tools
        let response = self.client.messages().create(params).await?;

        let mut final_response = String::new();

        // Process tool uses if any
        for content_block in &response.content {
            match content_block {
                ContentBlock::Text { text } => {
                    final_response.push_str(text);
                }
                ContentBlock::ToolUse { id, name, input } => {
                    // Handle tool use
                    let tool_use = ToolUse {
                        id: id.clone(),
                        name: name.clone(),
                        input: input.clone(),
                    };

                    let tool_result = self.execute_tool(tool_use).await?;

                    match &tool_result.content {
                        ToolResultContent::Text(text) => {
                            if tool_result.is_error.unwrap_or(false) {
                                final_response.push_str(&format!("\nTool error: {}\n", text));
                            } else {
                                final_response.push_str(&format!("\nTool result: {}\n", text));
                            }
                        }
                        ToolResultContent::Json(json_value) => {
                            final_response.push_str(&format!("\nTool result: {}\n", json_value));
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        }

        // Add assistant message to history
        self.conversation_history.push(MessageParam {
            role: Role::Assistant,
            content: MessageContent::Text(final_response.clone()),
        });

        Ok(final_response)
    }

    async fn execute_tool(&self, tool_use: ToolUse) -> Result<ToolResult> {
        info!("Executing tool: {}", tool_use.name);
        info!("Tool input: {}", tool_use.input);

        let input: Value = tool_use.input.clone();

        let result = match tool_use.name.as_str() {
            "get_balance" => self.mcp_client.get_balance(input).await?,
            "send_eth" => self.mcp_client.send_eth(input).await?,
            "check_contract" => self.mcp_client.check_contract(input).await?,
            "search_web" => self.mcp_client.search_web(input).await?,
            "get_token_price" => self.mcp_client.get_token_price(input).await?,
            "swap_tokens" => self.mcp_client.swap_tokens(input).await?,
            "search_docs" => self.mcp_client.search_docs(input).await?,
            "get_document" => self.mcp_client.get_document(input).await?,
            _ => {
                return Err(anyhow::anyhow!("Unknown tool: {}", tool_use.name));
            }
        };

        let result_str = serde_json::to_string_pretty(&result)?;

        Ok(ToolResult {
            tool_use_id: tool_use.id,
            is_error: Some(false),
            content: ToolResultContent::Text(result_str),
        })
    }
}
