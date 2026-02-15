#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use single_instance::SingleInstance;
use std::process::Command;

#[tauri::command]
async fn close_script() { 
    let process_name = "clicker.exe";
    let mut cmd = Command::new("taskkill"); // For windows systems ("pkill" - for UNIX)
    cmd.arg("/f"); // Forcible termination of the process
    cmd.arg("/IM"); // terminate process by name
    cmd.arg(process_name); // terminate process
}

fn main() {
    let is_running_app = SingleInstance::new("app").unwrap();
    if !is_running_app.is_single() {
        std::process::exit(0);
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_script])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
