import { useState, useEffect } from 'react';
import { useIDEStore } from '../../store/ideStore';
import { compileSolidity, deploySolidity } from '../../lib/api';

const COMPILER_VERSIONS = ['0.8.24', '0.8.23', '0.8.22', '0.8.21', '0.8.20', '0.8.19'];
const ENVIRONMENTS = ['JavaScript VM', 'Injected Web3', 'Atlas Testnet', 'Custom RPC'];

export function RemixPanel() {
  const {
    solidityCompilerVersion,
    setSolidityCompiler,
    compilationOutput,
    setCompilationOutput,
    openTabs,
    activeTabId,
  } = useIDEStore();
  const [environment, setEnvironment] = useState('JavaScript VM');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeSection, setActiveSection] = useState<'compile' | 'deploy' | 'debug'>('compile');
  const [source, setSource] = useState<string>('');
  const [deployedContracts, setDeployedContracts] = useState<any[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  // load active solidity tab
  useEffect(() => {
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (tab && tab.language === 'sol') {
      setSource(tab.content);
    }
  }, [openTabs, activeTabId]);

  const handleCompile = async () => {
    if (!source.trim()) return;
    setIsCompiling(true);
    setCompilationOutput(`Compiling with solc v${solidityCompilerVersion}...\n`);
    try {
      const result = await compileSolidity(source, solidityCompilerVersion);
      if (result.errors && result.errors.length > 0) {
        const formatted = result.errors
          .map((e: any) => `❌ ${e.severity.toUpperCase()}: ${e.message}`)
          .join('\n');
        setCompilationOutput(formatted);
      } else {
        const contractName = result.contracts ? Object.keys(result.contracts)[0] : 'Unknown';
        setCompilationOutput(`✅ Compilation successful!\nContract: ${contractName}\n\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (err: any) {
      setCompilationOutput('❌ Compilation failed: ' + (err.message || String(err)));
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async () => {
    if (!source.trim()) {
      setCompilationOutput('❌ No contract selected. Compile first.');
      return;
    }
    setIsDeploying(true);
    try {
      // First compile to get ABI and bytecode
      const compiled = await compileSolidity(source, solidityCompilerVersion);
      if (compiled.errors?.length > 0) {
        setCompilationOutput('❌ Compilation failed before deploy.');
        return;
      }
      const contractName = Object.keys(compiled.contracts)[0];
      const contract = compiled.contracts[contractName];
      const abi = contract.abi || [];
      const bytecode = contract.evm?.bytecode?.object || '';
      
      const deployment = await deploySolidity(abi, bytecode, []);
      const newContract = {
        name: contractName,
        address: deployment.address || `0x${Math.random().toString(16).slice(2, 42)}`,
        environment,
        timestamp: new Date().toLocaleTimeString(),
      };
      setDeployedContracts([...deployedContracts, newContract]);
      setCompilationOutput(`✅ Deployed ${contractName} to ${environment}\nAddress: ${newContract.address}`);
    } catch (err: any) {
      setCompilationOutput('❌ Deployment failed: ' + (err.message || String(err)));
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>⟠ Remix IDE</span>
        <span className="badge badge-success">Solidity</span>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-ide-border">
        {(['compile', 'deploy', 'debug'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`tab-btn flex-1 ${activeSection === s ? 'active' : ''}`}
          >
            {s === 'compile' ? '🔨 Compile' : s === 'deploy' ? '🚀 Deploy' : '🐛 Debug'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeSection === 'compile' && (
          <>
            <div>
              <label className="text-xs text-ide-text-dim mb-1 block">Compiler Version</label>
              <select
                value={solidityCompilerVersion}
                onChange={(e) => setSolidityCompiler(e.target.value)}
                className="input-field"
              >
                {COMPILER_VERSIONS.map((v) => (
                  <option key={v} value={v}>solc v{v}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-xs text-ide-text-dim">
                <input type="checkbox" className="rounded" defaultChecked />
                Auto-compile
              </label>
              <label className="flex items-center gap-2 text-xs text-ide-text-dim">
                <input type="checkbox" className="rounded" defaultChecked />
                Optimization
              </label>
            </div>

            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="action-btn w-full"
            >
              {isCompiling ? '⏳ Compiling...' : '🔨 Compile'}
            </button>

            {compilationOutput && (
              <pre className="text-xs font-mono bg-ide-bg p-2 rounded border border-ide-border whitespace-pre-wrap text-green-400">
                {compilationOutput}
              </pre>
            )}
          </>
        )}

        {activeSection === 'deploy' && (
          <>
            <div>
              <label className="text-xs text-ide-text-dim mb-1 block">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="input-field"
              >
                {ENVIRONMENTS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-ide-text-dim mb-1 block">Account</label>
              <select className="input-field">
                <option>0x5B38Da6a701c568545dCfcB03FcB875f56beddC4 (100 ETH)</option>
                <option>0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2 (100 ETH)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-ide-text-dim mb-1 block">Contract</label>
              <select className="input-field">
                <option>AtlasToken</option>
                <option>AtlasNFT</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-ide-text-dim mb-1 block">Gas Limit</label>
              <input type="text" defaultValue="3000000" className="input-field" />
            </div>

            <button 
              onClick={handleDeploy}
              disabled={isDeploying}
              className="action-btn w-full"
            >
              {isDeploying ? '⏳ Deploying...' : '🚀 Deploy'}
            </button>

            {deployedContracts.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-ide-text mb-2">Deployed Contracts:</p>
                {deployedContracts.map((c, idx) => (
                  <div key={idx} className="text-xs bg-ide-surface p-2 rounded border border-ide-border">
                    <p className="text-green-400 font-mono">{c.name}</p>
                    <p className="text-ide-text-dim truncate">{c.address}</p>
                    <p className="text-[10px] text-ide-text-dim">{c.environment} • {c.timestamp}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'debug' && (
          <div className="space-y-3">
            <p className="text-xs text-ide-text-dim text-center mt-4">🐛 Debugger</p>
            <div className="text-xs text-ide-text-dim">
              <p className="mb-2">Set breakpoints by clicking line numbers in the editor</p>
              {breakpoints.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-semibold text-ide-text">Breakpoints:</p>
                  {breakpoints.map((bp, idx) => (
                    <div key={idx} className="bg-ide-surface p-1 rounded flex justify-between">
                      <span>Line {bp}</span>
                      <button 
                        onClick={() => setBreakpoints(breakpoints.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] mt-2">No breakpoints set</p>
              )}
            </div>
            <button 
              onClick={() => setBreakpoints([...breakpoints, Math.floor(Math.random() * 50)])}
              className="action-btn w-full text-xs"
            >
              ⚡ Add Sample Breakpoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
