use std::env;

fn main() {
    // If we're *already* compiling the runtime for the WASM target, don't try to
    // invoke `substrate-wasm-builder` again.
    if env::var("TARGET").as_deref() == Ok("wasm32-unknown-unknown") {
        println!("cargo:warning=TARGET=wasm32-unknown-unknown; skipping embedded WASM build");
        return;
    }

    // When `substrate-wasm-builder` invokes a nested cargo build to produce the
    // WASM runtime, it sets `SKIP_WASM_BUILD` to prevent recursive rebuilds.
    // Honor it here so the workspace build doesn't spiral into nested builds.
    if env::var_os("SKIP_WASM_BUILD").is_some() {
        println!("cargo:warning=SKIP_WASM_BUILD is set; skipping runtime WASM build");
        return;
    }

    // Always build WASM from source with correct flags
    println!("cargo:warning=Building WASM from source with MVP features");

    // Set WASM_BUILD_NO_COLOR to avoid ANSI codes in build output
    env::set_var("WASM_BUILD_NO_COLOR", "1");
    // Disable wasm-opt completely - it can cause issues with reference types
    env::set_var("WASM_BUILD_USE_WASM_OPT", "0");

    // Use substrate-wasm-builder to build the WASM runtime
    // This will generate wasm_binary.rs in OUT_DIR automatically
    substrate_wasm_builder::WasmBuilder::new()
        .with_current_project()
        .export_heap_base()
        // Leave the output shim file name as the default (`wasm_binary.rs`).
        .build();

    println!("cargo:rerun-if-changed=build.rs");
}
