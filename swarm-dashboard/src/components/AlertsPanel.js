import React, { useEffect, useState } from 'react';

export function AlertsPanel({ rpcUrl = 'http://localhost:9944', max = 10 }) {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        let mounted = true;

        async function fetchAlerts() {
            try {
                const res = await fetch(`${rpcUrl}/rpc`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'alerts', params: [], id: 1 })
                });
                const json = await res.json();
                if (!mounted) return;
                setAlerts(json.result || []);
            } catch (err) {
                if (!mounted) return;
                setAlerts([]);
            }
        }

        fetchAlerts();
        const t = setInterval(fetchAlerts, 30000);
        return () => { mounted = false; clearInterval(t); };
    }, [rpcUrl]);

    return (
        <div className="alerts-panel">
            <h4>Alerts</h4>
            <ul>
                {alerts.slice(0, max).map(a => (
                    <li key={a.id} className={`alert ${a.level}`}>
                        <div className="title">{a.title}</div>
                        <div className="message">{a.message}</div>
                        {a.link && <a className="link" href={a.link} target="_blank" rel="noreferrer">Open</a>}
                    </li>
                ))}
            </ul>

            <style jsx>{`
        .alerts-panel { background: rgba(255,255,255,0.02); border: 1px solid #333; padding: 12px; border-radius: 8px; }
        ul { list-style: none; padding: 0; margin: 0; }
        .alert { padding:8px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .alert:last-child { border-bottom: none; }
        .title { font-weight: 600; color: #ffd700; }
        .message { color: #ccc; font-size: 13px; margin-top: 4px; }
        .link { display:inline-block; margin-top:6px; font-size:12px; color:#00d4ff }
      `}</style>
        </div>
    );
}
