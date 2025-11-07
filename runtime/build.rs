// WASM build disabled for this development phase
// The runtime is compiled as rlib only
fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/lib.rs");
    println!("cargo:warning=WASM runtime compilation disabled - using rlib only");
}