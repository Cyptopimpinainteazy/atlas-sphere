use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Clone)]
pub struct ExternalAPIService {
  client: Client,
  brave_api_key: Option<String>,
}

impl ExternalAPIService {
  pub fn new() -> Self {
      Self {
          client: Client::new(),
          brave_api_key: std::env::var("BRAVE_API_KEY").ok(),
      }
  }

  pub async fn search_brave(&self, query: &str) -> Result<Value> {
      if let Some(api_key) = &self.brave_api_key {
          let url = "https://api.search.brave.com/res/v1/web/search";
          
          let response = self.client
              .get(url)
              .header("X-Subscription-Token", api_key)
              .query(&[("q", query), ("count", "5")])
              .send()
              .await?;

          let results: Value = response.json().await?;
          Ok(results)
      } else {
          // Fallback to mock results
          Ok(json!({
              "web": {
                  "results": [
                      {
                          "title": "Mock Search Result",
                          "url": "https://example.com",
                          "description": "This is a mock search result for: ".to_owned() + query
                      }
                  ]
              }
          }))
      }
  }

  pub async fn get_defi_llama_price(&self, token: &str) -> Result<Value> {
      let url = format!("https://api.llama.fi/prices/current/ethereum:{}", token);
      
      let response = self.client
          .get(&url)
          .send()
          .await?;

      if response.status().is_success() {
          let price_data: Value = response.json().await?;
          Ok(price_data)
      } else {
          // Return mock price data
          Ok(json!({
              "coins": {
                  format!("ethereum:{}", token): {
                      "price": 1.0,
                      "symbol": token,
                      "timestamp": chrono::Utc::now().timestamp()
                  }
              }
          }))
      }
  }

  pub async fn get_0x_quote(&self, params: HashMap<String, String>) -> Result<Value> {
      let mut url = "https://api.0x.org/swap/v1/quote?".to_string();
      for (key, value) in params {
          url.push_str(&format!("{}={}&", key, value));
      }
      url.pop(); // Remove trailing &

      let response = self.client
          .get(&url)
          .send()
          .await?;

      if response.status().is_success() {
          let quote: Value = response.json().await?;
          Ok(quote)
      } else {
          // Return mock quote
          Ok(json!({
              "price": "1.0",
              "guaranteedPrice": "1.0",
              "to": "0x...",
              "data": "0x...",
              "value": "0",
              "gas": "150000",
              "estimatedGas": "150000",
              "gasPrice": "20000000000"
          }))
      }
  }
}