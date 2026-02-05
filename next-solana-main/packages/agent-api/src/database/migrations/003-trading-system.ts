/**
 * Database migration for trading system
 * Creates tables for trades, positions, and risk management
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create trades table
  await knex.schema.createTable('trades', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('token_address', 44).notNullable();
    table.string('chain_id', 20).notNullable();
    table.decimal('trade_amount_usd', 20, 2).notNullable();
    table.enum('status', ['pending', 'executing', 'completed', 'failed']).defaultTo('pending');
    table.specificType('tx_hashes', 'text[]').defaultTo('{}');
    table.integer('slices_completed').defaultTo(0);
    table.integer('total_slices').defaultTo(1);
    table.decimal('risk_score', 5, 2).nullable();
    table.string('strategy_used', 50).nullable();
    table.jsonb('metadata').nullable(); // Additional trade data
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id', 'created_at']);
    table.index(['token_address', 'chain_id']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // Create trade_slices table
  await knex.schema.createTable('trade_slices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('trade_id').notNullable().references('id').inTable('trades').onDelete('CASCADE');
    table.integer('slice_number').notNullable();
    table.decimal('amount_usd', 20, 2).notNullable();
    table.enum('status', ['pending', 'executing', 'completed', 'failed']).defaultTo('pending');
    table.string('tx_hash', 88).nullable(); // Ethereum tx hash length
    table.decimal('gas_used', 20, 0).nullable();
    table.decimal('execution_time_ms', 10, 2).nullable();
    table.jsonb('execution_details').nullable(); // DEX-specific data
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('executed_at').nullable();

    // Indexes
    table.index(['trade_id', 'slice_number']);
    table.index(['status']);
    table.index(['tx_hash']);
    table.unique(['trade_id', 'slice_number']); // Ensure slice numbers are unique per trade
  });

  // Create positions table
  await knex.schema.createTable('positions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('trade_id').notNullable().references('id').inTable('trades').onDelete('CASCADE');
    table.string('token_address', 44).notNullable();
    table.string('chain_id', 20).notNullable();
    table.decimal('entry_price', 20, 6).notNullable();
    table.decimal('current_price', 20, 6).notNullable();
    table.decimal('quantity', 30, 6).notNullable();
    table.decimal('pnl_usd', 20, 2).defaultTo(0);
    table.decimal('pnl_percentage', 8, 4).defaultTo(0);
    table.enum('status', ['open', 'closed']).defaultTo('open');
    table.decimal('take_profit_price', 20, 6).nullable();
    table.decimal('stop_loss_price', 20, 6).nullable();
    table.jsonb('metadata').nullable(); // Additional position data
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('closed_at').nullable();

    // Indexes
    table.index(['trade_id']);
    table.index(['token_address', 'chain_id']);
    table.index(['status', 'created_at']);
    table.index(['user_id', 'status']); // For user position queries
  });

  // Create risk_events table
  await knex.schema.createTable('risk_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.enum('event_type', [
      'circuit_breaker_activated',
      'circuit_breaker_deactivated',
      'daily_loss_limit_reached',
      'max_positions_reached',
      'losing_streak_warning',
      'unusual_volume_detected',
      'price_impact_warning',
      'liquidity_warning'
    ]).notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.text('message').notNullable();
    table.string('triggered_by', 100).notNullable(); // What triggered the event
    table.jsonb('event_data').nullable(); // Additional event context
    table.boolean('resolved').defaultTo(false);
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id', 'created_at']);
    table.index(['event_type', 'severity']);
    table.index(['resolved', 'created_at']);
    table.index(['created_at']);
  });

  // Create risk_settings table for user-specific risk parameters
  await knex.schema.createTable('risk_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('max_daily_loss_usd', 15, 2).defaultTo(-1000);
    table.integer('max_concurrent_positions').defaultTo(10);
    table.integer('circuit_breaker_minutes').defaultTo(30);
    table.decimal('max_position_size_usd', 15, 2).defaultTo(10000);
    table.decimal('max_trade_size_usd', 15, 2).defaultTo(50000);
    table.boolean('enable_auto_stop_loss').defaultTo(true);
    table.decimal('auto_stop_loss_percentage', 5, 2).defaultTo(-10);
    table.boolean('enable_auto_take_profit').defaultTo(true);
    table.decimal('auto_take_profit_percentage', 5, 2).defaultTo(20);
    table.jsonb('custom_rules').nullable(); // Custom risk rules
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Ensure one settings record per user
    table.unique(['user_id']);
  });

  // Create position_history table for tracking position changes
  await knex.schema.createTable('position_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('position_id').notNullable().references('id').inTable('positions').onDelete('CASCADE');
    table.enum('action', ['created', 'updated', 'closed', 'partial_close']).notNullable();
    table.decimal('price', 20, 6).notNullable();
    table.decimal('quantity', 30, 6).notNullable();
    table.decimal('pnl_usd', 20, 2).nullable();
    table.decimal('pnl_percentage', 8, 4).nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['position_id', 'created_at']);
    table.index(['action', 'created_at']);
  });

  // Create daily_pnl table for tracking daily performance
  await knex.schema.createTable('daily_pnl', (table) => {
    table.date('date').primary();
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('total_pnl_usd', 20, 2).defaultTo(0);
    table.integer('trades_count').defaultTo(0);
    table.integer('winning_trades').defaultTo(0);
    table.integer('losing_trades').defaultTo(0);
    table.decimal('win_rate_percentage', 5, 2).defaultTo(0);
    table.decimal('largest_win_usd', 20, 2).defaultTo(0);
    table.decimal('largest_loss_usd', 20, 2).defaultTo(0);
    table.jsonb('chain_breakdown').nullable(); // PnL per chain
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['user_id', 'date']);
    table.index(['date']);
  });

  // Add triggers for updated_at timestamps
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Add updated_at triggers to relevant tables
  await knex.raw(`
    CREATE TRIGGER update_trades_updated_at
      BEFORE UPDATE ON trades
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  await knex.raw(`
    CREATE TRIGGER update_positions_updated_at
      BEFORE UPDATE ON positions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  await knex.raw(`
    CREATE TRIGGER update_risk_settings_updated_at
      BEFORE UPDATE ON risk_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  await knex.raw(`
    CREATE TRIGGER update_daily_pnl_updated_at
      BEFORE UPDATE ON daily_pnl
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  console.log('Trading system tables created successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw('DROP TRIGGER IF EXISTS update_daily_pnl_updated_at ON daily_pnl;');
  await knex.raw('DROP TRIGGER IF EXISTS update_risk_settings_updated_at ON risk_settings;');
  await knex.raw('DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;');
  await knex.raw('DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;');

  // Drop function
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Drop tables in reverse order (respecting foreign keys)
  await knex.schema.dropTableIfExists('position_history');
  await knex.schema.dropTableIfExists('daily_pnl');
  await knex.schema.dropTableIfExists('risk_events');
  await knex.schema.dropTableIfExists('risk_settings');
  await knex.schema.dropTableIfExists('trade_slices');
  await knex.schema.dropTableIfExists('positions');
  await knex.schema.dropTableIfExists('trades');

  console.log('Trading system tables dropped successfully');
}
