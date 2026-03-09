import { useEffect, useMemo, useState } from 'react';
import {
  openclawGetConfig,
  openclawListTools,
  openclawRunTool,
  openclawSaveConfig,
  type OpenClawToolInventoryEntry,
  type OpenClawToolsResponse,
} from '../../lib/api';
import { useIDEStore } from '../../store/ideStore';

type BrowserForm = {
  action: string;
  profile: string;
  target: string;
  url: string;
  ref: string;
  act: string;
  text: string;
};

type CanvasForm = {
  action: string;
  node: string;
  url: string;
  text: string;
  code: string;
};

type NodesForm = {
  action: string;
  node: string;
  title: string;
  text: string;
  command: string;
};

type MessageForm = {
  action: string;
  channel: string;
  thread: string;
  text: string;
};

type ExecForm = {
  command: string;
  yieldMs: number;
  timeout: number;
  host: string;
  pty: boolean;
  background: boolean;
};

type ProcessForm = {
  action: string;
  sessionId: string;
  limit: number;
  text: string;
};

type WebSearchForm = {
  query: string;
  count: number;
  country: string;
  searchLang: string;
  uiLang: string;
  freshness: string;
};

type WebFetchForm = {
  url: string;
  extractMode: 'markdown' | 'text';
  maxChars: number;
};

type PdfForm = {
  files: string;
  prompt: string;
};

type ImageForm = {
  image: string;
  prompt: string;
  model: string;
};

type MediaPipelineForm = {
  sourceUrl: string;
  browserProfile: string;
  browserRef: string;
  canvasNode: string;
  canvasText: string;
  node: string;
  notifyTitle: string;
  notifyText: string;
  messageChannel: string;
  messageText: string;
};

type PanelView = 'runner' | 'pipeline';
type LastRunKind = 'tool' | 'pipeline' | null;
type OpenClawArtifact = {
  kind: 'media' | 'file';
  path: string;
};

const DEFAULT_TOOLS_RESPONSE: OpenClawToolsResponse = {
  profiles: ['minimal', 'coding', 'messaging', 'full'],
  groups: [],
  tools: [],
};

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCommandParts(value: string): string[] {
  return value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function safeParseJson(input: string): Record<string, unknown> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Generic payload must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function toolSummary(tool: OpenClawToolInventoryEntry | undefined): string {
  if (!tool) {
    return 'Select a tool to inspect its common actions and run it.';
  }
  return `${tool.summary} Common actions: ${tool.commonActions.join(', ') || 'none listed'}.`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function collectArtifacts(value: unknown, seen = new Set<string>(), depth = 0): OpenClawArtifact[] {
  if (value == null || depth > 6) {
    return [];
  }

  if (typeof value === 'string') {
    const matches = [...value.matchAll(/\b(MEDIA|FILE):([^\s]+)/g)];
    const artifacts: OpenClawArtifact[] = [];
    for (const match of matches) {
      const path = match[2]?.trim();
      if (!path || seen.has(`${match[1]}:${path}`)) {
        continue;
      }
      seen.add(`${match[1]}:${path}`);
      artifacts.push({
        kind: match[1] === 'MEDIA' ? 'media' : 'file',
        path,
      });
    }
    return artifacts;
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectArtifacts(item, seen, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectArtifacts(item, seen, depth + 1),
    );
  }

  return [];
}

function extractPreviewText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return '';
  }
  return firstString(
    record.text,
    record.markdown,
    record.content,
    record.output,
    record.stdout,
    record.message,
    record.body,
    record.summary,
    record.description,
  );
}

export function OpenClawPanel() {
  const { openClawConfig, setOpenClawConfig } = useIDEStore();
  const showConfigWarning = !openClawConfig.baseUrl?.trim();
  const [view, setView] = useState<PanelView>('runner');
  const [inventory, setInventory] = useState<OpenClawToolsResponse>(DEFAULT_TOOLS_RESPONSE);
  const [selectedTool, setSelectedTool] = useState('browser');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [runOutput, setRunOutput] = useState('');
  const [lastRunKind, setLastRunKind] = useState<LastRunKind>(null);
  const [lastRunTool, setLastRunTool] = useState('');
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [genericInput, setGenericInput] = useState('{}');
  const [browserForm, setBrowserForm] = useState<BrowserForm>({
    action: 'status',
    profile: '',
    target: '',
    url: '',
    ref: '',
    act: 'click',
    text: '',
  });
  const [canvasForm, setCanvasForm] = useState<CanvasForm>({
    action: 'present',
    node: '',
    url: '',
    text: '',
    code: '',
  });
  const [nodesForm, setNodesForm] = useState<NodesForm>({
    action: 'status',
    node: '',
    title: '',
    text: '',
    command: '',
  });
  const [messageForm, setMessageForm] = useState<MessageForm>({
    action: 'send',
    channel: '',
    thread: '',
    text: '',
  });
  const [execForm, setExecForm] = useState<ExecForm>({
    command: '',
    yieldMs: 10000,
    timeout: 1800,
    host: 'sandbox',
    pty: false,
    background: false,
  });
  const [processForm, setProcessForm] = useState<ProcessForm>({
    action: 'list',
    sessionId: '',
    limit: 50,
    text: '',
  });
  const [webSearchForm, setWebSearchForm] = useState<WebSearchForm>({
    query: '',
    count: 5,
    country: '',
    searchLang: '',
    uiLang: '',
    freshness: '',
  });
  const [webFetchForm, setWebFetchForm] = useState<WebFetchForm>({
    url: '',
    extractMode: 'markdown',
    maxChars: 10000,
  });
  const [pdfForm, setPdfForm] = useState<PdfForm>({
    files: '',
    prompt: '',
  });
  const [imageForm, setImageForm] = useState<ImageForm>({
    image: '',
    prompt: 'Describe the image.',
    model: '',
  });
  const [mediaForm, setMediaForm] = useState<MediaPipelineForm>({
    sourceUrl: '',
    browserProfile: '',
    browserRef: '',
    canvasNode: '',
    canvasText: '',
    node: '',
    notifyTitle: '',
    notifyText: '',
    messageChannel: '',
    messageText: '',
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [config, tools] = await Promise.all([openclawGetConfig(), openclawListTools()]);
        if (cancelled) {
          return;
        }
        setOpenClawConfig(config);
        setInventory(tools);
        if (!tools.tools.some((tool) => tool.name === selectedTool) && tools.tools.length > 0) {
          setSelectedTool(tools.tools[0].name);
        }
        setStatus('');
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to load OpenClaw state.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [setOpenClawConfig]);

  const selectedToolInfo = useMemo(
    () => inventory.tools.find((tool) => tool.name === selectedTool),
    [inventory.tools, selectedTool],
  );
  const lastArtifacts = useMemo(() => collectArtifacts(lastResult), [lastResult]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const saved = await openclawSaveConfig(openClawConfig);
      setOpenClawConfig(saved);
      setStatus('Saved OpenClaw config.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save OpenClaw config.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildPayload = (): Record<string, unknown> => {
    switch (selectedTool) {
      case 'browser': {
        const payload: Record<string, unknown> = { action: browserForm.action };
        if (browserForm.profile.trim()) payload.profile = browserForm.profile.trim();
        if (browserForm.target.trim()) payload.target = browserForm.target.trim();
        if ((browserForm.action === 'open' || browserForm.action === 'navigate') && browserForm.url.trim()) {
          payload.url = browserForm.url.trim();
        }
        if ((browserForm.action === 'snapshot' || browserForm.action === 'screenshot') && browserForm.ref.trim()) {
          payload.ref = browserForm.ref.trim();
        }
        if (browserForm.action === 'act') {
          payload.act = browserForm.act;
          if (browserForm.ref.trim()) payload.ref = browserForm.ref.trim();
          if (browserForm.text.trim()) payload.text = browserForm.text;
        }
        return payload;
      }
      case 'canvas': {
        const payload: Record<string, unknown> = { action: canvasForm.action };
        if (canvasForm.node.trim()) payload.node = canvasForm.node.trim();
        if (canvasForm.action === 'navigate' && canvasForm.url.trim()) payload.url = canvasForm.url.trim();
        if (canvasForm.action === 'a2ui_push' && canvasForm.text.trim()) payload.text = canvasForm.text;
        if (canvasForm.action === 'eval' && canvasForm.code.trim()) payload.code = canvasForm.code;
        return payload;
      }
      case 'nodes': {
        const payload: Record<string, unknown> = { action: nodesForm.action };
        if (nodesForm.node.trim()) payload.node = nodesForm.node.trim();
        if (nodesForm.action === 'notify') {
          if (nodesForm.title.trim()) payload.title = nodesForm.title.trim();
          if (nodesForm.text.trim()) payload.text = nodesForm.text;
        }
        if (nodesForm.action === 'run' && nodesForm.command.trim()) {
          payload.command = parseCommandParts(nodesForm.command);
        }
        return payload;
      }
      case 'message': {
        const payload: Record<string, unknown> = { action: messageForm.action };
        if (messageForm.channel.trim()) payload.channel = messageForm.channel.trim();
        if (messageForm.thread.trim()) payload.thread = messageForm.thread.trim();
        if (messageForm.text.trim()) payload.text = messageForm.text;
        return payload;
      }
      case 'exec': {
        const payload: Record<string, unknown> = {
          command: execForm.command.trim(),
          yieldMs: execForm.yieldMs,
          timeout: execForm.timeout,
          host: execForm.host,
          pty: execForm.pty,
          background: execForm.background,
        };
        return payload;
      }
      case 'process': {
        const payload: Record<string, unknown> = { action: processForm.action };
        if (processForm.sessionId.trim()) {
          payload.sessionId = processForm.sessionId.trim();
        }
        if (processForm.action === 'log') {
          payload.limit = processForm.limit;
        }
        if (processForm.action === 'write' && processForm.text) {
          payload.text = processForm.text;
        }
        return payload;
      }
      case 'web_search': {
        const payload: Record<string, unknown> = {
          query: webSearchForm.query.trim(),
          count: webSearchForm.count,
        };
        if (webSearchForm.country.trim()) payload.country = webSearchForm.country.trim();
        if (webSearchForm.searchLang.trim()) payload.search_lang = webSearchForm.searchLang.trim();
        if (webSearchForm.uiLang.trim()) payload.ui_lang = webSearchForm.uiLang.trim();
        if (webSearchForm.freshness.trim()) payload.freshness = webSearchForm.freshness.trim();
        return payload;
      }
      case 'web_fetch':
        return {
          url: webFetchForm.url.trim(),
          extractMode: webFetchForm.extractMode,
          maxChars: webFetchForm.maxChars,
        };
      case 'pdf':
        return {
          files: parseCsvList(pdfForm.files),
          prompt: pdfForm.prompt.trim(),
        };
      case 'image': {
        const payload: Record<string, unknown> = {
          image: imageForm.image.trim(),
          prompt: imageForm.prompt.trim() || 'Describe the image.',
        };
        if (imageForm.model.trim()) payload.model = imageForm.model.trim();
        return payload;
      }
      default:
        return safeParseJson(genericInput);
    }
  };

  const handleRunTool = async () => {
    setIsRunning(true);
    try {
      const payload = buildPayload();
      const result = await openclawRunTool(selectedTool, payload);
      setLastRunKind('tool');
      setLastRunTool(selectedTool);
      setLastResult(result.result);
      setRunOutput(prettyJson(result));
      setStatus(`Ran ${selectedTool}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run OpenClaw tool.';
      setRunOutput(`Error: ${message}`);
      setStatus(message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunMediaPipeline = async () => {
    setIsPipelineRunning(true);
    const steps: Array<Record<string, unknown>> = [];

    try {
      if (mediaForm.sourceUrl.trim()) {
        const openResult = await openclawRunTool('browser', {
          action: 'open',
          url: mediaForm.sourceUrl.trim(),
          ...(mediaForm.browserProfile.trim() ? { profile: mediaForm.browserProfile.trim() } : {}),
        });
        steps.push({ step: 'browser.open', ok: true, result: openResult.result });

        const captureResult = await openclawRunTool('browser', {
          action: 'screenshot',
          ...(mediaForm.browserProfile.trim() ? { profile: mediaForm.browserProfile.trim() } : {}),
          ...(mediaForm.browserRef.trim() ? { ref: mediaForm.browserRef.trim() } : {}),
        });
        steps.push({ step: 'browser.screenshot', ok: true, result: captureResult.result });
      }

      const canvasAction = mediaForm.canvasText.trim() ? 'a2ui_push' : 'snapshot';
      const canvasPayload: Record<string, unknown> = {
        action: canvasAction,
      };
      if (mediaForm.canvasNode.trim()) {
        canvasPayload.node = mediaForm.canvasNode.trim();
      }
      if (canvasAction === 'a2ui_push') {
        canvasPayload.text = mediaForm.canvasText;
      }
      const canvasResult = await openclawRunTool('canvas', canvasPayload);
      steps.push({ step: `canvas.${canvasAction}`, ok: true, result: canvasResult.result });

      if (mediaForm.notifyTitle.trim() || mediaForm.notifyText.trim() || mediaForm.node.trim()) {
        const nodeResult = await openclawRunTool('nodes', {
          action: 'notify',
          ...(mediaForm.node.trim() ? { node: mediaForm.node.trim() } : {}),
          ...(mediaForm.notifyTitle.trim() ? { title: mediaForm.notifyTitle.trim() } : {}),
          ...(mediaForm.notifyText.trim() ? { text: mediaForm.notifyText.trim() } : {}),
        });
        steps.push({ step: 'nodes.notify', ok: true, result: nodeResult.result });
      }

      if (mediaForm.messageChannel.trim() && mediaForm.messageText.trim()) {
        const messageResult = await openclawRunTool('message', {
          action: 'send',
          channel: mediaForm.messageChannel.trim(),
          text: mediaForm.messageText.trim(),
        });
        steps.push({ step: 'message.send', ok: true, result: messageResult.result });
      }

      const pipelineResult = { pipeline: 'media', steps };
      setLastRunKind('pipeline');
      setLastRunTool('media');
      setLastResult(pipelineResult);
      setRunOutput(prettyJson(pipelineResult));
      setStatus('Ran media pipeline.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run media pipeline.';
      steps.push({ step: 'error', ok: false, error: message });
      const pipelineResult = { pipeline: 'media', steps };
      setLastRunKind('pipeline');
      setLastRunTool('media');
      setLastResult(pipelineResult);
      setRunOutput(prettyJson(pipelineResult));
      setStatus(message);
    } finally {
      setIsPipelineRunning(false);
    }
  };

  const renderArtifactList = (artifacts: OpenClawArtifact[], compact = false) => {
    if (!artifacts.length) {
      return null;
    }

    return (
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Artifacts</div>
        <div className={`space-y-1 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {artifacts.map((artifact) => (
            <div
              key={`${artifact.kind}:${artifact.path}`}
              className="rounded bg-ide-surface px-2 py-1 break-all text-ide-text"
            >
              <span className="mr-2 uppercase text-ide-text-dim">{artifact.kind}</span>
              <span>{artifact.path}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderToolPreview = () => {
    const resultRecord = asRecord(lastResult);
    const previewText = extractPreviewText(lastResult);

    if (lastRunKind !== 'tool') {
      return null;
    }

    if (lastRunTool === 'browser') {
      const statusText = firstString(resultRecord?.status, resultRecord?.state, resultRecord?.mode);
      const urlText = firstString(resultRecord?.url, resultRecord?.location);
      const titleText = firstString(resultRecord?.title, resultRecord?.pageTitle);
      const tabsValue = Array.isArray(resultRecord?.tabs)
        ? resultRecord?.tabs.length
        : typeof resultRecord?.tabCount === 'number'
        ? resultRecord.tabCount
        : null;

      return (
        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3" data-testid="openclaw-preview-browser">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Typed Preview</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-[11px]">
            <div><span className="text-ide-text-dim">Browser Status</span>: {statusText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Browser URL</span>: {urlText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Title</span>: {titleText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Tabs</span>: {tabsValue ?? 'n/a'}</div>
          </div>
          {previewText && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Snapshot Text</div>
              <div className="rounded bg-ide-surface p-2 text-[11px] whitespace-pre-wrap text-ide-text">
                {previewText}
              </div>
            </div>
          )}
          {renderArtifactList(lastArtifacts)}
        </div>
      );
    }

    if (lastRunTool === 'canvas') {
      const nodeText = firstString(resultRecord?.node, resultRecord?.surface, resultRecord?.target);
      const actionText = firstString(resultRecord?.action, resultRecord?.mode, resultRecord?.status);
      const previewSummary = previewText || firstString(resultRecord?.result);

      return (
        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3" data-testid="openclaw-preview-canvas">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Typed Preview</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-[11px]">
            <div><span className="text-ide-text-dim">Canvas Node</span>: {nodeText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Canvas Result</span>: {actionText || 'n/a'}</div>
          </div>
          {previewSummary && (
            <div className="rounded bg-ide-surface p-2 text-[11px] whitespace-pre-wrap text-ide-text">
              {previewSummary}
            </div>
          )}
          {renderArtifactList(lastArtifacts)}
        </div>
      );
    }

    if (lastRunTool === 'nodes') {
      const statusText = firstString(resultRecord?.status, resultRecord?.state);
      const nodeCount = Array.isArray(resultRecord?.nodes) ? resultRecord.nodes.length : null;
      const nodeNames =
        Array.isArray(resultRecord?.nodes)
          ? resultRecord.nodes
              .map((node) => firstString(asRecord(node)?.id, asRecord(node)?.name))
              .filter(Boolean)
              .join(', ')
          : '';
      const outputText = previewText || firstString(resultRecord?.stderr);

      return (
        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3" data-testid="openclaw-preview-nodes">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Typed Preview</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-[11px]">
            <div><span className="text-ide-text-dim">Node Status</span>: {statusText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Nodes</span>: {nodeCount ?? 'n/a'}</div>
          </div>
          {nodeNames && (
            <div className="rounded bg-ide-surface p-2 text-[11px] text-ide-text">
              {nodeNames}
            </div>
          )}
          {outputText && (
            <div className="rounded bg-ide-surface p-2 text-[11px] whitespace-pre-wrap text-ide-text">
              {outputText}
            </div>
          )}
          {renderArtifactList(lastArtifacts)}
        </div>
      );
    }

    if (lastRunTool === 'message') {
      const resultText = firstString(resultRecord?.status, resultRecord?.result);
      const channelText = firstString(resultRecord?.channel, resultRecord?.target, resultRecord?.room);
      const threadText = firstString(resultRecord?.thread, resultRecord?.threadId);
      const bodyText = previewText;

      return (
        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3" data-testid="openclaw-preview-message">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Typed Preview</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-[11px]">
            <div><span className="text-ide-text-dim">Delivery Status</span>: {resultText || 'n/a'}</div>
            <div><span className="text-ide-text-dim">Channel</span>: {channelText || 'n/a'}</div>
          </div>
          {threadText && (
            <div className="text-[11px] text-ide-text"><span className="text-ide-text-dim">Thread</span>: {threadText}</div>
          )}
          {bodyText && (
            <div className="rounded bg-ide-surface p-2 text-[11px] whitespace-pre-wrap text-ide-text">
              {bodyText}
            </div>
          )}
          {renderArtifactList(lastArtifacts)}
        </div>
      );
    }

    return null;
  };

  const renderPipelinePreview = () => {
    const pipeline = asRecord(lastResult);
    const steps = Array.isArray(pipeline?.steps) ? pipeline.steps : [];

    if (lastRunKind !== 'pipeline') {
      return null;
    }

    return (
      <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3" data-testid="openclaw-preview-pipeline">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Typed Preview</div>
          <div className="text-[10px] text-ide-text-dim">{steps.length} steps</div>
        </div>
        {steps.length === 0 ? (
          <div className="rounded bg-ide-surface p-2 text-[11px] text-ide-text-dim">No pipeline steps recorded.</div>
        ) : (
          <div className="space-y-2">
            {steps.map((rawStep, index) => {
              const step = asRecord(rawStep);
              const stepName = firstString(step?.step) || `step-${index + 1}`;
              const ok = step?.ok === false ? 'Failed' : 'OK';
              const summary = firstString(step?.error) || extractPreviewText(step?.result);
              const stepArtifacts = collectArtifacts(step?.result ?? step?.error);

              return (
                <div key={`${stepName}-${index}`} className="rounded border border-ide-border bg-ide-surface p-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>{stepName}</span>
                    <span className="text-ide-text-dim">{ok}</span>
                  </div>
                  {summary && (
                    <div className="mt-2 whitespace-pre-wrap text-ide-text">
                      {summary}
                    </div>
                  )}
                  {renderArtifactList(stepArtifacts, true)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>🛠️ OpenClaw</span>
        <span className="text-[10px] text-ide-text-dim">
          {isLoading ? 'Loading…' : `${inventory.tools.length} tools`}
        </span>
      </div>
      {showConfigWarning && (
        <div className="rounded bg-ide-surface px-2 py-1 text-xs text-ide-text-dim mb-2">
          OpenClaw base URL is not configured. Set it under Settings → OpenClaw.
        </div>
      )}

      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setView('runner')}
          className={`tab-btn flex-1 ${view === 'runner' ? 'active' : ''}`}
        >
          ⚙️ Tool Runner
        </button>
        <button
          onClick={() => setView('pipeline')}
          className={`tab-btn flex-1 ${view === 'pipeline' ? 'active' : ''}`}
        >
          🎬 Media Pipeline
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-xs">
        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-ide-text-dim">Gateway Config</span>
            <button onClick={() => void handleSaveConfig()} disabled={isSaving} className="action-btn text-xs">
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <input
            value={openClawConfig.baseUrl}
            onChange={(e) => setOpenClawConfig({ baseUrl: e.target.value })}
            className="input-field text-xs"
            placeholder="http://127.0.0.1:18789"
          />
          <input
            value={openClawConfig.toolEndpoint}
            onChange={(e) => setOpenClawConfig({ toolEndpoint: e.target.value })}
            className="input-field text-xs"
            placeholder="/api/tools/invoke"
          />
          <input
            value={openClawConfig.gatewayToken}
            onChange={(e) => setOpenClawConfig({ gatewayToken: e.target.value })}
            className="input-field text-xs"
            placeholder="Gateway token (optional)"
            type="password"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={openClawConfig.defaultProfile}
              onChange={(e) =>
                setOpenClawConfig({
                  defaultProfile: e.target.value as typeof openClawConfig.defaultProfile,
                })
              }
              className="input-field text-xs"
            >
              {inventory.profiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
            <select
              value={openClawConfig.webProvider}
              onChange={(e) =>
                setOpenClawConfig({
                  webProvider: e.target.value as typeof openClawConfig.webProvider,
                })
              }
              className="input-field text-xs"
            >
              {['brave', 'perplexity', 'gemini', 'grok', 'kimi'].map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ide-text">
            <input
              type="checkbox"
              checked={openClawConfig.loopDetectionEnabled}
              onChange={(e) => setOpenClawConfig({ loopDetectionEnabled: e.target.checked })}
            />
            Enable OpenClaw loop detection defaults
          </label>
          <div className="rounded bg-ide-surface px-2 py-1 text-[10px] text-ide-text-dim">
            {openClawConfig.baseUrl.trim()
              ? `Tool calls proxy to ${openClawConfig.baseUrl}${openClawConfig.toolEndpoint}`
              : 'Set a base URL before running tools.'}
          </div>
        </div>

        {view === 'runner' ? (
          <>
            <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
              <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Tool Runner</div>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="input-field text-xs"
              >
                {inventory.tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name} · {tool.category}
                  </option>
                ))}
              </select>
              <div className="rounded bg-ide-surface px-2 py-1 text-[10px] text-ide-text-dim">
                {toolSummary(selectedToolInfo)}
              </div>

              {selectedTool === 'browser' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={browserForm.action}
                      onChange={(e) => setBrowserForm((current) => ({ ...current, action: e.target.value }))}
                      className="input-field text-xs"
                    >
                      {['status', 'start', 'open', 'navigate', 'snapshot', 'screenshot', 'act'].map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                    <input
                      value={browserForm.profile}
                      onChange={(e) => setBrowserForm((current) => ({ ...current, profile: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Profile (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={browserForm.target}
                      onChange={(e) => setBrowserForm((current) => ({ ...current, target: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Target (sandbox/host/node)"
                    />
                    <input
                      value={browserForm.ref}
                      onChange={(e) => setBrowserForm((current) => ({ ...current, ref: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Ref"
                    />
                  </div>
                  {(browserForm.action === 'open' || browserForm.action === 'navigate') && (
                    <input
                      value={browserForm.url}
                      onChange={(e) => setBrowserForm((current) => ({ ...current, url: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="URL"
                    />
                  )}
                  {browserForm.action === 'act' && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={browserForm.act}
                        onChange={(e) => setBrowserForm((current) => ({ ...current, act: e.target.value }))}
                        className="input-field text-xs"
                      >
                        {['click', 'type', 'press', 'hover', 'drag', 'select', 'fill'].map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                      <input
                        value={browserForm.text}
                        onChange={(e) => setBrowserForm((current) => ({ ...current, text: e.target.value }))}
                        className="input-field text-xs"
                        placeholder="Text / value"
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedTool === 'canvas' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={canvasForm.action}
                      onChange={(e) => setCanvasForm((current) => ({ ...current, action: e.target.value }))}
                      className="input-field text-xs"
                    >
                      {['present', 'hide', 'navigate', 'eval', 'snapshot', 'a2ui_push'].map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                    <input
                      value={canvasForm.node}
                      onChange={(e) => setCanvasForm((current) => ({ ...current, node: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Node (optional)"
                    />
                  </div>
                  {canvasForm.action === 'navigate' && (
                    <input
                      value={canvasForm.url}
                      onChange={(e) => setCanvasForm((current) => ({ ...current, url: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="URL"
                    />
                  )}
                  {canvasForm.action === 'a2ui_push' && (
                    <textarea
                      value={canvasForm.text}
                      onChange={(e) => setCanvasForm((current) => ({ ...current, text: e.target.value }))}
                      rows={3}
                      className="input-field resize-none text-xs"
                      placeholder="A2UI text payload"
                    />
                  )}
                  {canvasForm.action === 'eval' && (
                    <textarea
                      value={canvasForm.code}
                      onChange={(e) => setCanvasForm((current) => ({ ...current, code: e.target.value }))}
                      rows={3}
                      className="input-field resize-none text-xs"
                      placeholder="JavaScript to evaluate"
                    />
                  )}
                </div>
              )}

              {selectedTool === 'nodes' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={nodesForm.action}
                      onChange={(e) => setNodesForm((current) => ({ ...current, action: e.target.value }))}
                      className="input-field text-xs"
                    >
                      {['status', 'describe', 'notify', 'run', 'camera_snap', 'screen_record'].map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                    <input
                      value={nodesForm.node}
                      onChange={(e) => setNodesForm((current) => ({ ...current, node: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Node id/name"
                    />
                  </div>
                  {nodesForm.action === 'notify' && (
                    <>
                      <input
                        value={nodesForm.title}
                        onChange={(e) => setNodesForm((current) => ({ ...current, title: e.target.value }))}
                        className="input-field text-xs"
                        placeholder="Notification title"
                      />
                      <textarea
                        value={nodesForm.text}
                        onChange={(e) => setNodesForm((current) => ({ ...current, text: e.target.value }))}
                        rows={3}
                        className="input-field resize-none text-xs"
                        placeholder="Notification text"
                      />
                    </>
                  )}
                  {nodesForm.action === 'run' && (
                    <input
                      value={nodesForm.command}
                      onChange={(e) => setNodesForm((current) => ({ ...current, command: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Command, e.g. echo hello"
                    />
                  )}
                </div>
              )}

              {selectedTool === 'message' && (
                <div className="space-y-2">
                  <select
                    value={messageForm.action}
                    onChange={(e) => setMessageForm((current) => ({ ...current, action: e.target.value }))}
                    className="input-field text-xs"
                  >
                    {['send', 'thread-create', 'search', 'pin', 'read'].map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={messageForm.channel}
                      onChange={(e) => setMessageForm((current) => ({ ...current, channel: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Channel / target"
                    />
                    <input
                      value={messageForm.thread}
                      onChange={(e) => setMessageForm((current) => ({ ...current, thread: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Thread (optional)"
                    />
                  </div>
                  <textarea
                    value={messageForm.text}
                    onChange={(e) => setMessageForm((current) => ({ ...current, text: e.target.value }))}
                    rows={3}
                    className="input-field resize-none text-xs"
                    placeholder="Message text"
                  />
                </div>
              )}

              {selectedTool === 'exec' && (
                <div className="space-y-2">
                  <textarea
                    value={execForm.command}
                    onChange={(e) => setExecForm((current) => ({ ...current, command: e.target.value }))}
                    rows={3}
                    className="input-field resize-none font-mono text-[11px]"
                    placeholder="npm test"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={execForm.yieldMs}
                      onChange={(e) => setExecForm((current) => ({ ...current, yieldMs: Number(e.target.value) || 0 }))}
                      className="input-field text-xs"
                      placeholder="yieldMs"
                    />
                    <input
                      type="number"
                      value={execForm.timeout}
                      onChange={(e) => setExecForm((current) => ({ ...current, timeout: Number(e.target.value) || 0 }))}
                      className="input-field text-xs"
                      placeholder="timeout"
                    />
                    <select
                      value={execForm.host}
                      onChange={(e) => setExecForm((current) => ({ ...current, host: e.target.value }))}
                      className="input-field text-xs"
                    >
                      <option value="sandbox">sandbox</option>
                      <option value="gateway">gateway</option>
                      <option value="node">node</option>
                    </select>
                  </div>
                  <div className="flex gap-3 text-[11px] text-ide-text">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={execForm.pty}
                        onChange={(e) => setExecForm((current) => ({ ...current, pty: e.target.checked }))}
                      />
                      pty
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={execForm.background}
                        onChange={(e) => setExecForm((current) => ({ ...current, background: e.target.checked }))}
                      />
                      background
                    </label>
                  </div>
                </div>
              )}

              {selectedTool === 'process' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={processForm.action}
                      onChange={(e) => setProcessForm((current) => ({ ...current, action: e.target.value }))}
                      className="input-field text-xs"
                    >
                      {['list', 'poll', 'log', 'write', 'kill', 'clear', 'remove'].map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                    <input
                      value={processForm.sessionId}
                      onChange={(e) => setProcessForm((current) => ({ ...current, sessionId: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Session id"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={processForm.limit}
                      onChange={(e) => setProcessForm((current) => ({ ...current, limit: Number(e.target.value) || 0 }))}
                      className="input-field text-xs"
                      placeholder="Limit"
                    />
                    <input
                      value={processForm.text}
                      onChange={(e) => setProcessForm((current) => ({ ...current, text: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Write text"
                    />
                  </div>
                </div>
              )}

              {selectedTool === 'web_search' && (
                <div className="space-y-2">
                  <input
                    value={webSearchForm.query}
                    onChange={(e) => setWebSearchForm((current) => ({ ...current, query: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="Search query"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={webSearchForm.count}
                      onChange={(e) => setWebSearchForm((current) => ({ ...current, count: Number(e.target.value) || 1 }))}
                      className="input-field text-xs"
                      placeholder="Count"
                    />
                    <input
                      value={webSearchForm.country}
                      onChange={(e) => setWebSearchForm((current) => ({ ...current, country: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="Country"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={webSearchForm.searchLang}
                      onChange={(e) => setWebSearchForm((current) => ({ ...current, searchLang: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="search_lang"
                    />
                    <input
                      value={webSearchForm.uiLang}
                      onChange={(e) => setWebSearchForm((current) => ({ ...current, uiLang: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="ui_lang"
                    />
                    <input
                      value={webSearchForm.freshness}
                      onChange={(e) => setWebSearchForm((current) => ({ ...current, freshness: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="freshness"
                    />
                  </div>
                </div>
              )}

              {selectedTool === 'web_fetch' && (
                <div className="space-y-2">
                  <input
                    value={webFetchForm.url}
                    onChange={(e) => setWebFetchForm((current) => ({ ...current, url: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="https://example.com"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={webFetchForm.extractMode}
                      onChange={(e) =>
                        setWebFetchForm((current) => ({
                          ...current,
                          extractMode: e.target.value as WebFetchForm['extractMode'],
                        }))
                      }
                      className="input-field text-xs"
                    >
                      <option value="markdown">markdown</option>
                      <option value="text">text</option>
                    </select>
                    <input
                      type="number"
                      value={webFetchForm.maxChars}
                      onChange={(e) => setWebFetchForm((current) => ({ ...current, maxChars: Number(e.target.value) || 0 }))}
                      className="input-field text-xs"
                      placeholder="maxChars"
                    />
                  </div>
                </div>
              )}

              {selectedTool === 'pdf' && (
                <div className="space-y-2">
                  <input
                    value={pdfForm.files}
                    onChange={(e) => setPdfForm((current) => ({ ...current, files: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="file1.pdf, file2.pdf"
                  />
                  <textarea
                    value={pdfForm.prompt}
                    onChange={(e) => setPdfForm((current) => ({ ...current, prompt: e.target.value }))}
                    rows={3}
                    className="input-field resize-none text-xs"
                    placeholder="Analysis prompt"
                  />
                </div>
              )}

              {selectedTool === 'image' && (
                <div className="space-y-2">
                  <input
                    value={imageForm.image}
                    onChange={(e) => setImageForm((current) => ({ ...current, image: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="/path/to/image.png or https://..."
                  />
                  <input
                    value={imageForm.model}
                    onChange={(e) => setImageForm((current) => ({ ...current, model: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="Model override (optional)"
                  />
                  <textarea
                    value={imageForm.prompt}
                    onChange={(e) => setImageForm((current) => ({ ...current, prompt: e.target.value }))}
                    rows={3}
                    className="input-field resize-none text-xs"
                    placeholder="Describe the image."
                  />
                </div>
              )}

              {!['browser', 'canvas', 'nodes', 'message', 'exec', 'process', 'web_search', 'web_fetch', 'pdf', 'image'].includes(selectedTool) && (
                <textarea
                  value={genericInput}
                  onChange={(e) => setGenericInput(e.target.value)}
                  rows={8}
                  className="input-field resize-none font-mono text-[11px]"
                  placeholder='{"query":"example"}'
                />
              )}

              <button onClick={() => void handleRunTool()} disabled={isRunning} className="action-btn w-full py-2 text-xs">
                {isRunning ? 'Running…' : `Run ${selectedTool}`}
              </button>
            </div>

            <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
              <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Profiles + Groups</div>
              <div className="text-[11px] text-ide-text-dim">Profiles: {inventory.profiles.join(', ') || 'none'}</div>
              <div className="text-[11px] break-words text-ide-text-dim">Groups: {inventory.groups.join(', ') || 'none'}</div>
            </div>
          </>
        ) : (
          <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Media Pipeline</div>
            <div className="rounded bg-ide-surface px-2 py-1 text-[10px] text-ide-text-dim">
              Capture with browser, render with canvas, notify with nodes, and distribute with message.
            </div>
            <input
              value={mediaForm.sourceUrl}
              onChange={(e) => setMediaForm((current) => ({ ...current, sourceUrl: e.target.value }))}
              className="input-field text-xs"
              placeholder="Source URL for browser capture"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={mediaForm.browserProfile}
                onChange={(e) => setMediaForm((current) => ({ ...current, browserProfile: e.target.value }))}
                className="input-field text-xs"
                placeholder="Browser profile"
              />
              <input
                value={mediaForm.browserRef}
                onChange={(e) => setMediaForm((current) => ({ ...current, browserRef: e.target.value }))}
                className="input-field text-xs"
                placeholder="Capture ref (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={mediaForm.canvasNode}
                onChange={(e) => setMediaForm((current) => ({ ...current, canvasNode: e.target.value }))}
                className="input-field text-xs"
                placeholder="Canvas node"
              />
              <input
                value={mediaForm.node}
                onChange={(e) => setMediaForm((current) => ({ ...current, node: e.target.value }))}
                className="input-field text-xs"
                placeholder="Node id/name"
              />
            </div>
            <textarea
              value={mediaForm.canvasText}
              onChange={(e) => setMediaForm((current) => ({ ...current, canvasText: e.target.value }))}
              rows={3}
              className="input-field resize-none text-xs"
              placeholder="Canvas A2UI text (optional; blank = snapshot only)"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={mediaForm.notifyTitle}
                onChange={(e) => setMediaForm((current) => ({ ...current, notifyTitle: e.target.value }))}
                className="input-field text-xs"
                placeholder="Node notification title"
              />
              <input
                value={mediaForm.notifyText}
                onChange={(e) => setMediaForm((current) => ({ ...current, notifyText: e.target.value }))}
                className="input-field text-xs"
                placeholder="Node notification text"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={mediaForm.messageChannel}
                onChange={(e) => setMediaForm((current) => ({ ...current, messageChannel: e.target.value }))}
                className="input-field text-xs"
                placeholder="Delivery channel"
              />
              <input
                value={mediaForm.messageText}
                onChange={(e) => setMediaForm((current) => ({ ...current, messageText: e.target.value }))}
                className="input-field text-xs"
                placeholder="Delivery text"
              />
            </div>
            <button
              onClick={() => void handleRunMediaPipeline()}
              disabled={isPipelineRunning}
              className="action-btn w-full py-2 text-xs"
            >
              {isPipelineRunning ? 'Running…' : 'Run Full Media Pipeline'}
            </button>
          </div>
        )}

        <div className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Result</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-ide-surface p-2 text-[10px] text-ide-text">
            {runOutput || 'No tool run yet.'}
          </pre>
        </div>

        {renderToolPreview()}
        {renderPipelinePreview()}

        {status && <div className="rounded border border-ide-border bg-ide-bg p-2 text-xs text-ide-text-dim">{status}</div>}
      </div>
    </div>
  );
}
