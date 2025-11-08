fn main() {
    // Skip WASM build for now due to getrandom compatibility issues
    // substrate_wasm_builder::WasmBuilder::new()
    //     .with_current_project()
    //     .build();

    // Generate a dummy WASM binary file for std builds
    #[cfg(feature = "std")] {
        use std::env;
        use std::fs;
        use std::path::Path;

        let out_dir = env::var("OUT_DIR").unwrap();
        let wasm_binary_path = Path::new(&out_dir).join("wasm_binary.rs");

        // Create a dummy WASM binary file
        let dummy_content = r#"
            pub const WASM_BINARY: Option<&[u8]> = Some(&[]);
        "#;

        fs::write(&wasm_binary_path, dummy_content).unwrap();
    }
}
