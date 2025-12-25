const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

async function waitFor(url, timeout = 10000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        (function check() {
            http.get(url, res => {
                if (res.statusCode === 200) return resolve();
                if (Date.now() - start > timeout) return reject(new Error('timeout waiting for ' + url));
                setTimeout(check, 200);
            }).on('error', () => {
                if (Date.now() - start > timeout) return reject(new Error('timeout waiting for ' + url));
                setTimeout(check, 200);
            });
        })();
    });
}

async function probeMockPort(port = 9944, timeout = 1000) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, res => { resolve(res.statusCode === 200); });
        req.on('error', () => resolve(false));
        req.setTimeout(timeout, () => { try { req.abort(); } catch (e) { } resolve(false); });
    });
}

function startMockServer(repoRoot, options = {}) {
    return new Promise((resolve, reject) => {
        const mockProc = spawn('node', ['mock-rpc-server.js'], {
            cwd: repoRoot,
            env: Object.assign({}, process.env, { PORT: '0' }),
            stdio: ['ignore', 'pipe', 'inherit']
        });

        const timeout = setTimeout(() => reject(new Error('mock rpc port timeout')), 5000);
        mockProc.stdout.on('data', (chunk) => {
            const s = chunk.toString();
            const m = s.match(/MOCK_RPC_PORT=(\d+)/);
            if (m) {
                clearTimeout(timeout);
                const rpcPort = Number(m[1]);
                waitFor(`http://127.0.0.1:${rpcPort}/health`, 10000)
                    .then(() => resolve({ mockProc, rpcPort }))
                    .catch(reject);
            }
        });

        mockProc.on('exit', (code) => {
            // If exit occurs before port discovery, reject
            // otherwise, let callers handle
            // ignore
        });
    });
}

async function startMockServerWithRetry(repoRoot, opts = {}) {
    const retries = typeof opts.retries === 'number' ? opts.retries : 3;
    const baseDelay = typeof opts.baseDelay === 'number' ? opts.baseDelay : 300;

    let lastErr = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await startMockServer(repoRoot, opts);
        } catch (err) {
            lastErr = err;
            if (attempt === retries - 1) break;
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

function startDemoServer(repoRoot, rpcPort) {
    return new Promise((resolve) => {
        const httpServer = require('http-server');
        const serveRoot = path.join(repoRoot, 'e2e', 'demo');
        const demoServer = httpServer.createServer({ root: serveRoot, cache: -1 });

        demoServer.listen(0, '127.0.0.1', () => {
            const addr = demoServer.server.address();
            const port = (addr && addr.port) || 3001;
            const demoUrl = `http://127.0.0.1:${port}/?rpc=http://127.0.0.1:${rpcPort}`;
            resolve({ demoServer, demoUrl });
        });
    });
}

async function startServers(repoRoot, opts = {}) {
    // If an external mock server is already running on 9944, reuse it (helps CI and concurrent runs).
    const wellKnownPort = opts.port || 9944;
    const existing = await probeMockPort(wellKnownPort, opts.probeTimeout || 1000);
    if (existing) {
        const rpcPort = wellKnownPort;
        const demo = await startDemoServer(repoRoot, rpcPort);
        return {
            mockProc: null,
            rpcPort,
            demoServer: demo.demoServer,
            demoUrl: demo.demoUrl,
            async stop() {
                try { if (demo.demoServer) demo.demoServer.close(); } catch (e) { }
                // do not kill external mock
            }
        };
    }

    const { mockProc, rpcPort } = await startMockServerWithRetry(repoRoot, opts);
    const { demoServer, demoUrl } = await startDemoServer(repoRoot, rpcPort);

    return {
        mockProc,
        rpcPort,
        demoServer,
        demoUrl,
        async stop() {
            try { if (demoServer) demoServer.close(); } catch (e) { /* ignore */ }
            try { if (mockProc) mockProc.kill(); } catch (e) { /* ignore */ }
        }
    };
}

module.exports = { startServers, waitFor };
