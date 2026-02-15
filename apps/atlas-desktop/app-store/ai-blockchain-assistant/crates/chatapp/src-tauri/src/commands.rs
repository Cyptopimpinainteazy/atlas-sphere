use anyhow::Result;
use regex::Regex;
use serde_json::json;

pub trait Command {
  fn matches(&self, input: &str) -> bool;
  fn execute(&self, input: &str) -> Result<serde_json::Value>;
}

pub struct SendEthCommand;

impl Command for SendEthCommand {
  fn matches(&self, input: &str) -> bool {
      let re = Regex::new(r"(?i)send\s+(\d+(?:\.\d+)?)\s+ETH\s+from\s+(\w+)\s+to\s+(\w+)").unwrap();
      re.is_match(input)
  }
  
  fn execute(&self, input: &str) -> Result<serde_json::Value> {
      let re = Regex::new(r"(?i)send\s+(\d+(?:\.\d+)?)\s+ETH\s+from\s+(\w+)\s+to\s+(\w+)").unwrap();
      
      if let Some(caps) = re.captures(input) {
          let amount = caps.get(1).unwrap().as_str();
          let from = caps.get(2).unwrap().as_str();
          let to = caps.get(3).unwrap().as_str();
          
          Ok(json!({
              "method": "send_eth",
              "params": {
                  "from": from,
                  "to": to,
                  "amount": amount
              }
          }))
      } else {
          Err(anyhow::anyhow!("Invalid send ETH command"))
      }
  }
}

pub struct CheckBalanceCommand;

impl Command for CheckBalanceCommand {
  fn matches(&self, input: &str) -> bool {
      let re = Regex::new(r"(?i)how\s+much\s+(ETH|USDC|[A-Za-z]+)\s+does\s+(\w+)\s+have").unwrap();
      re.is_match(input)
  }
  
  fn execute(&self, input: &str) -> Result<serde_json::Value> {
      let re = Regex::new(r"(?i)how\s+much\s+(ETH|USDC|[A-Za-z]+)\s+does\s+(\w+)\s+have").unwrap();
      
      if let Some(caps) = re.captures(input) {
          let token = caps.get(1).unwrap().as_str();
          let account = caps.get(2).unwrap().as_str();
          
          let token_param = if token.to_uppercase() == "ETH" {
              None
          } else {
              // In a real implementation, you'd look up the token address
              Some("0xA0b86a33E6441b8bD0b5b4b0C9c0b0e0b0e0b0e0")
          };
          
          Ok(json!({
              "method": "get_balance",
              "params": {
                  "address": account,
                  "token": token_param
              }
          }))
      } else {
          Err(anyhow::anyhow!("Invalid check balance command"))
      }
  }
}

pub struct CheckContractCommand;

impl Command for CheckContractCommand {
  fn matches(&self, input: &str) -> bool {
      let re = Regex::new(r"(?i)is\s+(.+?)\s+(?:contract\s+)?deployed").unwrap();
      re.is_match(input)
  }
  
  fn execute(&self, input: &str) -> Result<serde_json::Value> {
      let re = Regex::new(r"(?i)is\s+(.+?)\s+(?:contract\s+)?deployed").unwrap();
      
      if let Some(caps) = re.captures(input) {
          let contract = caps.get(1).unwrap().as_str();
          
          // Extract address if it's in the format "Name (0x...)"
          let address_re = Regex::new(r"(.+?)\s*\(([0-9a-fA-F]{40}|0x[0-9a-fA-F]{40})\)").unwrap();
          let address = if let Some(addr_caps) = address_re.captures(contract) {
              addr_caps.get(2).unwrap().as_str()
          } else {
              contract
          };
          
          Ok(json!({
              "method": "check_contract",
              "params": {
                  "address": address
              }
          }))
      } else {
          Err(anyhow::anyhow!("Invalid check contract command"))
      }
  }
}