use std::process::Command;
use std::path::Path;

fn main() {
    // Verify sidecar binary is correctly branded before building
    verify_sidecar_branding();
    
    tauri_build::build()
}

/// Verify the myntad sidecar binary is correctly branded as Mynta, not Raven.
/// This check runs at compile time and fails the build if the bundled daemon
/// still reports "Raven" branding.
fn verify_sidecar_branding() {
    // Get the target triple
    let target = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-unknown-linux-gnu".to_string());
    
    // Path to sidecar binary
    let sidecar_path = format!("binaries/myntad-{}", target);
    let sidecar = Path::new(&sidecar_path);
    
    if !sidecar.exists() {
        println!("cargo:warning=Sidecar binary not found at {}. Build will continue but the binary must be present at runtime.", sidecar_path);
        return;
    }
    
    // Run the binary with --version and capture output
    let output = Command::new(&sidecar_path)
        .arg("--version")
        .output();
    
    match output {
        Ok(result) => {
            let version_output = String::from_utf8_lossy(&result.stdout).to_string()
                + &String::from_utf8_lossy(&result.stderr).to_string();
            
            // Check for incorrect "Raven" branding in version string
            if version_output.to_lowercase().contains("raven version") {
                panic!(
                    "\n\n\
                    ============================================================\n\
                    SIDECAR BRANDING ERROR!\n\
                    ============================================================\n\
                    The bundled myntad binary still reports 'Raven' branding.\n\n\
                    Version output:\n{}\n\n\
                    Please rebuild the core daemon with correct branding and\n\
                    copy it to: {}\n\
                    ============================================================\n",
                    version_output, sidecar_path
                );
            }
            
            // Verify it contains "Mynta"
            if !version_output.to_lowercase().contains("mynta") {
                panic!(
                    "\n\n\
                    ============================================================\n\
                    SIDECAR BRANDING ERROR!\n\
                    ============================================================\n\
                    The bundled myntad binary does not contain 'Mynta' branding.\n\n\
                    Version output:\n{}\n\n\
                    Please ensure you are using the correctly branded daemon.\n\
                    ============================================================\n",
                    version_output
                );
            }
            
            println!("cargo:warning=Sidecar branding verified: Mynta Core");
        }
        Err(e) => {
            println!("cargo:warning=Could not verify sidecar branding: {}. Ensure the binary is executable.", e);
        }
    }
    
    // Tell Cargo to rerun if the sidecar changes
    println!("cargo:rerun-if-changed={}", sidecar_path);
}
