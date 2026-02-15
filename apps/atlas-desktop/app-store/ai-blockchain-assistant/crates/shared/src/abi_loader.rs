use anyhow::Result;
use ethers::abi::Abi;
use serde_json;
use std::fs;
use std::path::Path;
use tracing::{info, warn};

pub struct AbiLoader;

impl AbiLoader {
  /// Load ERC20 ABI from file with fallback
  pub fn load_erc20_abi<P: AsRef<Path>>(path: P) -> Result<Abi> {
      let path_ref = path.as_ref();
      
      if path_ref.exists() {
          info!("Loading ERC20 ABI from file: {}", path_ref.display());
          let content = fs::read_to_string(path_ref)?;
          let abi: Abi = serde_json::from_str(&content)?;
          
          // Validate the ABI has required ERC20 functions
          if Self::validate_erc20_abi(&abi) {
              Ok(abi)
          } else {
              warn!("File does not contain a valid ERC20 ABI: {}", path_ref.display());
              Err(anyhow::anyhow!("Invalid ERC20 ABI"))
          }
      } else {
          warn!("ERC20 ABI file not found: {}", path_ref.display());
          Err(anyhow::anyhow!("ERC20 ABI file not found"))
      }
  }
  
  /// Validate that an ABI contains the required ERC20 functions
  fn validate_erc20_abi(abi: &Abi) -> bool {
      let required_functions = [
          "balanceOf",
          "totalSupply",
          "transfer",
          "transferFrom",
          "approve",
          "allowance"
      ];
      
      for func_name in &required_functions {
          if abi.function(func_name).is_err() {
              return false;
          }
      }
      
      true
  }
}