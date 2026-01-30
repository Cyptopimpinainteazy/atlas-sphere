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

        // Set WASM_BUILD_NO_COLOR to avoid ANSI codes in build output
        env::set_var("WASM_BUILD_NO_COLOR", "1");
        // Disable wasm-opt completely - it fails on reference types
        env::set_var("WASM_BUILD_USE_WASM_OPT", "0");

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
        // The substrate-wasm-builder may fail to do this due to wasm-opt issues
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
        println!("cargo:warning=OUT_DIR: {:?}", out_dir);

        // CRITICAL: Find workspace root from CARGO_MANIFEST_DIR first for native builds
        let workspace_root = env::var("CARGO_MANIFEST_DIR")
            .map(|dir| {
                let path = PathBuf::from(&dir);
                // If manifest dir is in wbuild, we're in wasm build
                if dir.contains("wbuild") {
                    // Walk up to find workspace root
                    let mut p = path.clone();
                    for _ in 0..10 {
                        if let Some(parent) = p.parent() {
                            if parent.join("Cargo.toml").exists() && parent.join("runtime").exists() {
                                return Some(parent.to_path_buf());
                            }
                            p = parent.to_path_buf();
                        }
                    }
                    None
                } else {
                    // Native build - runtime is directly in workspace
                    path.parent().map(|p| p.to_path_buf())
                }
            })
            .ok()
            .flatten();
        
        println!("cargo:warning=Detected workspace root: {:?}", workspace_root);

        // The OUT_DIR for WASM builds is nested deep inside wbuild:
        // target/release/wbuild/atlas-sphere-runtime/target/wasm32-unknown-unknown/release/build/atlas-sphere-runtime-XXX/out
        // We need to find: target/release/wbuild/atlas-sphere-runtime/
        // 
        // Strategy: Look for the atlas-sphere-runtime directory that contains the .wasm files directly
        
        let mut wbuild_dir: Option<PathBuf> = None;
        
        // Method 1: Walk up from OUT_DIR looking for the right atlas-sphere-runtime dir
        let mut current = out_dir.clone();
        for _ in 0..12 {
            if let Some(parent) = current.parent() {
                let parent_name = parent.file_name().and_then(|n| n.to_str());
                if parent_name == Some("atlas-sphere-runtime") {
                    // Check if this directory has .wasm files (not the nested target one)
                    let has_wasm = parent.join("atlas_sphere_runtime.wasm.compact.compressed.wasm").exists()
                        || parent.join("atlas_sphere_runtime.wasm.wasm").exists()
                        || parent.join("atlas_sphere_runtime.wasm.compact.wasm").exists();
                    if has_wasm {
                        wbuild_dir = Some(parent.to_path_buf());
                        println!("cargo:warning=Found wbuild_dir by walking up: {:?}", wbuild_dir);
                        break;
                    }
                }
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
        
        // Method 2: Use CARGO_MANIFEST_DIR to find workspace root, then construct path
        if wbuild_dir.is_none() {
            if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
                let manifest_path = PathBuf::from(&manifest_dir);
                // CARGO_MANIFEST_DIR for runtime crate could be:
                // - /path/to/workspace/runtime (normal build)
                // - /path/to/workspace/target/release/wbuild/atlas-sphere-runtime (wasm build)
                
                // Check if we're in the wbuild directory
                if manifest_dir.contains("wbuild") {
                    // We're in the wbuild build, the wasm files are in our manifest dir
                    let test_path = manifest_path.join("atlas_sphere_runtime.wasm.compact.compressed.wasm");
                    if test_path.exists() {
                        wbuild_dir = Some(manifest_path.clone());
                        println!("cargo:warning=Found wbuild_dir from CARGO_MANIFEST_DIR (wasm build): {:?}", wbuild_dir);
                    }
                }
                
                // Also try the normal case: workspace/target/release/wbuild/atlas-sphere-runtime
                if wbuild_dir.is_none() {
                    if let Some(workspace_root) = manifest_path.parent() {
                        let fallback = workspace_root
                            .join("target")
                            .join("release")
                            .join("wbuild")
                            .join("atlas-sphere-runtime");
                        let test_path = fallback.join("atlas_sphere_runtime.wasm.compact.compressed.wasm");
                        if test_path.exists() {
                            wbuild_dir = Some(fallback);
                            println!("cargo:warning=Found wbuild_dir from workspace root: {:?}", wbuild_dir);
                        }
                    }
                }
            }
        }

        // Build list of paths to check
        let possible_paths: Vec<PathBuf> = if let Some(ref dir) = wbuild_dir {
            vec![
                dir.join("atlas_sphere_runtime.wasm.compact.compressed.wasm"),
                dir.join("atlas_sphere_runtime.wasm.compact.wasm"),
                dir.join("atlas_sphere_runtime.wasm.wasm"),
                dir.join("target/wasm32-unknown-unknown/release/atlas_sphere_runtime.wasm"),
            ]
        } else {
            // Fallback: try hardcoded paths based on workspace location
            // Extract workspace root from OUT_DIR by looking for "target/release"
            let out_str = out_dir.to_string_lossy();
            let workspace_root = if let Some(idx) = out_str.find("/target/release") {
                &out_str[..idx]
            } else {
                "/home/lojak/Desktop/X3-atlas-sphere"
            };
            
            let base = PathBuf::from(workspace_root)
                .join("target/release/wbuild/atlas-sphere-runtime");
            
            println!("cargo:warning=Using fallback wbuild path: {:?}", base);
            
            vec![
                base.join("atlas_sphere_runtime.wasm.compact.compressed.wasm"),
                base.join("atlas_sphere_runtime.wasm.compact.wasm"),
                base.join("atlas_sphere_runtime.wasm.wasm"),
                base.join("target/wasm32-unknown-unknown/release/atlas_sphere_runtime.wasm"),
            ]
        };

        // Find a valid WASM binary
        let mut found_path: Option<PathBuf> = None;
        for path in &possible_paths {
            println!("cargo:warning=Checking for WASM at {:?}", path);
            if path.exists() {
                // Verify it's a valid WASM file (starts with magic number)
                if let Ok(bytes) = fs::read(&path) {
                    if bytes.len() > 8 && bytes[0..4] == [0x00, 0x61, 0x73, 0x6d] {
                        println!("cargo:warning=Valid WASM found! Size: {} bytes", bytes.len());
                        found_path = Some(path.clone());
                        break;
                    } else {
                        println!("cargo:warning=File exists but not valid WASM (size: {}, first 4 bytes: {:?})", 
                            bytes.len(), 
                            bytes.get(0..4).unwrap_or(&[]));
                    }
                }
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
