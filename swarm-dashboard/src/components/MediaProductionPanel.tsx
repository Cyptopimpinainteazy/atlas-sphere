import React, { useEffect, useState } from 'react';

export interface MediaProductionPanelProps {
  rpcUrl: string;
  pollInterval?: number;
}

export interface ProductionSession {
  id: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  title: string;
  startTime?: number;
  endTime?: number;
}

export const MediaProductionPanel: React.FC<MediaProductionPanelProps> = ({
  rpcUrl,
  pollInterval = 30000,
}) => {
  const [sessions, setSessions] = useState<ProductionSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const fetchSessions = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(undefined);
        // Mock data - replace with actual RPC call
        const mockSessions: ProductionSession[] = [
          {
            id: '1',
            status: 'in-progress',
            progress: 45,
            title: 'Audio Recording Session 1',
            startTime: Date.now() - 30000,
          },
          {
            id: '2',
            status: 'scheduled',
            progress: 0,
            title: 'Video Editing 2',
            startTime: Date.now() + 60000,
          },
          {
            id: '3',
            status: 'completed',
            progress: 100,
            title: 'Media Render 3',
            startTime: Date.now() - 120000,
            endTime: Date.now() - 60000,
          },
        ];
        setSessions(mockSessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, pollInterval);
    return () => clearInterval(interval);
  }, [rpcUrl, pollInterval]);

  if (error) {
    return (
      <div className="media-production-panel error">
        <p>Error loading sessions: {error}</p>
      </div>
    );
  }

  return (
    <div className="media-production-panel">
      <h2>📹 Production Sessions</h2>
      <div className="session-list">
        {loading && !sessions.length ? (
          <p className="loading-text">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="no-sessions">No sessions found</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className={`session-card ${session.status}`}>
              <div className="session-header">
                <h3>{session.title}</h3>
                <span className={`status-badge ${session.status}`}>{session.status}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${session.progress}%` }} />
              </div>
              <div className="progress-text">{session.progress}%</div>
            </div>
          ))
        )}
      </div>
      <style jsx>{`
        .media-production-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 24px;
          color: #e0e0e0;
          border: 1px solid #333;
        }

        .media-production-panel.error {
          background: rgba(255, 107, 107, 0.1);
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        h2 {
          margin: 0 0 20px 0;
          color: #00d4ff;
          font-size: 18px;
        }

        .session-list {
          display: grid;
          gap: 16px;
        }

        .session-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #333;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.3s;
        }

        .session-card:hover {
          border-color: #00d4ff;
          background: rgba(0, 212, 255, 0.05);
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .session-header h3 {
          margin: 0;
          font-size: 14px;
          color: #fff;
        }

        .status-badge {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          font-weight: bold;
        }

        .status-badge.in-progress {
          background: #ffd700;
          color: #000;
        }

        .status-badge.scheduled {
          background: #4caf50;
          color: #fff;
        }

        .status-badge.completed {
          background: #00d4ff;
          color: #000;
        }

        .status-badge.failed {
          background: #ff6b6b;
          color: #fff;
        }

        .progress-bar {
          background: rgba(0, 0, 0, 0.3);
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          background: linear-gradient(90deg, #00d4ff, #00ff9f);
          height: 100%;
          transition: width 0.3s;
        }

        .progress-text {
          font-size: 12px;
          color: #888;
        }

        .loading-text,
        .no-sessions {
          text-align: center;
          color: #888;
          padding: 24px;
        }
      `}</style>
    </div>
  );
};

export default MediaProductionPanel;
