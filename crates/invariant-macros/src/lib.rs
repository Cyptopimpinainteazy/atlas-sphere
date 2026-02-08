use proc_macro::TokenStream;
use quote::quote;
use regex::Regex;
use syn::{parse_macro_input, LitStr};

/// Attribute macro to mark tests with an invariant ID.
///
/// Usage:
/// #[invariant("LANG-COMPILE-001")]
/// fn test_...() { ... }
#[proc_macro_attribute]
pub fn invariant(attr: TokenStream, item: TokenStream) -> TokenStream {
    // Parse attribute as literal string
    let lit = parse_macro_input!(attr as LitStr);
    let raw = lit.value();

    // Support optional inline flags separated by '|', e.g. "ID|STRICT"
    let mut parts = raw.split('|');
    let id = parts.next().unwrap().trim().to_string();
    let mut strict_flag = false;
    if let Some(flag_part) = parts.next() {
        if flag_part.trim().eq_ignore_ascii_case("STRICT") {
            strict_flag = true;
        }
    }

    // Validate with regex: LAYER-COMPONENT-NNN
    let re = Regex::new(r"^[A-Z]+-[A-Z]+-[0-9]{3}$").unwrap();
    if !re.is_match(&id) {
        return syn::Error::new(lit.span(), "Invalid invariant ID format, expected e.g. CHAIN-CONSENSUS-001").to_compile_error().into();
    }

    // Parse the item into a syn::Item so we can include it in quoted output
    let item_ast = parse_macro_input!(item as syn::Item);

    // Attach as doc comment and leave the item unchanged
    // Also add a const that registers the invariant for optional runtime checks
    let ident = syn::Ident::new(&format!("_INVARIANT_{}", id.replace('-', "_")), proc_macro2::Span::call_site());
    let lit_out = LitStr::new(&id, proc_macro2::Span::call_site());

    // Optional registry check: if INVARIANT_REGISTRY_PATH is set, verify the id exists there
    if let Ok(reg_path) = std::env::var("INVARIANT_REGISTRY_PATH") {
        // Decide strict mode if either inline flag or env var is set
        let strict_mode = strict_flag || std::env::var("INVARIANT_REGISTRY_STRICT").unwrap_or_default() == "1";
        match std::fs::read_to_string(&reg_path) {
            Ok(contents) => {
                match contents.parse::<toml::Value>() {
                    Ok(toml_val) => {
                        let found = toml_val
                            .get("invariant")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().any(|it| it.get("id").and_then(|s| s.as_str()) == Some(&id)))
                            .unwrap_or(false);
                        if !found {
                            // Only error strictly if strict mode is enabled
                            if strict_mode {
                                return syn::Error::new(lit.span(), format!("Invariant ID '{}' not found in registry: {}", id, reg_path)).to_compile_error().into();
                            }
                        }
                    }
                    Err(_) => {
                        if strict_mode {
                            return syn::Error::new(lit.span(), format!("Failed to parse INVARIANT_REGISTRY_PATH at {}", reg_path)).to_compile_error().into();
                        }
                    }
                }
            }
            Err(_) => {
                if strict_mode {
                    return syn::Error::new(lit.span(), format!("Failed to read INVARIANT_REGISTRY_PATH at {}", reg_path)).to_compile_error().into();
                }
            }
        }
    }

    let out = quote! {
        #[doc = concat!("Invariant: ", #lit_out)]
        #item_ast
        #[allow(non_upper_case_globals)]
        const #ident: &str = #lit_out;
    };

    out.into()
}
