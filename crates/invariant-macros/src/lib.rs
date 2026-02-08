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
    let id = lit.value();

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
    let out = quote! {
        #[doc = concat!("Invariant: ", #lit_out)]
        #item_ast
        #[allow(non_upper_case_globals)]
        const #ident: &str = #lit_out;
    };

    out.into()
}
