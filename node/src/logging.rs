use ansi_term::Colour::{Blue, Green, Purple, Red, Yellow};
use chrono::Local;
use env_logger::{Builder, Env};
use std::io::Write;

/// Initialize a colorful logger with emojis and a light startup banner.
pub fn init() {
    let env = Env::default().filter_or("RUST_LOG", "info");

    // Defer global logger initialization to the CLI/runner (some runtime
    // components initialize logging themselves). We avoid calling
    // `env_logger`/`tracing_subscriber` here to prevent double-initialization
    // which causes the node to fail at startup.

    // NOTE: if you need logging locally, enable it via the usual RUST_LOG env
    // or let the CLI/runner initialize logging.

    // Defer logging setup entirely to the CLI/runner. The runner initializes
    // logging and tracing subscribers in the correct order to avoid conflicts.

    // Simple startup banner (ANSI color) — visible even if logger is overridden
    println!("\x1b[1;35m🚀  \x1b[0m\x1b[38;5;206mAtlas Sphere Node — syncing the mesh ⚡️\x1b[0m");
}
