//! Mynta chain parameters

/// Network types
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Mainnet,
    Testnet,
    Regtest,
}

impl Network {
    pub fn rpc_port(&self) -> u16 {
        match self {
            Network::Mainnet => 8769,   // Mynta RPC port
            Network::Testnet => 18769,
            Network::Regtest => 18443,
        }
    }

    pub fn p2p_port(&self) -> u16 {
        match self {
            Network::Mainnet => 8770,   // Mynta mainnet P2P port
            Network::Testnet => 18770,
            Network::Regtest => 18444,
        }
    }

    pub fn default_datadir_name(&self) -> &str {
        match self {
            Network::Mainnet => "",
            Network::Testnet => "testnet7",
            Network::Regtest => "regtest",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            Network::Mainnet => "Mainnet",
            Network::Testnet => "Testnet",
            Network::Regtest => "Regtest",
        }
    }
}

impl Default for Network {
    fn default() -> Self {
        Network::Mainnet
    }
}

/// Chain parameters
pub struct ChainParams {
    pub network: Network,
    pub coin_name: &'static str,
    pub coin_ticker: &'static str,
    pub coin_decimals: u8,
    pub bip44_coin_type: u32,
    pub pubkey_prefix: u8,
    pub script_prefix: u8,
}

impl ChainParams {
    pub fn for_network(network: Network) -> Self {
        Self {
            network,
            coin_name: "Mynta",
            coin_ticker: "MYNTA",
            coin_decimals: 8,
            bip44_coin_type: 2025,  // Same as AiCoin (consensus unchanged)
            pubkey_prefix: 23,      // 'A' addresses (same as AiCoin)
            script_prefix: 83,      // 'a' addresses (same as AiCoin)
        }
    }
}

impl Default for ChainParams {
    fn default() -> Self {
        Self::for_network(Network::default())
    }
}



