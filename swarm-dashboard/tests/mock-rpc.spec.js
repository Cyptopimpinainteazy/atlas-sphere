const { spawn } = require('child_process');
const http = require('http');

function postRpc(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 9944,
            path: '/rpc',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, res => {
            let buf = '';
            res.setEncoding('utf8');
            res.on('data', chunk => (buf += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(buf));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

describe('mock RPC server', () => {
    let proc;

    beforeAll(done => {
        proc = spawn('node', ['mock-rpc-server.js'], { cwd: __dirname + '/..', stdio: ['ignore', 'inherit', 'inherit'] });

        // wait for server to start
        const check = () => {
            http.get('http://localhost:9944/health', res => {
                if (res.statusCode === 200) return done();
                setTimeout(check, 100);
            }).on('error', () => setTimeout(check, 100));
        };
        check();
    }, 20000);

    afterAll(() => {
        if (proc) proc.kill();
    });

    test('returns ci_status', async () => {
        const resp = await postRpc({ method: 'ci_status', params: [], id: 1 });
        expect(resp.result).toHaveProperty('branch', 'feature/swarm-dashboard-e2e');
    });

    test('returns test_health', async () => {
        const resp = await postRpc({ method: 'test_health', params: [], id: 1 });
        expect(resp.result).toHaveProperty('atlas-evm-integration');
        expect(resp.result['atlas-evm-integration'].unit.total).toBeGreaterThan(0);
    });

    test('returns alerts and can create alert', async () => {
        const list = await postRpc({ method: 'alerts', params: [], id: 1 });
        expect(Array.isArray(list.result)).toBe(true);

        const newAlert = { level: 'warning', title: 'Automated Test Alert', message: 'created by test', link: null };
        const created = await postRpc({ method: 'create_alert', params: [newAlert], id: 2 });
        expect(created.result).toHaveProperty('id');
        expect(created.result.title).toBe(newAlert.title);

        const list2 = await postRpc({ method: 'alerts', params: [], id: 3 });
        const found = list2.result.find(a => a.id === created.result.id);
        expect(found).toBeDefined();
    });
});