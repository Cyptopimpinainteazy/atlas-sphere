#!/usr/bin/env node
/**
 * Example: React Component Integration with Jury Blockchain Anchoring
 *
 * This example shows how to:
 * 1. Import the JuryAnchoring adapter
 * 2. Create a React component for displaying decision status
 * 3. Poll blockchain for verification
 * 4. Display verified status to user
 */

import React, { useState, useEffect } from 'react';
import { JuryAnchoring, useJuryDecisionStatus } from '@atlas/blockchain-adapter';

// Configuration
const RPC_URL = 'http://localhost:9944';
const juryAnchoring = new JuryAnchoring(RPC_URL);

/**
 * Component: JuryDecisionStatusDisplay
 *
 * Displays the current status of a jury decision with real-time updates
 */
function JuryDecisionStatusDisplay({ sessionId, decisionHash }) {
  const { status, isLoading, error } = useJuryDecisionStatus(
    sessionId,
    juryAnchoring
  );

  if (isLoading) {
    return (
      <div className="decision-status loading">
        <div className="spinner" />
        <p>Anchoring to blockchain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="decision-status error">
        <p>Error: {error.message}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="decision-status pending">
        <p>Decision not yet found</p>
      </div>
    );
  }

  const isVerified =
    status.status === 'anchored' &&
    status.on_chain?.decision_hash === decisionHash;

  return (
    <div className={`decision-status ${status.status}`}>
      <div className="status-header">
        <h3>Jury Decision Status</h3>
        {isVerified && <span className="verified-badge">✓ Verified</span>}
      </div>

      <div className="status-body">
        <div className="status-row">
          <span className="label">Session ID:</span>
          <span className="value">{sessionId}</span>
        </div>

        <div className="status-row">
          <span className="label">Status:</span>
          <span className="value">
            {status.status === 'anchored' ? '✓ Anchored' : '⏳ Pending'}
          </span>
        </div>

        {status.on_chain && (
          <>
            <div className="status-row">
              <span className="label">Block Number:</span>
              <span className="value">#{status.on_chain.block_number}</span>
            </div>

            <div className="status-row">
              <span className="label">On-Chain Hash:</span>
              <span className="value hash-value">
                {status.on_chain.decision_hash.substring(0, 10)}...
              </span>
            </div>

            {isVerified && (
              <div className="verification-result success">
                <p>✓ Hash matches - Decision verified on blockchain!</p>
              </div>
            )}

            {status.status === 'anchored' && !isVerified && (
              <div className="verification-result warning">
                <p>⚠ Hash mismatch - Decision not verified</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="status-actions">
        <button
          onClick={() => juryAnchoring.getDecisionStatus(sessionId)}
          className="btn btn-refresh"
        >
          Refresh Status
        </button>
      </div>

      <style>{`
        .decision-status {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          background-color: #fafafa;
        }

        .decision-status.anchored {
          border-left: 4px solid #4CAF50;
        }

        .decision-status.pending {
          border-left: 4px solid #FF9800;
        }

        .decision-status.error {
          border-left: 4px solid #f44336;
          background-color: #FFEBEE;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .verified-badge {
          background-color: #4CAF50;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .status-row:last-child {
          border-bottom: none;
        }

        .label {
          font-weight: 600;
          color: #666;
        }

        .value {
          font-family: 'Courier New', monospace;
          color: #333;
        }

        .hash-value {
          word-break: break-all;
        }

        .verification-result {
          margin-top: 15px;
          padding: 10px;
          border-radius: 4px;
          font-size: 14px;
        }

        .verification-result.success {
          background-color: #E8F5E9;
          color: #2E7D32;
        }

        .verification-result.warning {
          background-color: #FFF3E0;
          color: #E65100;
        }

        .status-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .btn-refresh {
          background-color: #2196F3;
          color: white;
        }

        .btn-refresh:hover {
          background-color: #1976D2;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #2196F3;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .loading {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .loading p {
          margin: 0;
          color: #666;
        }
      `}</style>
    </div>
  );
}

/**
 * Example Usage
 */
export default function App() {
  return (
    <div className="app">
      <h1>Jury Decision Verification Dashboard</h1>

      <JuryDecisionStatusDisplay
        sessionId="session-20260208-001"
        decisionHash="0xabc123def456..."
      />
    </div>
  );
}

// Export for use in other files
export { JuryDecisionStatusDisplay };
