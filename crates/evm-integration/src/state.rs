/// EVM State Integration for Atlas Sphere
///
/// Manages Ethereum Virtual Machine state, account storage, and gas metering.

use sp_runtime::traits::{AccountIdConversion, Zero};
use sp_std::{collections::btree_map::BTreeMap, vec::Vec};

/// EVM account state
#[derive(Clone, Debug)]
pub struct EvmAccount {
	/// Account nonce
	pub nonce: u64,
	/// Account balance
	pub balance: u128,
	/// Account code hash
	pub code_hash: [u8; 32],
	/// Storage root
	pub storage_root: [u8; 32],
}

impl EvmAccount {
	/// Create new EVM account
	pub fn new() -> Self {
		Self {
			nonce: 0,
			balance: 0,
			code_hash: [0u8; 32],
			storage_root: [0u8; 32],
		}
	}

	/// Set account balance
	pub fn set_balance(&mut self, balance: u128) {
		self.balance = balance;
	}

	/// Increment nonce
	pub fn increment_nonce(&mut self) {
		self.nonce = self.nonce.saturating_add(1);
	}

	/// Check if account is empty
	pub fn is_empty(&self) -> bool {
		self.balance.is_zero() && self.nonce == 0 && self.code_hash == [0u8; 32]
	}
}

/// EVM contract code
#[derive(Clone, Debug)]
pub struct EvmCode {
	/// Contract bytecode
	pub bytecode: Vec<u8>,
	/// Code hash
	pub code_hash: [u8; 32],
}

impl EvmCode {
	/// Create new EVM code
	pub fn new(bytecode: Vec<u8>) -> Self {
		use sp_core::hashing::keccak_256;
		let code_hash = keccak_256(&bytecode);
		Self {
			bytecode,
			code_hash,
		}
	}

	/// Get code size
	pub fn len(&self) -> usize {
		self.bytecode.len()
	}

	/// Check if code is empty
	pub fn is_empty(&self) -> bool {
		self.bytecode.is_empty()
	}
}

/// EVM storage entry
pub type StorageValue = [u8; 32];

/// EVM state database
pub struct EvmStateDb {
	accounts: BTreeMap<[u8; 20], EvmAccount>,
	code: BTreeMap<[u8; 32], EvmCode>,
	storage: BTreeMap<([u8; 20], [u8; 32]), StorageValue>,
}

impl EvmStateDb {
	/// Create new EVM state database
	pub fn new() -> Self {
		Self {
			accounts: BTreeMap::new(),
			code: BTreeMap::new(),
			storage: BTreeMap::new(),
		}
	}

	/// Get account by address
	pub fn account(&self, address: &[u8; 20]) -> Option<&EvmAccount> {
		self.accounts.get(address)
	}

	/// Get mutable account reference
	pub fn account_mut(&mut self, address: &[u8; 20]) -> &mut EvmAccount {
		self.accounts.entry(*address).or_insert_with(EvmAccount::new)
	}

	/// Get account nonce
	pub fn nonce(&self, address: &[u8; 20]) -> u64 {
		self.account(address).map(|a| a.nonce).unwrap_or(0)
	}

	/// Get account balance
	pub fn balance(&self, address: &[u8; 20]) -> u128 {
		self.account(address).map(|a| a.balance).unwrap_or(0)
	}

	/// Set account balance
	pub fn set_balance(&mut self, address: &[u8; 20], balance: u128) {
		self.account_mut(address).set_balance(balance);
	}

	/// Transfer between accounts with overflow/underflow protection
	pub fn transfer(&mut self, from: &[u8; 20], to: &[u8; 20], value: u128) -> Result<(), &'static str> {
		let from_balance = self.balance(from);
		from_balance.checked_sub(value)
			.ok_or("Insufficient balance")?;

		self.account_mut(from).balance = from_balance - value;
		let to_balance = self.balance(to);
		self.account_mut(to).balance = to_balance.checked_add(value)
			.ok_or("Balance overflow")?;

		Ok(())
	}

	/// Get code by hash
	pub fn code(&self, code_hash: &[u8; 32]) -> Option<&EvmCode> {
		self.code.get(code_hash)
	}

	/// Set code at address
	pub fn set_code(&mut self, address: &[u8; 20], code: EvmCode) {
		let code_hash = code.code_hash;
		self.code.insert(code_hash, code);
		self.account_mut(address).code_hash = code_hash;
	}

	/// Get storage value
	pub fn storage(&self, address: &[u8; 20], key: &[u8; 32]) -> StorageValue {
		self.storage.get(&(*address, *key)).copied().unwrap_or([0u8; 32])
	}

	/// Set storage value
	pub fn set_storage(&mut self, address: &[u8; 20], key: [u8; 32], value: StorageValue) {
		self.storage.insert((*address, key), value);
	}

	/// Get account count
	pub fn account_count(&self) -> usize {
		self.accounts.len()
	}

	/// Get all accounts
	pub fn accounts(&self) -> impl Iterator<Item = (&[u8; 20], &EvmAccount)> {
		self.accounts.iter()
	}
}

/// EVM execution context
#[derive(Clone, Debug)]
pub struct EvmContext {
	/// Current block number
	pub block_number: u32,
	/// Current block timestamp
	pub block_timestamp: u64,
	/// Gas price
	pub gas_price: u128,
	/// Call origin
	pub origin: [u8; 20],
	/// Caller address
	pub caller: [u8; 20],
	/// Call value
	pub call_value: u128,
	/// Gas limit
	pub gas_limit: u64,
}

impl EvmContext {
	/// Create new EVM context
	pub fn new(origin: [u8; 20]) -> Self {
		Self {
			block_number: 0,
			block_timestamp: 0,
			gas_price: 1,
			origin,
			caller: origin,
			call_value: 0,
			gas_limit: 1_000_000,
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn test_evm_account() {
		let mut account = EvmAccount::new();
		assert!(account.is_empty());

		account.set_balance(1000);
		assert!(!account.is_empty());
		assert_eq!(account.balance, 1000);

		account.increment_nonce();
		assert_eq!(account.nonce, 1);
	}

	#[test]
	fn test_evm_state_db_transfer() {
		let mut db = EvmStateDb::new();
		let addr1 = [1u8; 20];
		let addr2 = [2u8; 20];

		db.set_balance(&addr1, 1000);
		assert!(db.transfer(&addr1, &addr2, 500).is_ok());
		assert_eq!(db.balance(&addr1), 500);
		assert_eq!(db.balance(&addr2), 500);
	}

	#[test]
	fn test_evm_state_db_insufficient_balance() {
		let mut db = EvmStateDb::new();
		let addr1 = [1u8; 20];
		let addr2 = [2u8; 20];

		db.set_balance(&addr1, 100);
		assert!(db.transfer(&addr1, &addr2, 200).is_err());
	}

	#[test]
	fn test_evm_code() {
		let bytecode = vec![0x60, 0x01, 0x61]; // PUSH1 01 PUSH2
		let code = EvmCode::new(bytecode.clone());
		assert_eq!(code.len(), 3);
		assert!(!code.is_empty());
	}
}
