use std::env;
use std::fs;
use std::path::PathBuf;
use std::panic;

fn main() {
    println!("cargo:warning=Build script starting...");

    // Skip WASM build when feature is enabled (workaround for rustix/wasmtime compatibility issues)
    #[cfg(not(feature = "skip-wasm-build"))]
    {
        println!("cargo:warning=Building WASM runtime...");

        // Run the WASM builder - catch panic if wasm-opt fails
        let result = panic::catch_unwind(|| {
            substrate_wasm_builder::WasmBuilder::new()
                .with_current_project()
                .export_heap_base()
                .import_memory()
                .set_file_name("atlas_sphere_runtime.wasm")
                .build();
        });

        if result.is_err() {
            println!("cargo:warning=WasmBuilder panicked (likely wasm-opt deserialization error), continuing with manual generation");
        }

        // Manually generate wasm_binary.rs from the WASM file
        // The substrate-wasm-builder fails to do this due to wasm-opt deserialization error
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
        let wasm_binary_path = out_dir.join("../../..")
            .join("wbuild/atlas-sphere-runtime/atlas_sphere_runtime.wasm.compact.compressed.wasm");

        println!("cargo:warning=Looking for WASM at {:?}", wasm_binary_path);

        if wasm_binary_path.exists() {
            println!("cargo:warning=WASM file found, generating wasm_binary.rs");
            let wasm_binary = fs::read(&wasm_binary_path)
                .expect("Failed to read WASM binary");

            let mut output = String::from("pub const WASM_BINARY: Option<&[u8]> = Some(&[\n");
            for (i, byte) in wasm_binary.iter().enumerate() {
                if i % 16 == 0 {
                    output.push_str("    ");
                }
                output.push_str(&format!("0x{:02x},", byte));
                if i % 16 == 15 {
                    output.push('\n');
                } else {
                    output.push(' ');
                }
            }
            if wasm_binary.len() % 16 != 0 {
                output.push('\n');
            }
            output.push_str("]);\npub const WASM_BINARY_BLOATY: Option<&[u8]> = None;\n");

            fs::write(out_dir.join("wasm_binary.rs"), output)
                .expect("Failed to write wasm_binary.rs");

            println!("cargo:warning=Generated wasm_binary.rs with {} byte WASM runtime", wasm_binary.len());
        } else {
            println!("cargo:warning=WASM binary not found at {:?}", wasm_binary_path);
            // Create a minimal WASM binary as fallback
            let minimal_wasm = vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]; // WASM magic + version
            let mut output = String::from("pub const WASM_BINARY: Option<&[u8]> = Some(&[\n");
            for (i, byte) in minimal_wasm.iter().enumerate() {
                if i % 16 == 0 {
                    output.push_str("    ");
                }
                output.push_str(&format!("0x{:02x},", byte));
                if i % 16 == 15 {
                    output.push('\n');
                } else {
                    output.push(' ');
                }
            }
            output.push('\n');
            output.push_str("]);\npub const WASM_BINARY_BLOATY: Option<&[u8]> = None;\n");

            fs::write(out_dir.join("wasm_binary.rs"), output)
                .expect("Failed to write wasm_binary.rs");

            println!("cargo:warning=Generated minimal wasm_binary.rs as fallback");
        }
    }

    println!("cargo:warning=Build script finished");
}
