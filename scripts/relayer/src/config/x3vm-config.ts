const x3vmConfig = {
  rpcUrl: process.env.X3VM_RPC_URL || 'http://localhost:9933',
  wsUrl: process.env.X3VM_WS_URL || 'ws://localhost:9944'
};

export default x3vmConfig;
