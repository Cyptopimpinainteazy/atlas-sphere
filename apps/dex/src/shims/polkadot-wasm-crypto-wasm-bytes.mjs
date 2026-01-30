
// ESM shim to avoid Next.js dev Fast Refresh injecting `import.meta.webpackHot.accept()`
// into Polkadot's CommonJS bytes module, which can fail parsing.
//
// These constants are copied from @polkadot/wasm-crypto-wasm/cjs/bytes.js.

export const lenIn = 168782;
export const lenOut = 335277;

export default { lenIn, lenOut };
