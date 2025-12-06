use std::env;

fn main() {
    // Skip WASM build when feature is enabled
    #[cfg(not(feature = "skip-wasm-build"))]
    {
        // Set WASM_BUILD_NO_COLOR to avoid ANSI codes in build output
        env::set_var("WASM_BUILD_NO_COLOR", "1");
        // Disable wasm-opt completely - it can cause issues with reference types
        env::set_var("WASM_BUILD_USE_WASM_OPT", "0");

        // Use substrate-wasm-builder to build the WASM runtime
        // This will generate wasm_binary.rs in OUT_DIR automatically
        substrate_wasm_builder::WasmBuilder::new()
            .with_current_project()
            .export_heap_base()
            .import_memory()
            .set_file_name("atlas_sphere_runtime.wasm")
            .build();
    }

    println!("cargo:rerun-if-changed=build.rs");
}
