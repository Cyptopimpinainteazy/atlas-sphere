import React, { useEffect, useState } from 'react';

export function CiStatusTile({ rpcUrl = 'http://localhost:9944', branch = 'feature/swarm-dashboard-e2e', pr = 3, pollInterval = 30000 }) {
    const [status, setStatus] = useState('unknown');
    const [lastChecked, setLastChecked] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function fetchStatus() {
            try {
                const res = await fetch(`${rpcUrl}/rpc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'ci_status', params: [], id: 1 })
                });
                const json = await res.json();
                if (!mounted) return;
                if (json.result) {
                    setStatus(json.result.status || 'unknown');
                    setLastChecked(json.result.last_checked || new Date().toISOString());
                }
            } catch (err) {
                if (!mounted) return;
                setStatus('error');
            }
        }

        fetchStatus();
        const t = setInterval(fetchStatus, pollInterval);
        return () => { mounted = false; clearInterval(t); };
    }, [rpcUrl, pollInterval]);

    return (
        <div className="ci-tile">
            <h4>CI Status</h4>
            <div className={`ci-status ${status}`}>{status.toUpperCase()}</div>
            <div className="ci-meta">Branch: {branch} • PR: {pr}</div>

            <style jsx>{`
        .ci-tile {
          background: rgba(255,255,255,0.02);
          border: 1px solid #333;
          padding: 12px;
          border-radius: 8px;
        }
        .ci-status { font-weight: 700; color: #ffd700; }
        .ci-status.success { color: #4caf50; }
        .ci-status.failed { color: #ff6b6b; }
        .ci-meta { font-size: 12px; color: #888; margin-top: 8px; }
      `}</style>
        </div>
    );
}
