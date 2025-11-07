/// Atlas Sphere node service module
/// 
/// This module provides the node service implementation for Atlas Sphere.
/// Service implementation is currently under development for full Substrate v1.0.0 compatibility.

use atlas_sphere_runtime::{opaque::Block, RuntimeApi};
use sc_executor::NativeElseWasmExecutor;
use sc_service::{Configuration, Error as ServiceError, TaskManager};
use std::sync::Arc;

/// Atlas Sphere native executor implementation
pub struct AtlasSphereExecutorDispatch;

impl sc_executor::NativeExecutionDispatch for AtlasSphereExecutorDispatch {
	type ExtendHostFunctions = sp_io::SubstrateHostFunctions;

	fn dispatch(method: &str, data: &[u8]) -> Option<Vec<u8>> {
		atlas_sphere_runtime::api::dispatch(method, data)
	}

	fn native_version() -> sc_executor::NativeVersion {
		atlas_sphere_runtime::native_version()
	}
}

/// Full node service type
pub type FullNodeService = TaskManager;

/// Executor for Atlas Sphere
pub type Executor = NativeElseWasmExecutor<AtlasSphereExecutorDispatch>;

/// Start a new Atlas Sphere node
pub fn new_full(_config: Configuration) -> Result<TaskManager, ServiceError> {
	// Full node service implementation is under development
	// for complete Substrate v1.0.0 compatibility and Frontier EVM integration.
	// For now, return a placeholder error.
	Err(ServiceError::Other(
		"Full node service implementation is in progress. \
		 Please check back soon for complete v1.0.0 Substrate + Frontier EVM support."
			.to_string(),
	))
}
