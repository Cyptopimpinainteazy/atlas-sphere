use ansi_term::Colour::{Blue, Green, Purple, Red, Yellow};
use chrono::Local;
use env_logger::{Bfrontend/uilder, Env};
use std::io::Write;

/// Initialize a colorful logger with emojis and a light startup banner.
pub fn init() {
    let env = Env::default().filter_or("RUST_LOG", "info");

    Bfrontend/uilder::from_env(env)
        .format(|buf, record| {
            let ts = Local::now().format("%Y-%m-%d %H:%M:%S");
            let level = record.level();

            let (emoji, level_colored) = match level {
                log::Level::Error => ("🔥", Red.paint("ERROR")),
                log::Level::Warn => ("⚠️", Yellow.paint("WARN ")),
                log::Level::Info => ("🟢", Green.paint("INFO ")),
                log::Level::Debug => ("🐛", Purple.paint("DEBUG")),
                log::Level::Trace => ("🔍", Blue.paint("TRACE")),
            };

            writeln!(buf, "{} {} {}: {}", ts, emoji, level_colored, record.args())
        })
        .init();

    // Initialize tracing subscriber so `tracing` events are captured too
    // Forward `log` crate records into `tracing` and initialize a tracing subscriber
    let _ = tracing_log::LogTracer::init();
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    // Simple startup banner (ANSI color) — visible even if logger is overridden
    println!("\x1b[1;35m🚀  \x1b[0m\x1b[38;5;206mAtlas Sphere Node — syncing the mesh ⚡️\x1b[0m");
}
