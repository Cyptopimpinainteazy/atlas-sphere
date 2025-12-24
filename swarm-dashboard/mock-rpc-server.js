const express = require('express');
const cors = require('cors');
const mockData = require('./mock-rpc-data.json');

const app = express();
const PORT = 9944;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Mock RPC endpoint
app.post('/rpc', (req, res) => {
    const { method, params, id } = req.body;

    console.log(`📡 RPC Call: ${method}`, params);

    let result = null;
    let error = null;

    try {
        switch (method) {
            case 'media_status':
                result = mockData.media_status;
                break;
            case 'media_schedule':
                result = mockData.media_schedule;
                break;
            case 'media_contributors':
                result = mockData.media_contributors;
                break;
            case 'media_metrics':
                result = mockData.media_metrics;
                break;
            case 'media_jobs':
                result = mockData.media_jobs;
                break;
            case 'media_request_repurposing':
                // Simulate job submission
                const newJobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                result = { job_id: newJobId, jobId: newJobId };
                break;
            case 'media_job_status':
                const requestedJobId = params?.[0]?.job_id || params?.[0]?.jobId;
                const foundJob = mockData.media_jobs.find(j => j.jobId === requestedJobId);
                result = foundJob || null;
                break;
            case 'ci_status':
                result = mockData.ci_status;
                break;
            case 'test_health':
                result = mockData.test_health;
                break;
            case 'alerts':
                result = mockData.alerts;
                break;
            case 'create_alert':
                const newAlert = params?.[0] || {};
                const alertId = `alert-${Date.now()}`;
                const alertRecord = Object.assign({ id: alertId, created_at: new Date().toISOString() }, newAlert);
                mockData.alerts.push(alertRecord);
                result = alertRecord;
                break;
            default:
                error = {
                    code: -32601,
                    message: `Method ${method} not found`
                };
        }
    } catch (err) {
        error = {
            code: -32603,
            message: err.message
        };
    }

    const response = {
        jsonrpc: '2.0',
        id: id || 1,
        result,
        error
    };

    // Simulate some delay like a real RPC call
    setTimeout(() => {
        res.json(response);
    }, Math.random() * 200 + 100); // 100-300ms delay
});

// WebSocket simulation endpoint for real-time updates
app.get('/ws', (req, res) => {
    res.status(200).send('WebSocket endpoint - use WebSocket client to connect');
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        endpoints: [
            'media_status',
            'media_schedule',
            'media_contributors',
            'media_metrics',
            'media_jobs',
            'media_request_repurposing',
            'media_job_status'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Mock RPC Server running on http://localhost:${PORT}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   POST /rpc - JSON-RPC endpoint`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /ws - WebSocket simulation`);
    console.log(`\n📋 Supported methods:`);
    console.log(`   - media_status`);
    console.log(`   - media_schedule`);
    console.log(`   - media_contributors`);
    console.log(`   - media_metrics`);
    console.log(`   - media_jobs`);
    console.log(`   - media_request_repurposing`);
    console.log(`   - media_job_status`);
});