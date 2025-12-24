const React = require('react');
const { renderToString } = require('react-dom/server');

describe('dashboard components smoke tests', () => {
    beforeEach(() => {
        global.fetch = jest.fn((url) => {
            // Provide very small fixtures for the components
            if (typeof url === 'string' && url.endsWith('/api/alerts/sigill')) {
                return Promise.resolve({ json: () => Promise.resolve({ count: 1, alerts: [{ id: 'alert-001', title: 'SIGILL observed', message: 'sigill', artifacts: { strace: '/artifacts/alert-001/strace.tgz' } }] }) });
            }
            if (typeof url === 'string' && url.endsWith('/api/readiness/testnet')) {
                return Promise.resolve({ json: () => Promise.resolve({ score: 85, ci: { status: 'unknown' }, tests: { unit: { failed: 0 }, integration: { failed: 0 } }, node: { synced: true }, network: { peers: 12 } }) });
            }
            // Fallback for RPC POST calls
            return Promise.resolve({ json: () => Promise.resolve({ result: [] }) });
        });
    });

    afterEach(() => {
        global.fetch = undefined;
        jest.resetAllMocks();
    });

    test('AlertsPanel fetches SIGILL feed (render)', () => {
        const { AlertsPanel } = require('../src/components/AlertsPanel');
        const html = renderToString(React.createElement(AlertsPanel, { rpcUrl: 'http://localhost:9944' }));
        expect(global.fetch).toHaveBeenCalled();
        expect(html).toContain('Alerts');
    });

    test('TestnetReadinessTile renders score', () => {
        const { TestnetReadinessTile } = require('../src/components/TestnetReadinessTile');
        const html = renderToString(React.createElement(TestnetReadinessTile, { rpcUrl: 'http://localhost:9944' }));
        expect(global.fetch).toHaveBeenCalled();
        expect(html).toContain('Testnet Readiness');
    });
});