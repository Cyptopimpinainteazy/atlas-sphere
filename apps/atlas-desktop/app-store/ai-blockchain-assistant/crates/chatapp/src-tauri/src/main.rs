// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use anyhow::Result;
use app_lib::client::RIGClient;
use clap::Parser;
use dotenv::dotenv;
use tauri::State;
use tracing::info;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "127.0.0.1:3000")]
    mcp_server: String,

    #[arg(short, long, env = "ANTHROPIC_API_KEY")]
    api_key: String,
}

struct AppState {
    client: RIGClient,
}

#[tauri::command]
fn process_command(command: String, state: State<'_, AppState>) -> Result<String, String> {
    println!("Processing command: {}", command);
    let mut cloned = state.client.clone();
    let res: Result<String> = futures::executor::block_on(cloned.handle_command(&command));
    match res {
        Ok(response) => Ok(response),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let args = Args::parse();
    info!("MCP Server: {}", args.mcp_server);

    let client = RIGClient::new(&args.mcp_server, &args.api_key)?;

    tauri::Builder::default()
        .manage(AppState { client: client })
        .invoke_handler(tauri::generate_handler![process_command])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
