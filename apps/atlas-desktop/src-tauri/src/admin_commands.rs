use tauri::command;
use std::process::Command;

#[command]
pub async fn run_system_command(cmd: String) -> Result<String, String> {
    // For security, restrict allowed commands or sanitize input in production
    let output = Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(format!("{}{}", stdout, stderr))
}
