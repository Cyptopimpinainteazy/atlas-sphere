use anyhow::Result;
use clap::Parser;
use dotenv::dotenv;
use rig_client::client::RIGClient;
use tracing::{Level, info};
use tracing_subscriber;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "127.0.0.1:3000")]
    mcp_server: String,

    #[arg(short, long, env = "ANTHROPIC_API_KEY")]
    api_key: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    // Initialize tracing
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    let args = Args::parse();

    info!("Starting RIG Blockchain Client");
    info!("MCP Server: {}", args.mcp_server);

    let mut client = RIGClient::new(&args.mcp_server, &args.api_key)?;
    client.run().await?;

    Ok(())
}
