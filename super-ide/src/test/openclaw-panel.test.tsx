import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OpenClawPanel } from '../components/panels/OpenClawPanel';
import { useIDEStore } from '../store/ideStore';

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenClawPanel', () => {
  const runCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];

  beforeEach(() => {
    runCalls.length = 0;
    useIDEStore.setState({
      openClawConfig: {
        baseUrl: 'http://127.0.0.1:18789',
        toolEndpoint: '/api/tools/invoke',
        gatewayToken: '',
        defaultProfile: 'coding',
        webProvider: 'brave',
        loopDetectionEnabled: true,
      },
    });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes('/api/openclaw/config') && (!init?.method || init.method === 'GET')) {
        return jsonResponse({
          baseUrl: 'http://127.0.0.1:18789',
          toolEndpoint: '/api/tools/invoke',
          gatewayToken: '',
          defaultProfile: 'coding',
          webProvider: 'brave',
          loopDetectionEnabled: true,
        });
      }

      if (url.includes('/api/openclaw/tools')) {
        return jsonResponse({
          profiles: ['minimal', 'coding', 'messaging', 'full'],
          groups: ['group:ui', 'group:nodes', 'group:messaging'],
          tools: [
            {
              name: 'browser',
              category: 'ui',
              summary: 'Managed browser automation.',
              commonActions: ['status', 'open', 'screenshot'],
            },
            {
              name: 'canvas',
              category: 'ui',
              summary: 'Canvas rendering.',
              commonActions: ['present', 'snapshot', 'a2ui_push'],
            },
            {
              name: 'nodes',
              category: 'nodes',
              summary: 'Node device tools.',
              commonActions: ['status', 'notify'],
            },
            {
              name: 'message',
              category: 'messaging',
              summary: 'Cross-channel messaging.',
              commonActions: ['send', 'search'],
            },
          ],
        });
      }

      if (url.includes('/api/openclaw/run')) {
        const body = JSON.parse(String(init?.body || '{}')) as {
          tool: string;
          input: Record<string, unknown>;
        };
        runCalls.push(body);

        if (body.tool === 'browser') {
          return jsonResponse({
            ok: true,
            tool: 'browser',
            endpoint: 'http://127.0.0.1:18789/api/tools/invoke',
            result: {
              status: 'ready',
              url: String(body.input.url || 'https://example.com'),
              title: 'Example Page',
              text: 'Snapshot ready',
              tabs: [{ id: 1 }],
              artifact: 'MEDIA:/tmp/browser-capture.png',
            },
          });
        }

        if (body.tool === 'canvas') {
          return jsonResponse({
            ok: true,
            tool: 'canvas',
            endpoint: 'http://127.0.0.1:18789/api/tools/invoke',
            result: {
              action: String(body.input.action || 'snapshot'),
              node: String(body.input.node || 'studio-node'),
              text: 'Canvas frame ready',
              artifact: 'MEDIA:/tmp/canvas-frame.png',
            },
          });
        }

        if (body.tool === 'nodes') {
          return jsonResponse({
            ok: true,
            tool: 'nodes',
            endpoint: 'http://127.0.0.1:18789/api/tools/invoke',
            result: {
              status: 'sent',
              nodes: [{ id: 'desk-mac', name: 'Desk Mac' }],
              message: 'Notification queued',
              artifact: 'FILE:/tmp/node-clip.mp4',
            },
          });
        }

        if (body.tool === 'message') {
          return jsonResponse({
            ok: true,
            tool: 'message',
            endpoint: 'http://127.0.0.1:18789/api/tools/invoke',
            result: {
              status: 'sent',
              channel: String(body.input.channel || ''),
              thread: 'thread-1',
              text: String(body.input.text || ''),
            },
          });
        }

        return jsonResponse({
          ok: true,
          tool: body.tool,
          endpoint: 'http://127.0.0.1:18789/api/tools/invoke',
          result: {},
        });
      }

      return jsonResponse({});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('loads config and tool inventory', async () => {
    render(<OpenClawPanel />);

    await waitFor(() => {
      expect(screen.getByText('4 tools')).toBeInTheDocument();
    });

    expect(screen.getByText(/Managed browser automation/)).toBeInTheDocument();
    expect(screen.getByText(/Profiles: minimal, coding, messaging, full/)).toBeInTheDocument();
    expect(screen.getByText('Run browser')).toBeInTheDocument();
  });

  it('renders a typed browser preview with artifacts', async () => {
    render(<OpenClawPanel />);

    await waitFor(() => {
      expect(screen.getByText('Run browser')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run browser'));

    await waitFor(() => {
      expect(screen.getByTestId('openclaw-preview-browser')).toBeInTheDocument();
    });

    const preview = screen.getByTestId('openclaw-preview-browser');
    expect(within(preview).getByText(/Browser Status/)).toBeInTheDocument();
    expect(within(preview).getByText(/Example Page/)).toBeInTheDocument();
    expect(within(preview).getByText(/Snapshot ready/)).toBeInTheDocument();
    expect(within(preview).getByText(/tmp\/browser-capture\.png/)).toBeInTheDocument();
  });

  it('renders a typed message preview after send', async () => {
    render(<OpenClawPanel />);

    await waitFor(() => {
      expect(screen.getByText('Run browser')).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'message' } });
    fireEvent.change(screen.getByPlaceholderText('Channel / target'), {
      target: { value: 'slack://ops-alerts' },
    });
    fireEvent.change(screen.getByPlaceholderText('Message text'), {
      target: { value: 'Media pipeline delivered.' },
    });

    fireEvent.click(screen.getByText('Run message'));

    await waitFor(() => {
      expect(screen.getByTestId('openclaw-preview-message')).toBeInTheDocument();
    });

    const preview = screen.getByTestId('openclaw-preview-message');
    expect(within(preview).getByText(/Delivery Status/)).toBeInTheDocument();
    expect(within(preview).getByText(/slack:\/\/ops-alerts/)).toBeInTheDocument();
    expect(within(preview).getByText(/Media pipeline delivered\./)).toBeInTheDocument();
  });

  it('runs the full media pipeline and shows typed step previews', async () => {
    render(<OpenClawPanel />);

    await waitFor(() => {
      expect(screen.getByText('4 tools')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('🎬 Media Pipeline'));
    fireEvent.change(screen.getByPlaceholderText('Source URL for browser capture'), {
      target: { value: 'https://example.com/demo' },
    });
    fireEvent.change(screen.getByPlaceholderText('Canvas A2UI text (optional; blank = snapshot only)'), {
      target: { value: 'Render the status card' },
    });
    fireEvent.change(screen.getByPlaceholderText('Node notification title'), {
      target: { value: 'Capture finished' },
    });
    fireEvent.change(screen.getByPlaceholderText('Node notification text'), {
      target: { value: 'Frame and screenshot are ready.' },
    });
    fireEvent.change(screen.getByPlaceholderText('Delivery channel'), {
      target: { value: 'discord://team-room' },
    });
    fireEvent.change(screen.getByPlaceholderText('Delivery text'), {
      target: { value: 'Pipeline completed.' },
    });

    fireEvent.click(screen.getByText('Run Full Media Pipeline'));

    await waitFor(() => {
      expect(screen.getByTestId('openclaw-preview-pipeline')).toBeInTheDocument();
    });

    const preview = screen.getByTestId('openclaw-preview-pipeline');
    expect(within(preview).getByText('browser.open')).toBeInTheDocument();
    expect(within(preview).getByText('browser.screenshot')).toBeInTheDocument();
    expect(within(preview).getByText('canvas.a2ui_push')).toBeInTheDocument();
    expect(within(preview).getByText('nodes.notify')).toBeInTheDocument();
    expect(within(preview).getByText('message.send')).toBeInTheDocument();
    expect(within(preview).getAllByText(/tmp\/browser-capture\.png/).length).toBeGreaterThan(0);
    expect(within(preview).getByText(/tmp\/canvas-frame\.png/)).toBeInTheDocument();

    expect(runCalls.map((call) => call.tool)).toEqual([
      'browser',
      'browser',
      'canvas',
      'nodes',
      'message',
    ]);
  });

  it('warns and surfaces error when base URL is missing', async () => {
    // override initial store state
    useIDEStore.setState({
      openClawConfig: {
        baseUrl: '',
        toolEndpoint: '/api/tools/invoke',
        gatewayToken: '',
        defaultProfile: 'coding',
        webProvider: 'brave',
        loopDetectionEnabled: true,
      },
    });

    // simulate backend returning a 400 error on config fetch
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes('/api/openclaw/config')) {
        return new Response(
          JSON.stringify({ detail: 'OpenClaw base URL is not configured' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/openclaw/tools')) {
        return jsonResponse({ profiles: [], groups: [], tools: [] });
      }
      return jsonResponse({});
    });

    render(<OpenClawPanel />);

    await waitFor(() => {
      expect(screen.getByText(/base URL is not configured/i)).toBeInTheDocument();
    });
    // banner should be visible above the tabs with instructions to open Settings
    expect(screen.getByText(/Set it under Settings/i)).toBeInTheDocument();
  });
});
