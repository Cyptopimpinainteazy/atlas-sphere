import React, { useEffect, useState } from 'react';

export interface AlertsPanelProps {
  rpcUrl: string;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ rpcUrl }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async (): Promise<void> => {
      try {
        // Mock alerts - replace with actual monitoring API call
        const mockAlerts: Alert[] = [
          {
            id: '1',
            severity: 'info',
            title: 'Maintenance Window Scheduled',
            message: 'Database maintenance scheduled for tonight at 2 AM',
            timestamp: Date.now() - 3600000,
          },
          {
            id: '2',
            severity: 'warning',
            title: 'High Memory Usage',
            message: 'Memory usage is at 85% on production server',
            timestamp: Date.now() - 1800000,
          },
        ];
        setAlerts(mockAlerts);
      } catch (err) {
        setAlerts([
          {
            id: 'error',
            severity: 'error',
            title: 'Failed to Load Alerts',
            message: err instanceof Error ? err.message : 'Unknown error',
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [rpcUrl]);

  const getSeverityColor = (severity: Alert['severity']): string => {
    switch (severity) {
      case 'critical':
        return '#ff6b6b';
      case 'error':
        return '#ff6b6b';
      case 'warning':
        return '#ffd700';
      case 'info':
        return '#00d4ff';
      default:
        return '#888';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className="alerts-panel">
      <h4>🚨 Alerts & Notifications</h4>
      <div className="alerts-list">
        {loading ? (
          <p className="loading">Loading alerts...</p>
        ) : alerts.length === 0 ? (
          <p className="no-alerts">No active alerts</p>
        ) : (
          alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className="alert-item"
              style={{
                borderLeftColor: getSeverityColor(alert.severity),
              }}
            >
              <div className="alert-header">
                <span className="alert-icon">{getSeverityIcon(alert.severity)}</span>
                <span className="alert-title">{alert.title}</span>
              </div>
              <p className="alert-message">{alert.message}</p>
              <div className="alert-time">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
      <style jsx>{`
        .alerts-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 16px;
          color: #e0e0e0;
          border: 1px solid #333;
        }

        h4 {
          margin: 0 0 12px 0;
          color: #00d4ff;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .loading,
        .no-alerts {
          margin: 0;
          font-size: 12px;
          color: #888;
          text-align: center;
          padding: 16px 0;
        }

        .alert-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #333;
          border-left: 3px solid;
          border-radius: 4px;
          padding: 8px;
          font-size: 11px;
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .alert-icon {
          font-size: 12px;
        }

        .alert-title {
          font-weight: bold;
          color: #fff;
        }

        .alert-message {
          margin: 4px 0;
          color: #aaa;
          line-height: 1.3;
        }

        .alert-time {
          margin: 4px 0 0 0;
          color: #666;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
};

export default AlertsPanel;
