/**
 * IframePanel — embeds a URL inside a desktop window via iframe.
 *
 * Uses a fetch-based health check before rendering the iframe, since
 * iframe onError only fires for very specific network-level failures.
 * Includes a load timeout to detect unresponsive servers.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

interface IframePanelProps {
  url: string;
  title?: string;
  // optional sandbox attribute for increased isolation (pass through to iframe)
  sandbox?: string;
  // optional `allow` attribute (feature policy) for the iframe
  allow?: string;
  // optional referrer-policy for the iframe
  referrerPolicy?: string;
}

type Status = "checking" | "loading" | "ready" | "unreachable";

const HEALTH_TIMEOUT = 5_000; // ms to wait for fetch health check
const LOAD_TIMEOUT = 12_000; // ms to wait for iframe to finish loading

const IframePanel: React.FC<IframePanelProps> = ({ url, title, sandbox, allow, referrerPolicy }) => {
  const [status, setStatus] = useState<Status>("checking");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Normalize special schemes (ipfs://, ispf://) into HTTP gateway URLs so
   * fetch/iframe can consume them in the browser environment.
   */
  const normalizeUrl = (u: string) => {
    try {
      if (/^ipfs:\/\//i.test(u) || /^ispf:\/\//i.test(u)) {
        // strip scheme and leading slashes
        const cid = u.replace(/^ipfs:\/\//i, '').replace(/^ispf:\/\//i, '');
        // prefer a local gateway when available (developer expectation)
        return `http://127.0.0.1:8080/ipfs/${cid}/`;
      }
      return u;
    } catch {
      return u;
    }
  };

  /** Probe the URL with fetch to see if the server is alive (normalizes IPFS/ISPF) */
  const checkReachable = useCallback(async () => {
    setStatus("checking");
    const probeUrl = normalizeUrl(url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);
      await fetch(probeUrl, {
        mode: "no-cors", // we don't need to read the body, just verify reachability
        signal: controller.signal,
      });
      clearTimeout(timer);
      setStatus("loading");
    } catch {
      setStatus("unreachable");
    }
  }, [url]);

  // Run health check on mount / URL change
  useEffect(() => {
    checkReachable();
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [checkReachable]);

  // Start a load-timeout when we transition to "loading"
  useEffect(() => {
    if (status === "loading") {
      loadTimerRef.current = setTimeout(() => {
        // If still "loading" after timeout, the iframe might be stuck
        setStatus("unreachable");
      }, LOAD_TIMEOUT);
    }
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [status]);

  const handleIframeLoad = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    setStatus("ready");
  };

  const handleRetry = () => {
    // Force iframe to reload too
    if (iframeRef.current) {
      iframeRef.current.src = "";
    }
    checkReachable();
  };

  /* ── Checking / connecting overlay ── */
  if (status === "checking") {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0f]">
        <div className="text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin mb-3" />
          <div className="text-xs font-mono text-[#888]">Connecting to {title || "app"}…</div>
          <div className="text-[10px] font-mono text-[#555] mt-1">{url}</div>
        </div>
      </div>
    );
  }

  /* ── Unreachable / error overlay ── */
  if (status === "unreachable") {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0f]">
        <div className="text-center max-w-xs">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-sm text-[#ff6b35] font-medium mb-2">
            Cannot reach {title || "application"}
          </div>
          <div className="text-xs text-[#888] mb-1">
            The app server is not responding at:
          </div>
          <code className="text-[10px] text-[#00e5ff] bg-[#111] px-3 py-1.5 rounded block mb-3">
            {url}
          </code>
          <div className="text-[10px] text-[#666] mb-4">
            Start the server first, then retry.
          </div>
          <button
            className="text-xs text-[#ff6b35] border border-[#ff6b35]/40 px-4 py-1.5 rounded
              hover:bg-[#ff6b35]/10 transition-colors"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading / Ready — show iframe ── */
  return (
    <div className="relative w-full h-full bg-[#0a0a0f]">
      {/* Loading overlay — fades out once iframe signals load */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0f]">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin mb-3" />
            <div className="text-xs font-mono text-[#888]">Loading {title || "app"}…</div>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={typeof url === 'string' ? (typeof (normalizeUrl) === 'function' ? normalizeUrl(url) : url) : url}
        title={title || "Application"}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        loading="lazy"
        allow={allow ?? "clipboard-read; clipboard-write"}
        sandbox={typeof sandbox !== 'undefined' ? sandbox : undefined}
        referrerPolicy={referrerPolicy ?? "no-referrer"}
      />
    </div>
  );
};

export default IframePanel;
