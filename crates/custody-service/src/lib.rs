/// Custody Service: Enterprise-grade vault operations with HSM, audit trail, and service boundaries
///
/// The custody service is a dedicated, isolated microservice responsible for:
/// - Managing vault operations (fund, sweep, reserve, release, transfer)
/// - Key lifecycle and HSM integration
/// - Operation tracking and audit trails
/// - Authorization and policy enforcement
/// - Cryptographic proofs for settlement

pub mod types;
pub mod service;
pub mod hsm;
pub mod audit;
pub mod error;
pub mod client;

pub use service::{CustodyService, CustodyServiceImpl};
pub use types::*;
pub use client::CustodyServiceClient;
pub use error::{CustodyError, Result};
