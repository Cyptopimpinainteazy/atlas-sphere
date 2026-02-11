import React, { useState } from "react";
import { runSystemCommand } from "@/services/adminService";

const SYSTEM_COMMANDS = [
  {
    label: "Run Cross-Chain GPU Validator Tests",
    command: "cd cross-chain-gpu-validator && ./scripts/run-local-tests.sh 2>&1 | head -200",
  },
  {
    label: "Show Disk Usage",
    command: "df -h | head -20",
  },
  {
    label: "Show System Logs (last 100 lines)",
    command: "sudo journalctl -n 100",
  },
  {
    label: "Show Running Processes",
    command: "ps aux | head -20",
  },
  {
    label: "Show Network Interfaces",
    command: "ip addr show | head -20",
  },
  {
    label: "Show Docker Containers",
    command: "docker ps -a | head -20",
  },
  // Add more useful commands here
];

const SystemCommandPanel: React.FC = () => {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runCommand = async (cmd: string) => {
    setLoading(true);
    setOutput("");
    try {
      const result = await runSystemCommand(cmd);
      setOutput(`$ ${cmd}\n\n${result}`);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{background:'#181818',color:'#ffd740',padding:24,borderRadius:12,maxWidth:700,margin:'32px auto'}}>
      <h2 style={{marginBottom:16}}>System Command Panel</h2>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
        {SYSTEM_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            style={{background:'#222',color:'#ffd740',padding:'8px 18px',borderRadius:6,fontWeight:'bold',border:'1px solid #ffd740'}}
            onClick={() => runCommand(cmd.command)}
            disabled={loading}
          >
            {cmd.label}
          </button>
        ))}
      </div>
      <pre style={{background:'#222',color:'#fff',padding:16,borderRadius:8,minHeight:120,marginTop:8,whiteSpace:'pre-wrap'}}>
        {loading ? 'Running...' : output}
      </pre>
    </div>
  );
};

export default SystemCommandPanel;
