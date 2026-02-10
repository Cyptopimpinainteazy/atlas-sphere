import React from "react";

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Quick Help</h3>
        <p>Shortcuts:</p>
        <ul>
          <li><strong>Floor</strong> — Live intents and metrics</li>
          <li><strong>Bonds</strong> — Deposit / withdraw collateral</li>
          <li><strong>Proofs</strong> — Verify execution proofs</li>
          <li><strong>How to Use</strong> — Guided quickstart</li>
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
