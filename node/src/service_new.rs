/// Atlas Sphere node service module
///
/// Minimal implementation for Substrate v1.0.0 compatibility

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
pub fn new_full(config: Configuration) -> Result<TaskManager, ServiceError> {
	// Create executor with v1.0.0 API
	let executor = Executor::new(
		config.wasm_method,
		None,
		8,
		64,
	);

	// Initialize full parts (client, backend, keystore, task manager)
	let (_client, _backend, _keystore_container, task_manager) =
		sc_service::new_full_parts::<Block, RuntimeApi, _>(
			&config,
			None,
			executor,
		)?;

	// Minimal implementation: return task manager
	// Full consensus/networking implementation would go here
	Ok(task_manager)
}
