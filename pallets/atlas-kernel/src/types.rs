#![cfg_attr(not(feature = "std"), no_std)]

use core::{convert::TryFrom, fmt};
use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::{hashing::keccak_256, H160, H256};
use sp_io::hashing::sha2_256;
use sp_runtime::RuntimeDebug;
use sp_std::{fmt::Write, string::String, vec::Vec};

#[cfg(feature = "std")]
use serde::{de::Error as SerdeDeError, Deserialize, Deserializer, Serialize, Serializer};

const DERIVATION_DOMAIN_TAG: u8 = 0x01;
const CBOR_BYTE_STRING_PREFIX: u8 = 0x58;
const CBOR_ATLAS_ID_LENGTH: u8 = 32;
const SVM_ADDRESS_PREFIX: u8 = 0x3A;
const BASE58_ALPHABET: &[u8; 58] =
	b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/// Canonical 32-byte identifier used to link Substrate accounts with Atlas identities.
/// Provides derivation, serialization, and address conversion helpers.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo, Default)]
pub struct AtlasId([u8; 32]);

impl AtlasId {
	/// Fixed length (32 bytes) for Atlas identifiers.
	pub const LENGTH: usize = 32;

	/// Create a new AtlasId from a fixed-size byte array.
	pub const fn new(bytes: [u8; 32]) => Self {
		Self(bytes)
	}

	/// Borrow the underlying 32-byte CANID representation.
	pub const fn as_bytes(&self) -> &[u8; 32] {
		&self.0
	}

	/// Consume the AtlasId, yielding the underlying 32-byte array.
	pub const fn into_bytes(self) -> [u8; 32] {
		self.0
	}

	/// Construct an AtlasId from a slice, ensuring it is exactly 32 bytes.
	pub fn from_slice(bytes: &[u8]) -> Result<Self, AtlasIdError> {
		if bytes.len() != Self::LENGTH {
			return Err(AtlasIdError::IncorrectLength);
		}
		let mut inner = [0u8; 32];
		inner.copy_from_slice(bytes);
		Ok(Self(inner))
	}

	/// Parse a hex string (optionally `0x`-prefixed) into an AtlasId.
	pub fn from_hex_str(input: &str) -> Result<Self, AtlasIdError> {
		let trimmed = if let Some(rest) = input.strip_prefix("0x").or_else(|| input.strip_prefix("0X")) {
			rest
		} else {
			input
		};

		if trimmed.len() != Self::LENGTH * 2 {
			return Err(AtlasIdError::InvalidHexLength);
		}

		let mut bytes = [0u8; 32];
		let chars = trimmed.as_bytes();
		for i in 0..Self::LENGTH {
			let high = hex_nibble(chars[2 * i]).ok_or(AtlasIdError::InvalidHexCharacter)?;
			let low = hex_nibble(chars[2 * i + 1]).ok_or(AtlasIdError::InvalidHexCharacter)?;
			bytes[i] = (high << 4) | low;
		}

		Ok(Self(bytes))
	}

	/// Encode the AtlasId as a lowercase hex string (without `0x` prefix).
	pub fn to_hex_string(&self) -> String {
		let mut out = String::with_capacity(Self::LENGTH * 2);
		for byte in &self.0 {
			let _ = write!(out, "{:02x}", byte);
		}
		out
	}

	/// Serialize the AtlasId to a canonical CBOR byte-string (major type 2).
	pub fn to_cbor_bytes(&self) -> Vec<u8> {
		let mut out = Vec::with_capacity(2 + Self::LENGTH);
		out.push(CBOR_BYTE_STRING_PREFIX);
		out.push(CBOR_ATLAS_ID_LENGTH);
		out.extend_from_slice(&self.0);
		out
	}

	/// Parse an AtlasId from a canonical CBOR byte-string (major type 2, len=32).
	pub fn from_cbor_bytes(bytes: &[u8]) -> Result<Self, CborError> {
		if bytes.len() != 2 + Self::LENGTH {
			return Err(CborError::InvalidLength);
		}
		if bytes[0] != CBOR_BYTE_STRING_PREFIX {
			return Err(CborError::InvalidPrefix);
		}
		if bytes[1] != CBOR_ATLAS_ID_LENGTH {
			return Err(CborError::UnexpectedLength(bytes[1]));
		}

		let mut inner = [0u8; 32];
		inner.copy_from_slice(&bytes[2..]);
		Ok(Self(inner))
	}

	/// Convert the AtlasId into an EVM-compatible address (last 20 bytes).
	pub fn to_evm_address(&self) -> H160 {
		H160::from_slice(&self.0[Self::LENGTH - 20..Self::LENGTH])
	}

	/// Convert the AtlasId into an SVM Base58Check-encoded address.
	pub fn to_svm_address(&self) -> String {
		let mut payload = Vec::with_capacity(1 + Self::LENGTH);
		payload.push(SVM_ADDRESS_PREFIX);
		payload.extend_from_slice(&self.0);
		base58check_encode(&payload)
	}
}

impl From<[u8; 32]> for AtlasId {
	fn from(value: [u8; 32]) -> Self {
		Self(value)
	}
}

impl From<AtlasId> for [u8; 32] {
	fn from(value: AtlasId) -> Self {
		value.0
	}
}

impl AsRef<[u8; 32]> for AtlasId {
	fn as_ref(&self) -> &[u8; 32] {
		self.as_bytes()
	}
}

impl fmt::Display for AtlasId {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.to_hex_string())
	}
}

#[cfg(feature = "std")]
impl Serialize for AtlasId {
	fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
	where
		S: Serializer,
	{
		serializer.serialize_str(&self.to_hex_string())
	}
}

#[cfg(feature = "std")]
impl<'de> Deserialize<'de> for AtlasId {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		let as_str = String::deserialize(deserializer)?;
		AtlasId::from_hex_str(&as_str).map_err(SerdeDeError::custom)
	}
}

/// Errors that can emerge while manipulating Atlas identifiers.
#[derive(Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum AtlasIdError {
	IncorrectLength,
	InvalidHexLength,
	InvalidHexCharacter,
	Cbor(CborError),
}

impl From<CborError> for AtlasIdError {
	fn from(value: CborError) -> Self {
		Self::Cbor(value)
	}
}

/// Errors that can occur when parsing canonical CBOR representations.
#[derive(Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum CborError {
	InvalidPrefix,
	InvalidLength,
	UnexpectedLength(u8),
}

/// Supported public key types for AtlasId derivation.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
#[repr(u8)]
pub enum PubkeyType {
	Secp256k1 = 0x01,
	Ed25519 = 0x02,
	Multisig = 0x03,
	ContractAccount = 0x04,
}

impl PubkeyType {
	/// Retrieve the canonical tag associated with this key type.
	pub const fn tag(self) -> u8 {
		self as u8
	}
}

impl TryFrom<u8> for PubkeyType {
	type Error = DerivationError;

	fn try_from(value: u8) -> Result<Self, Self::Error> {
		match value {
			0x01 => Ok(PubkeyType::Secp256k1),
			0x02 => Ok(PubkeyType::Ed25519),
			0x03 => Ok(PubkeyType::Multisig),
			0x04 => Ok(PubkeyType::ContractAccount),
			_ => Err(DerivationError::UnsupportedKeyType),
		}
	}
}

impl From<PubkeyType> for u8 {
	fn from(value: PubkeyType) -> Self {
		value.tag()
	}
}

/// Chain preference hint encoded alongside Atlas identifiers.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
#[repr(u8)]
pub enum ChainHint {
	Neutral = 0x00,
	EvmPreferred = 0x01,
	SvmPreferred = 0x02,
}

impl ChainHint {
	/// Retrieve the canonical tag associated with this chain hint.
	pub const fn tag(self) -> u8 {
		self as u8
	}
}

impl TryFrom<u8> for ChainHint {
	type Error = DerivationError;

	fn try_from(value: u8) -> Result<Self, Self::Error> {
		match value {
			0x00 => Ok(ChainHint::Neutral),
			0x01 => Ok(ChainHint::EvmPreferred),
			0x02 => Ok(ChainHint::SvmPreferred),
			_ => Err(DerivationError::UnsupportedKeyType),
		}
	}
}

/// Errors that can occur during AtlasId derivation.
#[derive(Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum DerivationError {
	InvalidPublicKeyLength { expected: u8, actual: u8 },
	UnsupportedKeyType,
	EmptyPublicKey,
}

/// Utility struct providing AtlasId derivation helpers.
pub struct AtlasIdDerivation;

impl AtlasIdDerivation {
	/// Derive an AtlasId (CANID) from a secp256k1 compressed public key.
	pub fn from_secp256k1(pubkey: &[u8], hint: ChainHint) -> Result<AtlasId, DerivationError> {
		if pubkey.is_empty() {
			return Err(DerivationError::EmptyPublicKey);
		}
		if pubkey.len() != 33 {
			return Err(DerivationError::InvalidPublicKeyLength {
				expected: 33,
				actual: u8::try_from(pubkey.len()).unwrap_or(u8::MAX),
			});
		}
		Self::derive_from_parts(PubkeyType::Secp256k1, pubkey, hint)
	}

	/// Derive an AtlasId (CANID) from an ed25519 public key.
	pub fn from_ed25519(pubkey: &[u8], hint: ChainHint) -> Result<AtlasId, DerivationError> {
		if pubkey.is_empty() {
			return Err(DerivationError::EmptyPublicKey);
		}
		if pubkey.len() != 32 {
			return Err(DerivationError::InvalidPublicKeyLength {
				expected: 32,
				actual: u8::try_from(pubkey.len()).unwrap_or(u8::MAX),
			});
		}
		Self::derive_from_parts(PubkeyType::Ed25519, pubkey, hint)
	}

	/// Derive an AtlasId from arbitrary key types by providing the raw parts.
	pub fn derive_from_parts(
		pubkey_type: PubkeyType,
		pubkey: &[u8],
		hint: ChainHint,
	) -> Result<AtlasId, DerivationError> {
		if pubkey.is_empty() {
			return Err(DerivationError::EmptyPublicKey);
		}

		let mut preimage = Vec::with_capacity(2 + pubkey.len());
		preimage.push(DERIVATION_DOMAIN_TAG);
		preimage.push(pubkey_type.tag());
		preimage.extend_from_slice(pubkey);
		preimage.push(hint.tag());

		let derived = keccak_256(&preimage);
		Ok(AtlasId::from(derived))
	}
}

/// Unique identifier for assets tracked by the Atlas Kernel.
pub type AssetId = H256;

/// Describes metadata associated with a registered asset.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct AssetMetadata {
	/// Human-readable asset symbol represented as UTF-8 bytes.
	pub symbol: Vec<u8>,
	/// Number of decimal places used when displaying the asset.
	pub decimals: u8,
}

/// Represents the lifecycle status of a Comit transaction.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum ComitStatus {
	/// Comit has been accepted but not yet finalized.
	Pending,
	/// Comit has been successfully executed and finalized.
	Finalized,
	/// Comit execution failed and was aborted.
	Failed,
}

/// Execution intent destined for the EVM environment.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct EvmPayload {
	/// Target contract or account in the EVM represented by an H160 address.
	pub target: H160,
	/// ABI-encoded call data supplied to the target.
	pub input: Vec<u8>,
	/// Amount of native value (denominated in the canonical ledger) to transfer.
	pub value: u128,
}

/// Execution intent destined for the SVM environment.
#[derive(Clone, PartialEq, Eq, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct SvmPayload {
	/// Identifier of the Solana program to invoke.
	pub program_id: [u8; 32],
	/// Account keys required for the program invocation.
	pub accounts: Vec<[u8; 32]>,
	/// Instruction data passed to the program.
	pub data: Vec<u8>,
}

/// Convert a hex nibble character into its value.
fn hex_nibble(chr: u8) -> Option<u8> {
	match chr {
		b'0'..=b'9' => Some(chr - b'0'),
		b'a'..=b'f' => Some(10 + chr - b'a'),
		b'A'..=b'F' => Some(10 + chr - b'A'),
		_ => None,
	}
}

/// Produce a Base58Check string using Bitcoin alphabet.
fn base58check_encode(payload: &[u8]) -> String {
	let mut extended = Vec::with_capacity(payload.len() + 4);
	extended.extend_from_slice(payload);

	let checksum = checksum4(payload);
	extended.extend_from_slice(&checksum);

	base58_encode(&extended)
}

/// Compute the first four bytes of the double SHA2-256 checksum.
fn checksum4(data: &[u8]) -> [u8; 4] {
	let first = sha2_256(data);
	let second = sha2_256(&first);
	let mut out = [0u8; 4];
	out.copy_from_slice(&second[..4]);
	out
}

/// Encode arbitrary bytes using the Bitcoin Base58 alphabet.
fn base58_encode(data: &[u8]) -> String {
	if data.is_empty() {
		return String::new();
	}

	let zeros = data.iter().take_while(|&&byte| byte == 0).count();
	let mut digits = vec![0u8; data.len() * 138 / 100 + 1];
	let mut length = 1usize;

	for &byte in data {
		let mut carry = byte as u32;
		let mut i = 0usize;
		while i < length {
			let val = (digits[i] as u32) * 256 + carry;
			digits[i] = (val % 58) as u8;
			carry = val / 58;
			i += 1;
		}
		while carry > 0 {
			digits[length] = (carry % 58) as u8;
			length += 1;
			carry /= 58;
		}
	}

	let mut result = String::with_capacity(zeros + length);
	for _ in 0..zeros {
		result.push('1');
	}

	let mut i = length;
	while i > 1 && digits[i - 1] == 0 {
		i -= 1;
	}

	for digit in digits[..i].iter().rev() {
		result.push(BASE58_ALPHABET[*digit as usize] as char);
	}

	if result.is_empty() {
		result.push('1');
	}

	result
}
