import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create influencers table
  await knex.schema.createTable("influencers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("persona_id").notNullable();
    table.string("name").notNullable();
    table.enum("status", ["active", "inactive", "paused", "suspended"]).defaultTo("active");
    table.jsonb("config").defaultTo("{}");
    table.jsonb("social_accounts").defaultTo("{}");
    table.jsonb("growth_settings").defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index("persona_id");
    table.index("status");
    table.index("created_at");
  });

  // Create influencer_content table
  await knex.schema.createTable("influencer_content", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("influencer_id").notNullable();
    table.enum("platform", ["twitter", "discord", "telegram", "instagram", "tiktok", "youtube"]).notNullable();
    table.text("content").notNullable();
    table.string("content_type").defaultTo("text"); // text, image, video, meme, thread
    table.decimal("viral_score", 5, 2).defaultTo(0);
    table.jsonb("engagement_metrics").defaultTo("{}");
    table.jsonb("optimization_data").defaultTo("{}");
    table.string("external_id"); // Platform-specific post ID
    table.enum("status", ["draft", "scheduled", "published", "failed"]).defaultTo("draft");
    table.timestamp("scheduled_at", { useTz: true });
    table.timestamp("published_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("influencer_id").references("id").inTable("influencers").onDelete("CASCADE");
    
    // Indexes
    table.index("influencer_id");
    table.index("platform");
    table.index("viral_score");
    table.index("status");
    table.index("scheduled_at");
    table.index("published_at");
    table.index("created_at");
    table.index(["influencer_id", "platform"]);
  });

  // Create viral_campaigns table
  await knex.schema.createTable("viral_campaigns", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("influencer_id").notNullable();
    table.string("name").notNullable();
    table.text("description");
    table.enum("status", ["planning", "active", "paused", "completed", "cancelled"]).defaultTo("planning");
    table.enum("campaign_type", ["viral_boost", "follower_growth", "engagement", "trend_hijack", "cross_platform"]).notNullable();
    table.jsonb("metrics").defaultTo("{}");
    table.jsonb("target_metrics").defaultTo("{}");
    table.jsonb("strategy_config").defaultTo("{}");
    table.jsonb("platforms").defaultTo("[]");
    table.decimal("budget", 10, 2).defaultTo(0);
    table.timestamp("start_date", { useTz: true });
    table.timestamp("end_date", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("influencer_id").references("id").inTable("influencers").onDelete("CASCADE");
    
    // Indexes
    table.index("influencer_id");
    table.index("status");
    table.index("campaign_type");
    table.index("start_date");
    table.index("end_date");
    table.index("created_at");
  });

  // Create follower_growth table
  await knex.schema.createTable("follower_growth", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("influencer_id").notNullable();
    table.enum("platform", ["twitter", "discord", "telegram", "instagram", "tiktok", "youtube"]).notNullable();
    table.integer("follower_count").notNullable().defaultTo(0);
    table.integer("following_count").defaultTo(0);
    table.decimal("growth_rate", 8, 4).defaultTo(0); // Percentage growth
    table.decimal("engagement_rate", 5, 2).defaultTo(0);
    table.integer("daily_new_followers").defaultTo(0);
    table.integer("daily_unfollowers").defaultTo(0);
    table.jsonb("demographics").defaultTo("{}");
    table.jsonb("quality_metrics").defaultTo("{}");
    table.date("date").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("influencer_id").references("id").inTable("influencers").onDelete("CASCADE");
    
    // Unique constraint for one record per influencer/platform/date
    table.unique(["influencer_id", "platform", "date"]);
    
    // Indexes
    table.index("influencer_id");
    table.index("platform");
    table.index("date");
    table.index("growth_rate");
    table.index("engagement_rate");
    table.index(["influencer_id", "platform"]);
    table.index(["platform", "date"]);
  });

  // Create content_performance table
  await knex.schema.createTable("content_performance", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("content_id").notNullable();
    table.enum("platform", ["twitter", "discord", "telegram", "instagram", "tiktok", "youtube"]).notNullable();
    table.integer("likes").defaultTo(0);
    table.integer("shares").defaultTo(0);
    table.integer("comments").defaultTo(0);
    table.integer("reach").defaultTo(0);
    table.integer("impressions").defaultTo(0);
    table.integer("clicks").defaultTo(0);
    table.decimal("engagement_rate", 5, 2).defaultTo(0);
    table.decimal("viral_coefficient", 8, 4).defaultTo(0);
    table.jsonb("detailed_metrics").defaultTo("{}");
    table.jsonb("audience_insights").defaultTo("{}");
    table.timestamp("timestamp", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("content_id").references("id").inTable("influencer_content").onDelete("CASCADE");
    
    // Indexes
    table.index("content_id");
    table.index("platform");
    table.index("engagement_rate");
    table.index("viral_coefficient");
    table.index("timestamp");
    table.index("created_at");
    table.index(["content_id", "timestamp"]);
  });

  // Create influencer_trends table for trend tracking
  await knex.schema.createTable("influencer_trends", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("influencer_id").notNullable();
    table.string("trend_name").notNullable();
    table.string("trend_category"); // crypto, meme, tech, etc.
    table.enum("platform", ["twitter", "discord", "telegram", "instagram", "tiktok", "youtube"]).notNullable();
    table.decimal("trend_strength", 5, 2).defaultTo(0);
    table.enum("participation_status", ["monitoring", "participating", "amplifying", "completed"]).defaultTo("monitoring");
    table.jsonb("trend_data").defaultTo("{}");
    table.jsonb("participation_metrics").defaultTo("{}");
    table.timestamp("trend_start", { useTz: true });
    table.timestamp("trend_peak", { useTz: true });
    table.timestamp("participation_start", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("influencer_id").references("id").inTable("influencers").onDelete("CASCADE");
    
    // Indexes
    table.index("influencer_id");
    table.index("trend_name");
    table.index("platform");
    table.index("trend_strength");
    table.index("participation_status");
    table.index("trend_start");
    table.index("created_at");
  });

  // Create content_templates table for meme and content templates
  await knex.schema.createTable("content_templates", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name").notNullable();
    table.enum("template_type", ["meme", "thread", "post", "story", "video"]).notNullable();
    table.enum("category", ["crypto", "meme", "educational", "hype", "fud", "general"]).notNullable();
    table.text("template_content").notNullable();
    table.jsonb("variables").defaultTo("[]"); // Template variables
    table.jsonb("platform_adaptations").defaultTo("{}");
    table.decimal("success_rate", 5, 2).defaultTo(0);
    table.integer("usage_count").defaultTo(0);
    table.decimal("avg_viral_score", 5, 2).defaultTo(0);
    table.boolean("is_active").defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Indexes
    table.index("template_type");
    table.index("category");
    table.index("success_rate");
    table.index("is_active");
    table.index("created_at");
  });

  // Create influencer_analytics table for aggregated analytics
  await knex.schema.createTable("influencer_analytics", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("influencer_id").notNullable();
    table.enum("period", ["hourly", "daily", "weekly", "monthly"]).notNullable();
    table.jsonb("engagement_metrics").defaultTo("{}");
    table.jsonb("growth_metrics").defaultTo("{}");
    table.jsonb("content_metrics").defaultTo("{}");
    table.jsonb("viral_metrics").defaultTo("{}");
    table.jsonb("platform_breakdown").defaultTo("{}");
    table.decimal("overall_score", 5, 2).defaultTo(0);
    table.timestamp("period_start", { useTz: true }).notNullable();
    table.timestamp("period_end", { useTz: true }).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Foreign key
    table.foreign("influencer_id").references("id").inTable("influencers").onDelete("CASCADE");
    
    // Unique constraint for one record per influencer/period/timeframe
    table.unique(["influencer_id", "period", "period_start"]);
    
    // Indexes
    table.index("influencer_id");
    table.index("period");
    table.index("overall_score");
    table.index("period_start");
    table.index("period_end");
    table.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order to handle foreign key constraints
  await knex.schema.dropTableIfExists("influencer_analytics");
  await knex.schema.dropTableIfExists("content_templates");
  await knex.schema.dropTableIfExists("influencer_trends");
  await knex.schema.dropTableIfExists("content_performance");
  await knex.schema.dropTableIfExists("follower_growth");
  await knex.schema.dropTableIfExists("viral_campaigns");
  await knex.schema.dropTableIfExists("influencer_content");
  await knex.schema.dropTableIfExists("influencers");
}