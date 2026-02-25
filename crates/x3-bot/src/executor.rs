use crate::config::BotConfig;
use crate::rpc_pool::RpcPool;
use crate::market::MarketScanner;
use crate::strategy::ArbitrageStrategy;
use crate::tx_manager::TxManager;
use crate::wallet::BotWallet;
use crate::telemetry::{self, TRADES_EXECUTED, ARB_OPPORTUNITIES};
use atomic_swap_orchestrator::{AtomicSwapOrchestrator, AtomicPair};
use x3_vm::{VM, BytecodeModule};

use std::sync::Arc;
use tokio::time::{interval, Duration};
use ethers::prelude::*;
use anyhow::Result;
use tracing::{info, error, warn};

pub async fn run(cfg: BotConfig, pool_evm: Arc<RpcPool>, pool_svm: Arc<RpcPool>) -> Result<()> {
    telemetry::init();
    info!("Cross-Chain Atomic Executor starting — EVM: {}, SVM Enabled", cfg.evm_chain_id);

    // Initialize X3 VM for GPU hostcalls
    let vm = VM::new(BytecodeModule::default());
    let orchestrator = Arc::new(AtomicSwapOrchestrator::new(vm));

    let wallet_evm = BotWallet::new(&cfg.wallet_key_evm, cfg.evm_chain_id)?;
    wallet_evm.verify_signing().await?;
    info!("EVM Wallet verified: {:?}", wallet_evm.address);

    let provider_evm = pool_evm.get_next();
    let scanner_evm = MarketScanner::new(provider_evm.clone());
    let manager_evm = TxManager::new(provider_evm.clone(), cfg.evm_chain_id);
    let strategy = ArbitrageStrategy::new(cfg.arb_threshold_bps);

    let router_evm: Address = cfg.evm_router.parse()?;

    let mut tick = interval(Duration::from_millis(100)); // Faster 100ms cycles

    loop {
        tick.tick().await;
        let provider_evm = pool_evm.get_next(); 
        
        let price_evm = match scanner_evm.calculate_price(router_evm).await {
            Ok(p) => p,
            Err(e) => { warn!("Failed to fetch EVM Price: {}", e); continue; }
        };

        // For demonstration of the P5 Dual-Chain Orchestrator:
        // We simulate a cross-chain pair when an EVM opportunity is detected.
        if let Some(profit) = strategy.scan_opportunity(price_evm, price_evm) {
            ARB_OPPORTUNITIES.inc();
            info!("🔥 Cross-Chain Opportunity found! Profit: {} bps", profit);
            
            let pair = AtomicPair {
                swap_id: uuid::Uuid::new_v4().as_bytes().to_vec(),
                svm_tx: vec![0xDE, 0xAD, 0xBE, 0xEF], // Mocked SVM Intent
                evm_tx: vec![0xCA, 0xFE, 0xBA, 0xBE], // Mocked EVM Intent
            };

            use crate::telemetry::{ATOMIC_SWAPS_STARTED, ATOMIC_SWAPS_SUCCESS, ATOMIC_SWAPS_FAILED};
            ATOMIC_SWAPS_STARTED.inc();

            match orchestrator.process_swap(pair).await {
                Ok(status) => {
                    info!("🚀 Atomic Swap Status: {:?}", status);
                    ATOMIC_SWAPS_SUCCESS.inc();
                    TRADES_EXECUTED.inc();
                }
                Err(e) => {
                    error!("Atomic swap failed: {}", e);
                    ATOMIC_SWAPS_FAILED.inc();
                }
            }
        }
    }
}
