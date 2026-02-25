import React from "react";

export const PanelLoading: React.FC<{ label?: string }> = ({ label = "Gathering telemetry…" }) => (
  <div className="h-full flex items-center justify-center bg-[#05050c] text-[#999] text-[11px] font-mono">
    <div className="flex flex-col items-center gap-2">
      <div className="inline-block w-7 h-7 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  </div>
);

export const PanelError: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-full flex items-center justify-center bg-[#05050c] text-[#ff6b35] text-[11px] font-mono">
    <div className="flex flex-col items-center gap-1">
      <div className="text-lg">⚠</div>
      <p className="text-center max-w-xs text-[#fca5a5]">Could not load panel data: <span className="font-mono block">{message}</span></p>
    </div>
  </div>
);
