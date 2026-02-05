Signature and public key formats used by `dispatch_tx` extrinsic

- signer_pub: SEC1-compressed secp256k1 public key (33 bytes, compressed SEC1 encoding).
  - Example: produced by `k256::SigningKey::verifying_key().to_encoded_point(true).as_bytes()`
- signature: compact ECDSA signature (r||s) as bytes (64 bytes). Tests use `k256::SigningKey.sign(payload)` and then `sig.as_ref().to_vec()`.
- Payload: raw message bytes. In tests we sign the raw payload bytes directly (no hashing or prefixing) using `k256::SigningKey.sign(payload)`.

Example (Rust):

use k256::ecdsa::{SigningKey, signature::Signer};
use k256::elliptic_curve::sec1::ToEncodedPoint;

let sk = SigningKey::from_bytes(&[11u8;32]).unwrap();
let pk = sk.verifying_key();
let pubkey = pk.to_encoded_point(true).as_bytes().to_vec();
let sig = sk.sign(&payload);
let sig_bytes = sig.as_ref().to_vec();

Notes:
- The pallet verifies the signature bytes using the provided `signer_pub` and expects the pubkey to be registered to an Account via `PubkeyToAccount` before dispatch proceeds.
- Ensure client-side signing uses the same encoding and signature format.
