const http = require('http');
const path = require('path');
const { probeMockPort, startMockServerWithRetry, startMockServer } = require('../e2e/test-helpers');

jest.setTimeout(20000);

describe('test-helpers', () => {
    test('probeMockPort returns true when server responds 200 and false when down', async () => {
        const server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true }));
            } else {
                res.statusCode = 404;
                res.end();
            }
        });

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;

        const ok = await probeMockPort(port, 500);
        expect(ok).toBe(true);

        await new Promise((resolve) => server.close(resolve));

        const notOk = await probeMockPort(port, 200);
        expect(notOk).toBe(false);
    });

    test('startMockServerWithRetry retries and succeeds', async () => {
        const repoRoot = path.resolve(__dirname, '..');

        // Spy on startMockServer and simulate failures then success
        const spy = jest.spyOn(module.require('../e2e/test-helpers'), 'startMockServer');
        let calls = 0;
        spy.mockImplementation(() => {
            calls += 1;
            if (calls < 3) return Promise.reject(new Error('start failed'));
            return Promise.resolve({ mockProc: { pid: 9999 }, rpcPort: 55000 });
        });

        const res = await startMockServerWithRetry(repoRoot, { retries: 3, baseDelay: 1 });
        expect(res).toHaveProperty('rpcPort', 55000);
        expect(spy).toHaveBeenCalledTimes(3);

        spy.mockRestore();
    });
});
