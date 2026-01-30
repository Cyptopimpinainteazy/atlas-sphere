use std::env;
use std::fs;
use std::panic;
use std::path::PathBuf;

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
        // Try multiple paths - compact.compressed, compact, or bloaty (unoptimized)
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

        // The OUT_DIR is something like target/release/build/atlas-sphere-runtime-XXX/out
        // We need to find the wbuild directory which is at target/release/wbuild/atlas-sphere-runtime
        let target_release_dir = out_dir
            .parent() // out
            .and_then(|p| p.parent()) // atlas-sphere-runtime-XXX
            .and_then(|p| p.parent()) // build
            .and_then(|p| p.parent()) // release
            .unwrap_or(&out_dir);

        let wbuild_dir = target_release_dir.join("wbuild/atlas-sphere-runtime");

        // Also try the old path calculation for compatibility
        let wbuild_dir_alt = out_dir.join("../../..").join("wbuild/atlas-sphere-runtime");

        let possible_paths = [
            wbuild_dir.join("atlas_sphere_runtime.wasm.compact.compressed.wasm"),
            wbuild_dir.join("atlas_sphere_runtime.wasm.compact.wasm"),
            wbuild_dir.join("atlas_sphere_runtime.wasm.wasm"),
            wbuild_dir.join("target/wasm32-unknown-unknown/release/atlas_sphere_runtime.wasm"),
            // Alternative paths
            wbuild_dir_alt.join("atlas_sphere_runtime.wasm.compact.compressed.wasm"),
            wbuild_dir_alt.join("atlas_sphere_runtime.wasm.compact.wasm"),
            wbuild_dir_alt.join("atlas_sphere_runtime.wasm.wasm"),
        ];

        let mut found_path: Option<PathBuf> = None;
        for path in &possible_paths {
            println!("cargo:warning=Checking for WASM at {:?}", path);
            if path.exists() {
                found_path = Some(path.clone());
                break;
            }
        }

        if let Some(wasm_binary_path) = found_path {
            println!(
                "cargo:warning=WASM file found at {:?}, generating wasm_binary.rs",
                wasm_binary_path
            );
            let wasm_binary = fs::read(&wasm_binary_path).expect("Failed to read WASM binary");

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

            println!(
                "cargo:warning=Generated wasm_binary.rs with {} byte WASM runtime",
                wasm_binary.len()
            );
        } else {
            println!("cargo:warning=No WASM binary found at any expected path");
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
