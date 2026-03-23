//! Cross-Chain Position Manager Usage Example
//!
//! This example demonstrates how to use the Cross-Chain Position Manager
//! for tracking, migrating, and managing positions across multiple EVM chains.

use cross_chain_position_manager::{
    AllocationTarget, AssetInfo, ChainType, CrossChainPositionManager, PositionManagerConfig,
    PositionTrackerConfig, PositionType, PriceSource,
};
use sp_core::{H160, U256};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Cross-Chain Position Manager Example");

    // 1. Create configuration
    let config = create_example_config();

    // 2. Initialize position manager
    let mut manager = CrossChainPositionManager::new_with_config(config)?;

    // 3. Start the manager
    manager.start().await?;
    println!("✅ Position Manager started successfully");

    // 4. Track positions across all chains
    println!("\n📊 Tracking positions across all chains...");
    let positions = manager.track_positions().await?;
    println!(
        "Found {} positions across {} chains",
        positions.len(),
        positions
            .iter()
            .map(|p| p.metadata.chain_id)
            .collect::<std::collections::HashSet<_>>()
            .len()
    );

    // 5. Get portfolio summary
    println!("\n💼 Portfolio Summary:");
    let summary = manager.get_portfolio_summary().await?;
    println!("Total Value: ${}", summary.total_value_usd);
    println!("Risk Score: {:.2}/1.0", summary.risk_score);
    println!("Active Arbitrage Ops: {}", summary.active_arbitrage_ops);

    // 6. Example: Migrate a position from Base to Arbitrum
    if let Some(position) = positions.first() {
        println!(
            "\n🔄 Migrating position {} from Base to Arbitrum",
            position.id
        );

        let migration_result = manager
            .migrate_position(
                ChainType::Base.chain_id(),
                ChainType::Arbitrum.chain_id(),
                &position.id,
            )
            .await?;

        if migration_result.success {
            println!("✅ Migration successful!");
            println!("  Migration ID: {}", migration_result.migration_id);
            println!(
                "  Estimated Duration: {}ms",
                migration_result.estimated_duration_ms
            );
            println!("  Gas Cost: {}", migration_result.gas_cost_estimate);
            println!(
                "  Slippage: {:.2}%",
                migration_result.slippage_estimate * 100.0
            );
        } else {
            println!("❌ Migration failed");
        }
    }

    // 7. Example: Rebalance portfolio
    println!("\n⚖️  Rebalancing portfolio...");
    let targets = create_rebalance_targets();
    let rebalance_result = manager.rebalance(&targets).await?;

    if rebalance_result.success {
        println!("✅ Rebalancing successful!");
        println!("  Rebalance ID: {}", rebalance_result.rebalance_id);
        println!("  Actions Executed: {}", rebalance_result.actions_executed);
        println!("  Total Cost: ${}", rebalance_result.total_cost_usd);
        println!(
            "  Improvement: {:.2}%",
            rebalance_result.improvement_estimate * 100.0
        );
    } else {
        println!("❌ Rebalancing failed");
    }

    // 8. Example: Evaluate arbitrage opportunities
    println!("\n💰 Evaluating arbitrage opportunities...");
    let opportunities = manager.evaluate_arbitrage().await?;

    if !opportunities.is_empty() {
        println!("Found {} arbitrage opportunities", opportunities.len());
        for (i, opp) in opportunities.iter().enumerate() {
            println!(
                "  Opportunity {}: Profit ${}, Confidence {:.1}%",
                i + 1,
                opp.profit_estimate_usd,
                opp.confidence * 100.0
            );
        }
    } else {
        println!("No arbitrage opportunities found");
    }

    // 9. Example: Check kill switches
    println!("\n🚨 Checking kill switches...");
    let kill_switches = manager.check_kill_switches().await?;

    if !kill_switches.is_empty() {
        println!("⚠️  {} kill switches triggered:", kill_switches.len());
        for trigger in kill_switches {
            println!(
                "  Chain {}: {} - {}",
                trigger.chain_id, trigger.trigger_type, trigger.description
            );
        }
    } else {
        println!("✅ All kill switches normal");
    }

    // 10. Stop the manager
    manager.stop().await?;
    println!("\n🛑 Position Manager stopped");

    Ok(())
}

/// Create example configuration
fn create_example_config() -> PositionManagerConfig {
    let mut config = PositionManagerConfig::default();

    // Configure tracking
    config.tracking_config = PositionTrackerConfig {
        update_interval_ms: 5000,
        max_concurrent_positions: 1000,
        real_time_updates: true,
        batch_size: 50,
        collect_metrics: true,
        enable_events: true,
    };

    // Configure chains
    config.chain_configs.insert(
        ChainType::Base.chain_id(),
        create_chain_config(ChainType::Base),
    );
    config.chain_configs.insert(
        ChainType::Arbitrum.chain_id(),
        create_chain_config(ChainType::Arbitrum),
    );
    config.chain_configs.insert(
        ChainType::Polygon.chain_id(),
        create_chain_config(ChainType::Polygon),
    );
    config.chain_configs.insert(
        ChainType::Avalanche.chain_id(),
        create_chain_config(ChainType::Avalanche),
    );
    config.chain_configs.insert(
        ChainType::Bnb.chain_id(),
        create_chain_config(ChainType::Bnb),
    );

    // Configure risk management
    config.risk_config.max_position_size_usd = U256::from(100_000_000_000_000_000_000u128); // 100k USD
    config.risk_config.max_exposure_per_chain = 0.3; // 30% per chain
    config.risk_config.max_correlation = 0.7;
    config.risk_config.liquidation_threshold = 0.8;
    config.risk_config.stop_loss_percentage = 0.1; // 10%

    config
}

/// Create chain configuration
fn create_chain_config(chain_type: ChainType) -> crate::ChainConfig {
    crate::ChainConfig {
        chain_id: chain_type.chain_id(),
        gas_price_multiplier: match chain_type {
            ChainType::Base => 1.2,
            ChainType::Arbitrum => 1.5,
            ChainType::Polygon => 0.8,
            ChainType::Avalanche => 1.0,
            ChainType::Bnb => 0.5,
            _ => 1.0,
        },
        min_gas_price: U256::from(1_000_000_000),   // 1 gwei
        max_gas_price: U256::from(100_000_000_000), // 100 gwei
        bridge_timeout_ms: 300_000,                 // 5 minutes
        confirmations_required: 12,
        native_token_decimals: 18,
        supports_eip1559: true,
    }
}

/// Create rebalancing targets
fn create_rebalance_targets() -> Vec<AllocationTarget> {
    vec![
        AllocationTarget {
            chain_id: ChainType::Base.chain_id(),
            asset: H160::from_low_u64_be(0), // Native token
            target_percentage: 0.4,          // 40%
            min_amount: U256::from(100_000_000_000_000_000u128), // 0.1 ETH
            max_amount: U256::from(10_000_000_000_000_000_000u128), // 10 ETH
        },
        AllocationTarget {
            chain_id: ChainType::Arbitrum.chain_id(),
            asset: H160::from_low_u64_be(1),                 // USDC
            target_percentage: 0.3,                          // 30%
            min_amount: U256::from(1000_000_000_000u128),    // 1000 USDC
            max_amount: U256::from(100_000_000_000_000u128), // 100000 USDC
        },
        AllocationTarget {
            chain_id: ChainType::Polygon.chain_id(),
            asset: H160::from_low_u64_be(2),                 // USDT
            target_percentage: 0.2,                          // 20%
            min_amount: U256::from(1000_000_000_000u128),    // 1000 USDT
            max_amount: U256::from(100_000_000_000_000u128), // 100000 USDT
        },
        AllocationTarget {
            chain_id: ChainType::Avalanche.chain_id(),
            asset: H160::from_low_u64_be(3),                // DAI
            target_percentage: 0.1,                         // 10%
            min_amount: U256::from(1000_000_000_000u128),   // 1000 DAI
            max_amount: U256::from(50_000_000_000_000u128), // 50000 DAI
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_creation() {
        let config = create_example_config();
        assert!(config.chain_configs.len() > 0);
        assert!(config.risk_config.max_position_size_usd > U256::zero());
    }

    #[test]
    fn test_rebalance_targets() {
        let targets = create_rebalance_targets();
        assert_eq!(targets.len(), 4);

        let total_percentage: f64 = targets.iter().map(|t| t.target_percentage).sum();
        assert!((total_percentage - 1.0).abs() < 0.001);
    }
}
