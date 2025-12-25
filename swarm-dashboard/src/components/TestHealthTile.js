import React, { useEffect, useState } from 'react';

export function TestHealthTile({ rpcUrl = 'http://localhost:9944', pollInterval = 30000 }) {
    const [health, setHealth] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function fetchHealth() {
            try {
                const res = await fetch(`${rpcUrl}/rpc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'test_health', params: [], id: 1 })
                });
                const json = await res.json();
                if (!mounted) return;
                setHealth(json.result);
            } catch (err) {
                if (!mounted) return;
                setHealth({ error: true });
            }
        }

        fetchHealth();
        const t = setInterval(fetchHealth, pollInterval);
        return () => { mounted = false; clearInterval(t); };
    }, [rpcUrl, pollInterval]);

    if (!health) return (
        <div className="test-health">Loading...</div>
    );

    const project = health['atlas-evm-integration'];

    return (
        <div className="test-health">
            <h4>Test Health</h4>
            <div className="counts">
                <div>Unit: {project.unit.passed}/{project.unit.total}</div>
                <div>Integration: {project.integration.passed}/{project.integration.total}</div>
            </div>

            <style jsx>{`
        .test-health { background: rgba(255,255,255,0.02); border: 1px solid #333; padding: 12px; border-radius: 8px; }
        .counts { font-size: 13px; color: #ddd; margin-top: 8px; display:flex; gap:12px; }
      `}</style>
        </div>
    );
}
