import React, { useEffect, useState } from 'react';

export function AlertsPanel({ rpcUrl = 'http://localhost:9944', max = 10 }) {
    const [alerts, setAlerts] = useState([]);
    const [sigill, setSigill] = useState({ count: 0, alerts: [] });

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

        // Fetch SIGILL specific feed (REST)
        async function fetchSigill() {
            try {
                const res = await fetch(`${rpcUrl}/api/alerts/sigill`);
                const json = await res.json();
                if (!mounted) return;
                setSigill({ count: json.count || 0, alerts: json.alerts || [] });
            } catch (err) {
                if (!mounted) return;
                setSigill({ count: 0, alerts: [] });
            }
        }

        fetchAlerts();
        fetchSigill();
        const t1 = setInterval(fetchAlerts, 30000);
        const t2 = setInterval(fetchSigill, 30000);
        return () => { mounted = false; clearInterval(t1); clearInterval(t2); };
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

            {/* SIGILL specific feed */}
            <div style={{ marginTop: 12 }}>
                <h5>SIGILL Alerts <span style={{ color: '#ff6b6b' }}>({sigill.count})</span></h5>
                <ul>
                    {sigill.alerts.slice(0, max).map(a => (
                        <li key={a.id} className={`alert ${a.level}`}>
                            <div className="title">{a.title}</div>
                            <div className="message">{a.message}</div>
                            {a.link && <a className="link" href={a.link} target="_blank" rel="noreferrer">Issue / Gist</a>}
                            {a.artifacts && (
                                <div className="artifacts">
                                    <a className="link" href={a.artifacts.strace} target="_blank" rel="noreferrer">strace</a>
                                    <span style={{ margin: '0 6px' }}>|</span>
                                    <a className="link" href={a.artifacts.core} target="_blank" rel="noreferrer">core</a>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

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
