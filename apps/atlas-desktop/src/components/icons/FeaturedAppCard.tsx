/**
 * FeaturedAppCard — hero card for a featured application.
 *
 * Sits top-right of the desktop. Front face shows a large icon with the app name.
 * On hover the card flips to reveal a description. Click launches the app.
 */
import React, { useState, useCallback } from "react";
import type { Application } from "@/types/application";

interface FeaturedAppCardProps {
  app: Application;
  isRunning: boolean;
  onLaunch: (appId: string) => void;
}

const FeaturedAppCard: React.FC<FeaturedAppCardProps> = ({ app, isRunning, onLaunch }) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => onLaunch(app.id), [app.id, onLaunch]);

  const accent = app.icon.color ?? "#ff6b35";

  return (
    <div
      className="cursor-pointer select-none"
      style={{ perspective: 800, width: 260, height: 150 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${app.name} — click to launch`}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: hovered ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── Front Face ─────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 12,
            border: `2px solid ${accent}55`,
            background: `linear-gradient(135deg, #111113 0%, #0a0a0f 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: `0 0 24px ${accent}22, inset 0 1px 0 #ffffff08`,
            overflow: "hidden",
          }}
        >
          {/* Glow accent line at top */}
          <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, borderRadius: 2 }} />

          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 100%)`,
              border: `2px solid ${accent}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            ⛓
          </div>

          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#e0e0e0", letterSpacing: "-0.01em" }}>
              {app.name}
            </div>
            <div style={{ fontSize: 10, color: "#8a8a8e", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Enterprise Multi-Chain
            </div>
          </div>

          {/* Running indicator */}
          {isRunning && (
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#00d4aa", boxShadow: "0 0 6px #00d4aa66" }} />
              <span style={{ fontSize: 9, color: "#00d4aa", fontFamily: "monospace" }}>LIVE</span>
            </div>
          )}

          {/* Subtle shine effect */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
            pointerEvents: "none",
          }} />
        </div>

        {/* ── Back Face ──────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 12,
            border: `2px solid ${accent}66`,
            background: `linear-gradient(135deg, #0f0f14 0%, #0a0a0f 100%)`,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: `0 0 30px ${accent}33, inset 0 1px 0 #ffffff08`,
            overflow: "hidden",
          }}
        >
          {/* Accent line */}
          <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, borderRadius: 2 }} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0", marginBottom: 8 }}>
              What is this?
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: "#aaa" }}>
              Connect to <span style={{ color: accent, fontWeight: 600 }}>40+ blockchains</span> simultaneously.
              Run GPU-accelerated benchmarks, test validator health,
              and monitor real-time metrics — all from one panel.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {["EVM", "BTC", "SOL", "NEAR"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 3,
                    fontSize: 9,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    background: `${accent}18`,
                    color: accent,
                    border: `1px solid ${accent}33`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, color: accent,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Click to Open →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(FeaturedAppCard);
