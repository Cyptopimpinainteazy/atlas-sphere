<<<<<<< REPO
<<<<<<< REPO
#!/usr/bin/env node
// Simple local queue stub for testing Lane 3 / Lane 4 endpoints
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;

const dbDir = path.resolve(process.cwd(), 'data', 'queue_db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// global logs directory
const LOG_DIR = path.resolve(process.cwd(), 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const QUEUE_FILE = path.join(dbDir, 'videos.json');
function readQueue() {
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

// Add a video to queue
app.post('/queue/videos', (req, res) => {
    const body = req.body;
    const q = readQueue();
    const id = body.id || `video_${Date.now()}`;
    const item = { id, path: body.path, thumb: body.thumb, metadata: body.metadata || {}, created: new Date().toISOString(), status: 'pending' };
    q.push(item);
    writeQueue(q);
    res.json({ ok: true, id });
});

// Return pending items
app.get('/queue/videos/pending', (req, res) => {
    const q = readQueue();
    const pending = q.filter(i => i.status === 'pending');
    res.json(pending);
});

// Mark done
app.post('/queue/videos/mark-done', (req, res) => {
    const { id } = req.body;
    const q = readQueue();
    const idx = q.findIndex(i => i.id === id);
    if (idx >= 0) { q[idx].status = 'done'; writeQueue(q); res.json({ ok: true, id }); }
    else res.status(404).json({ ok: false, error: 'not found' });
});

// Platform placeholders
app.post('/platforms/:platform/upload', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM UPLOAD', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, received: true });
});

app.post('/platforms/:platform/post', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM POST', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, posted: true });
});

// Funding endpoints used by Lane4
app.post('/grants/check', (req, res) => { res.json({ handled: false }); });
app.post('/verifier/verify', (req, res) => { res.json({ deliverable: true }); });
app.post('/notify/approval', (req, res) => { console.log('Approval notify', req.body); res.json({ ok: true }); });
// Simulate sending an interactive Slack message (placeholder for real Slack integration)
// Payload: { id }
app.post('/notify/slack', (req, res) => {
    const { id } = req.body || {};
    console.log('Slack notify', req.body);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // return a message URL the UI could link to
    const messageUrl = `/approvals/${id}`;
    return res.json({ ok: true, messageUrl, note: 'This is a simulated Slack message. Use /slack/action to simulate a button click.' });
});

// Simulate a Slack action callback (button press)
// Accepts { id, action: 'approve'|'reject', variantIndex }
app.post('/slack/action', (req, res) => {
    const { id, action, variantIndex } = req.body || {};
    if (!id || !action) return res.status(400).json({ ok: false, error: 'id & action required' });
    if (action !== 'approve') return res.json({ ok: true, action, result: 'ignored (only approve simulated)' });
    // call the internal webhook to simulate n8n receiving the Slack interaction
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => res.json({ ok: true, forwarded: true, result: r.data })).catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// Serve the approval UI static assets under /ui
app.use('/ui', express.static(path.join(process.cwd(), 'web', 'approval_ui')));
// Approvals UI: list pending funding_queue items and variants
app.get('/approvals', (req, res) => {
    try {
        const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
        if (!fs.existsSync(fd)) return res.json([]);
        const files = fs.readdirSync(fd).filter(f => f.endsWith('.json') && !f.endsWith('.pitch.json'));
        const out = files.map(f => {
            const base = path.join(fd, f);
            const id = f.replace(/\.json$/, '');
            const meta = JSON.parse(fs.readFileSync(base, 'utf8'));
            const pitchPath = path.join(fd, `${id}.pitch.json`);
            let pitches = null;
            if (fs.existsSync(pitchPath)) pitches = JSON.parse(fs.readFileSync(pitchPath, 'utf8'));
            return { id, meta, pitches };
        });
        res.json(out);
    } catch (e) { res.status(500).json({ error: e.message }) }
});

// Approvals UI page for a single id
app.get('/approvals/:id', (req, res) => {
    const id = req.params.id;
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).send('Not found');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitches = fs.existsSync(pitchFile) ? JSON.parse(fs.readFileSync(pitchFile, 'utf8')).variants : [];
    // render a tiny approval UI
    let html = `<html><head><title>Approve ${id}</title></head><body><h1>Approve: ${id}</h1><pre>${JSON.stringify(meta, null, 2)}</pre>`;
    // include suppression status server-side so tests and clients without JS can see it
    const suppressedList = loadSuppressed();
    const recipient = meta.contact || meta.email || null;
    if (recipient && suppressedList[recipient]) {
        html += `<p class='muted suppression'>Suppressed: ${suppressedList[recipient].reason || 'bounced'} — <form method='POST' action='/suppressions/un' style='display:inline'><input type='hidden' name='recipient' value='${recipient}'/><button type='submit'>Un-suppress</button></form></p>`;
    } else if (recipient) {
        html += `<p class='muted suppression'>Status: not suppressed</p>`;
    }
    if (!pitches || !pitches.length) html += `<p>No pitch variants generated yet.</p>`;
    pitches.forEach((p, idx) => {
        html += `<hr/><h3>Variant ${idx + 1}</h3><b>${p.subject || 'no subject'}</b><p>${(p.body || '').replace(/\n/g, '<br/>')}</p>`;
        html += `<form method='POST' action='/approvals/approve'><input type='hidden' name='id' value='${id}'/><input type='hidden' name='variantIndex' value='${idx}'/><button type='submit'>Approve & Send</button></form>`;
    });
    html += `</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Accept approval from the UI and route to webhook (n8n) for send
app.post('/approvals/approve', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const { id, variantIndex } = req.body || req.query || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // forward to webhook endpoint used by n8n workflow
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    // simulate POST to n8n webhook
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => {
        res.json({ ok: true, forwarded: true, result: r.data });
    }).catch(err => {
        res.status(500).json({ ok: false, error: err.message });
    });
});

// Simulated n8n webhook receiver for /webhook/funding/approve
app.post('/webhook/funding/approve', (req, res) => {
    const { id, variantIndex } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    pitch.sentVariant = Number(variantIndex || 0);
    fs.writeFileSync(pitchFile, JSON.stringify(pitch, null, 2));
    // log the send
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), variant: pitch.variants?.[Number(variantIndex || 0)] || null };
    fs.appendFileSync(path.join(logDir, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, id, sentVariant: pitch.sentVariant });
});

// Production send: send selected variant using configured SMTP senders (rotates senders if multiple provided)
app.post('/email/send', async (req, res) => {
    const { id, variantIndex = 0, to } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).json({ ok: false, error: 'meta not found' });
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    const variant = pitch.variants?.[Number(variantIndex || 0)];
    if (!variant) return res.status(400).json({ ok: false, error: 'variant not found' });

    const recipient = to || meta.contact || meta.email;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient not found' });

    // check suppression — do not reference variables that are defined later
    const suppressed = loadSuppressed();
    if (suppressed[recipient]) {
        const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
        const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sent: false, skipped: true, reason: 'suppressed' };
        fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
        return res.json({ ok: true, sent: false, skipped: true, reason: 'suppressed' });
    }

    // manage sender rotation
    const sendersEnv = process.env.SMTP_SENDERS || process.env.SMTP_FROM || '';
    const senders = sendersEnv.split(',').map(s => s.trim()).filter(Boolean);
    let sender = senders.length ? senders[0] : (process.env.SMTP_FROM || 'noreply@example.com');
    // persist index
    const stateFile = path.resolve(process.cwd(), 'data', 'email_state.json');
    let idx = 0;
    try { const st = JSON.parse(fs.readFileSync(stateFile, 'utf8') || '{}'); idx = st.index || 0 } catch (e) { idx = 0 }
    if (senders.length) { sender = senders[idx % senders.length]; idx = (idx + 1) % senders.length; fs.writeFileSync(stateFile, JSON.stringify({ index: idx })) }

    const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
    const entryBase = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sender };

    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const mailOptions = { from: sender, to: recipient, subject: variant.subject || `NovaFlux: ${id}`, text: variant.body || '' };
            const info = await transporter.sendMail(mailOptions);
            const entry = { ...entryBase, sent: true, info };
            fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
            // persist messageId mapping for bounce correlation
            const sentMapFile = path.resolve(process.cwd(), 'data', 'sent_map.json');
            let sentMap = {};
            try { sentMap = JSON.parse(fs.readFileSync(sentMapFile, 'utf8') || '{}') } catch (e) { sentMap = {} }
            sentMap[info.messageId] = { id, recipient, variantIndex: Number(variantIndex || 0), ts: new Date().toISOString(), sender };
            fs.writeFileSync(sentMapFile, JSON.stringify(sentMap, null, 2));
            return res.json({ ok: true, sent: true, info });
        } catch (err) { const entry = { ...entryBase, sent: false, error: err.message }; fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n'); return res.status(500).json({ ok: false, error: err.message }); }
    }

    // SMTP not configured: fallback to logging to test_emails.log and funding_sent.log
    const entry = { ...entryBase, sent: false, info: 'logged (no SMTP configured)' };
    fs.appendFileSync(path.join(logDir2, 'test_emails.log'), JSON.stringify(entry) + '\n');
    fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

// Suppression list helpers
const SUPPRESS_FILE = path.resolve(process.cwd(), 'data', 'suppressed.json');
function loadSuppressed() { try { return JSON.parse(fs.readFileSync(SUPPRESS_FILE, 'utf8') || '{}') } catch (e) { return {} } }
function saveSuppressed(obj) { fs.writeFileSync(SUPPRESS_FILE, JSON.stringify(obj, null, 2)) }

// Append a suppression audit entry (json line)
const exportProgress = {};
function appendSuppressionAudit(action, recipient, reason, source) {
    try {
        const entry = { ts: new Date().toISOString(), action, recipient, reason: reason || null, source: source || null };
        fs.appendFileSync(path.join(LOG_DIR, 'suppressions.log'), JSON.stringify(entry) + '\n');
    } catch (e) { /* ignore audit errors */ }
}

// Export progress helpers
function createExportEntry(total) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2));
    exportProgress[id] = { total: total || null, sent: 0, started: new Date().toISOString(), complete: false };
    return id;
}
function updateExportProgress(id, inc = 1) { if (!exportProgress[id]) exportProgress[id] = { total: null, sent: 0, started: new Date().toISOString(), complete: false }; exportProgress[id].sent += inc }
function finishExportProgress(id) { if (exportProgress[id]) { exportProgress[id].complete = true; exportProgress[id].finished = new Date().toISOString() } }

// Cleanup/retention for suppressions.log
const AUDIT_RETENTION_DAYS = Number(process.env.SUPPRESSION_AUDIT_RETENTION_DAYS || 90);
const AUDIT_MAX_ENTRIES = Number(process.env.SUPPRESSION_AUDIT_MAX_ENTRIES || 5000);
function cleanupSuppressionAudit() {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { removed: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        const parsed = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = AUDIT_RETENTION_DAYS > 0 ? (now - (AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)) : 0;
        let filtered = parsed.filter(p => { if (!p || !p.ts) return true; if (cutoff && (new Date(p.ts)).getTime() < cutoff) return false; return true });
        // limit to most recent AUDIT_MAX_ENTRIES
        if (AUDIT_MAX_ENTRIES && filtered.length > AUDIT_MAX_ENTRIES) filtered = filtered.slice(-AUDIT_MAX_ENTRIES);
        if (filtered.length === parsed.length) return { removed: 0 };
        // persist filtered back into file (oldest-first)
        const out = filtered.map(f => JSON.stringify(f)).join('\n') + '\n';
        fs.writeFileSync(logFile, out);
        return { removed: parsed.length - filtered.length };
    } catch (e) { return { removed: 0, error: e.message } }
}

// run initial cleanup at start and schedule daily pruning
try { cleanupSuppressionAudit(); } catch (e) { }
setInterval(() => { try { cleanupSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// Archive old audit entries (moves to archive file under logs/archives)
function archiveSuppressionAudit({ olderThanDays = AUDIT_RETENTION_DAYS } = {}) {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { moved: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = olderThanDays > 0 ? (now - (olderThanDays * 24 * 60 * 60 * 1000)) : 0;
        const toArchive = lines.filter(l => cutoff && (new Date(l.ts)).getTime() < cutoff);
        const keep = lines.filter(l => !(cutoff && (new Date(l.ts)).getTime() < cutoff));
        if (!toArchive.length) return { moved: 0 };
        const archiveDir = path.join(LOG_DIR, 'archives'); if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const fileName = `suppressions-${new Date().toISOString().slice(0, 10)}.jsonl`;
        const archivePath = path.join(archiveDir, fileName);
        // append archive entries to file
        const out = toArchive.map(t => JSON.stringify(t)).join('\n') + '\n';
        fs.appendFileSync(archivePath, out);

        // optionally compress
        try { const zlib = require('zlib'); const gzip = zlib.gzipSync(Buffer.from(out)); fs.appendFileSync(archivePath + '.gz', gzip); } catch (e) { }

        // replace log with kept entries
        fs.writeFileSync(logFile, keep.map(k => JSON.stringify(k)).join('\n') + '\n');

        // optionally upload to S3 if configured
        if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
            try {
                const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
                const body = fs.readFileSync(archivePath);
                const key = path.posix.join('suppression-archives', path.basename(archivePath));
                s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body }));
            } catch (e) { /* ignore S3 errors */ }
        }

        return { moved: toArchive.length, path: archivePath };
    } catch (e) { return { moved: 0, error: e.message } }
}

// schedule daily archive run as well
setInterval(() => { try { archiveSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// GET list of suppressed addresses
app.get('/suppressions', (req, res) => { const s = loadSuppressed(); res.json(s); });

// GET suppression audit log lines (most recent first) - optional ?limit=N
// paginated audit list as JSON. supports page & pageSize (1-based) and optional filters
app.get('/suppressions/audit', (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize || req.query.limit || 50)));
    const filterRecipient = req.query.recipient || null;
    const filterAction = req.query.action || null;
    const filterSource = req.query.source || null;

    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.json({ total: 0, page, pageSize, entries: [] });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    // entries oldest-first — make newest first
    let entries = lines.reverse();
    if (filterRecipient) entries = entries.filter(e => ('' + e.recipient || '').includes(filterRecipient));
    if (filterAction) entries = entries.filter(e => e.action === filterAction);
    if (filterSource) entries = entries.filter(e => e.source === filterSource);
    const total = entries.length;
    const start = (page - 1) * pageSize;
    const slice = entries.slice(start, start + pageSize);
    res.json({ total, page, pageSize, entries: slice });
});

// Get export progress by id
app.get('/suppressions/audit/progress', (req, res) => {
    const id = req.query.exportId || req.query.id || null;
    if (!id) return res.status(400).json({ ok: false, error: 'exportId required' });
    const p = exportProgress[id];
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json(Object.assign({ ok: true }, p));
});

// Manual cleanup trigger (useful for tests)
app.post('/suppressions/audit/cleanup', (req, res) => {
    const result = cleanupSuppressionAudit();
    res.json(Object.assign({ ok: true }, result));
});

// Trigger archive run via API. Accept { olderThanDays }
app.post('/suppressions/audit/archive', (req, res) => {
    const { olderThanDays } = req.body || {};
    const result = archiveSuppressionAudit({ olderThanDays: Number(olderThanDays || AUDIT_RETENTION_DAYS) });
    res.json(Object.assign({ ok: true }, result));
});

// Dedicated main app audit page (server-rendered) with filtering/sorting
app.get('/audit', (req, res) => {
    const { recipient, action, source, sort = 'ts', order = 'desc', limit = 200 } = req.query || {};
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    let entries = [];
    if (fs.existsSync(logFile)) {
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        entries = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    }
    // filter
    let out = entries.filter(e => { if (recipient && (!e.recipient || !('' + e.recipient).includes(recipient))) return false; if (action && e.action !== action) return false; if (source && e.source !== source) return false; return true });
    // sort
    out.sort((a, b) => {
        let av = a[sort] || '';
        let bv = b[sort] || '';
        if (sort === 'ts') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
        if (av < bv) return order === 'asc' ? -1 : 1; if (av > bv) return order === 'asc' ? 1 : -1; return 0;
    });
    out = out.slice(0, Number(limit || 200));
    // render simple HTML table
    let html = `<html><head><title>Audit</title><link rel="stylesheet" href="/ui/style.css"/></head><body><div id=app style="max-width:1100px;margin:18px auto;padding:12px"><header><h1>Suppression Audit</h1><div class="controls"><a href="/ui/" class="btn ghost">Approvals</a> <a href="/ui/audit.html" class="btn ghost">UI Audit</a> <a href="/suppressions/audit.csv" class="btn">Export CSV</a></div></header>`;
    html += `<form method="GET" action="/audit" style="margin:10px 0"><input name="recipient" placeholder="recipient" value="${recipient || ''}"/> <input name="action" placeholder="action" value="${action || ''}"/> <input name="source" placeholder="source" value="${source || ''}"/> <select name="sort"><option value="ts">time</option><option value="recipient">recipient</option><option value="action">action</option></select> <select name="order"><option value="desc">desc</option><option value="asc">asc</option></select> <button>Apply</button></form>`;
    html += `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>`;
    out.forEach(r => { html += `<tr><td>${r.ts}</td><td>${r.action}</td><td>${r.recipient}</td><td>${r.reason || ''}</td><td>${r.source || ''}</td></tr>` });
    html += `</tbody></table></div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Stream audit log as CSV (useful for large logs) - optional ?limit=N or ?since=ISO
app.get('/suppressions/audit.csv', (req, res) => {
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.status(404).send('no audit log');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suppressions_audit.csv"');

    const since = req.query.since ? new Date(req.query.since) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    // decide compression early and create appropriate writable stream
    const accept = (req.headers['accept-encoding'] || '').toLowerCase();
    const compressParam = (req.query.compress || '').toLowerCase();
    const useBrotli = (compressParam === 'br') || accept.includes('br');
    const useGzip = (!useBrotli && ((compressParam === 'true') || accept.includes('gzip')));
    let stream = res;
    if (useBrotli) {
        res.setHeader('Content-Encoding', 'br');
        const zlib = require('zlib');
        const br = zlib.createBrotliCompress();
        br.pipe(res);
        stream = br;
    } else if (useGzip) {
        res.setHeader('Content-Encoding', 'gzip');
        const zlib = require('zlib');
        const gz = zlib.createGzip();
        gz.pipe(res);
        stream = gz;
    }

    // count total lines to provide progress info
    const rawLines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const totalLines = rawLines.length;
    // expose total lines for progress metrics
    res.setHeader('X-Audit-Total', String(totalLines));
    const exportId = createExportEntry(totalLines);
    // expose export id for client
    res.setHeader('X-Export-Id', exportId);

    // create read stream from file so we stream lines
    const readStream = fs.createReadStream(logFile, { encoding: 'utf8' });
    const rl = require('readline').createInterface({ input: readStream });
    // write header
    stream.write('ts,action,recipient,reason,source\n');
    let count = 0;
    rl.on('line', (line) => {
        if (!line) return;
        try {
            const obj = JSON.parse(line);
            if (since && new Date(obj.ts) < since) return;
            const row = [obj.ts, obj.action, obj.recipient, (obj.reason || '').replace(/"/g, '""'), obj.source || ''].map(v => `"${('' + (v || '')).replace(/"/g, '""')}"`).join(',') + '\n';
            stream.write(row);
            updateExportProgress(exportId, 1);
            count++;
            if (limit && count >= limit) { rl.close(); readStream.destroy(); stream.end(); finishExportProgress(exportId); }
        } catch (e) { /* ignore malformed */ }
    });
    rl.on('close', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });
    rl.on('error', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });

    // (compression handled above)
});

// POST add suppression { recipient, reason }
app.post('/suppressions', (req, res) => {
    const { recipient, reason } = req.body || {};
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'manually suppressed', source: 'manual' };
    saveSuppressed(suppressed);
    appendSuppressionAudit('add', recipient, reason || 'manually suppressed', 'manual');
    res.json({ ok: true, suppressed: suppressed[recipient] });
});

// POST remove suppression via form-friendly endpoint { recipient }
app.post('/suppressions/un', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const recipient = (req.body && (req.body.recipient || req.body.email)) || null;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    if (!suppressed[recipient]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[recipient]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', recipient, null, 'manual');
    // if called from form submit, redirect back to approvals list
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return res.redirect('/approvals');
    return res.json({ ok: true });
});

// DELETE suppression
app.delete('/suppressions/:recipient', (req, res) => {
    const r = req.params.recipient;
    const suppressed = loadSuppressed();
    if (!suppressed[r]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[r]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', r, null, 'manual');
    res.json({ ok: true });
});

// Bounce callback from provider; stores bounces into data/bounces.json
app.post('/email/bounce', (req, res) => {
    const { messageId, recipient, reason } = req.body || {};
    if (!messageId || !recipient) return res.status(400).json({ ok: false, error: 'messageId and recipient required' });
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    let bounces = {};
    try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
    bounces[recipient] = { ts: new Date().toISOString(), messageId, reason: reason || null };
    fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
    // also write to logs
    const logDir3 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir3)) fs.mkdirSync(logDir3, { recursive: true });
    fs.appendFileSync(path.join(logDir3, 'bounces.log'), JSON.stringify({ ts: new Date().toISOString(), messageId, recipient, reason: reason || null }) + '\n');
    res.json({ ok: true });
});

// SendGrid Events Webhook
app.post('/webhook/sendgrid/events', bodyParser.raw({ type: '*/*' }), (req, res) => {
    let rawBody = '';
    if (Buffer.isBuffer(req.body)) rawBody = req.body.toString();
    else if (typeof req.body === 'string') rawBody = req.body;
    else rawBody = JSON.stringify(req.body || '');
    const sig = req.get('X-Twilio-Email-Event-Webhook-Signature') || req.get('x-twilio-email-event-webhook-signature');
    const ts = req.get('X-Twilio-Email-Event-Webhook-Timestamp') || req.get('x-twilio-email-event-webhook-timestamp');
    const pub = process.env.SENDGRID_PUBLIC_KEY || '';
    if (pub) {
        if (!sig || !ts) return res.status(400).json({ ok: false, error: 'signature required' });
        const payload = ts + rawBody;
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(payload);
            verify.end();
            const ok = verify.verify(pub, sig, 'base64');
            if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });
        } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    }
    // parse events — SendGrid typically sends array of event objects
    let events = [];
    try { events = JSON.parse(rawBody); } catch (e) { try { events = [req.body]; } catch (e) { } }
    // process bounces and delivery events
    for (const ev of events) {
        const t = (ev.event || ev.type || '').toLowerCase();
        if (t.includes('bounce') || t === 'dropped' || t === 'dropped_soft' || t === 'dropped_hard') {
            // map fields — SendGrid has 'smtp-id' and 'email' or 'sg_message_id'
            const messageId = ev.sg_message_id || ev['sg_message_id'] || ev['smtp-id'] || ev.messageId || null;
            const recipient = ev.email || ev.recipient || ev.to || null;
            const reason = ev.reason || ev['response'] || ev.type || t;
            if (recipient && messageId) {
                const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
                let bounces = {};
                try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
                bounces[recipient] = { ts: new Date().toISOString(), provider: 'sendgrid', messageId, reason };
                fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
                // auto-suppress recipient on hard bounce events
                try {
                    const suppressed = loadSuppressed();
                    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'sendgrid bounce', source: 'sendgrid' };
                    saveSuppressed(suppressed);
                    appendSuppressionAudit('add', recipient, reason || 'sendgrid bounce', 'sendgrid');
                } catch (e) { /* ignore */ }
            }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), rawBody + '\n');
    res.json({ ok: true, received: events.length || 1 });
});

// Postmark events webhook (simple token verification)
app.post('/webhook/postmark/events', (req, res) => {
    // Postmark sends json body; you can verify via your webhook token if set
    const token = process.env.POSTMARK_WEBHOOK_TOKEN;
    if (token) { const header = req.get('X-Postmark-Signature') || req.get('x-postmark-signature') || req.get('X-Postmark-Webhook-Token'); if (!header || header !== token) return res.status(401).json({ ok: false, error: 'invalid token' }); }
    const ev = req.body;
    // example mapping — Postmark uses RecordType fields like 'Delivery' and 'Bounce'
    const recordType = (ev.RecordType || ev.recordType || '').toLowerCase();
    if (recordType.includes('bounce')) {
        const recipient = ev.EmailAddress || ev.Recipient || ev.recipient;
        const messageId = ev.MessageID || ev.messageID || ev.messageId;
        const reason = ev.BounceDescription || ev.bounce_description || ev.Description || ev.description || 'bounce';
        if (recipient) {
            const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
            let bounces = {};
            try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
            bounces[recipient] = { ts: new Date().toISOString(), provider: 'postmark', messageId, reason };
            fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
            // auto-suppress postmark bounce recipients
            try {
                const suppressed = loadSuppressed();
                suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'postmark bounce', source: 'postmark' };
                saveSuppressed(suppressed);
                appendSuppressionAudit('add', recipient, reason || 'postmark bounce', 'postmark');
            } catch (e) { /* ignore */ }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), JSON.stringify(req.body) + '\n');
    return res.json({ ok: true });
});

app.get('/email/bounces', (req, res) => {
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    try { const b = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}'); return res.json(b) } catch (e) { return res.json({}) }
});

// Send test email for a variant (if SMTP env set, attempt send, otherwise write to test_emails.log)
app.post('/email/send-test', async (req, res) => {
    const { to, subject, body } = req.body || {};
    if (!to || !subject || !body) return res.status(400).json({ ok: false, error: 'to, subject and body required' });
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), to, subject, body };
    // If SMTP configured via env, try to send
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const info = await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@example.com', to, subject, text: body });
            entry.sent = true; entry.info = info;
            fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.json({ ok: true, sent: true, info });
        } catch (err) {
            entry.sent = false; entry.error = err.message; fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.status(500).json({ ok: false, error: err.message });
        }
    }
    // not configured — write log and return
    fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

app.listen(PORT, () => console.log(`Queue stub running on http://localhost:${PORT}`));

=======
#!/usr/bin/env node
// Simple local queue stub for testing Lane 3 / Lane 4 endpoints
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;

const dbDir = path.resolve(process.cwd(), 'data', 'queue_db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// global logs directory
const LOG_DIR = path.resolve(process.cwd(), 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const QUEUE_FILE = path.join(dbDir, 'videos.json');
function readQueue() {
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

// Add a video to queue
app.post('/queue/videos', (req, res) => {
    const body = req.body;
    const q = readQueue();
    const id = body.id || `video_${Date.now()}`;
    const item = { id, path: body.path, thumb: body.thumb, metadata: body.metadata || {}, created: new Date().toISOString(), status: 'pending' };
    q.push(item);
    writeQueue(q);
    res.json({ ok: true, id });
});

// Return pending items
app.get('/queue/videos/pending', (req, res) => {
    const q = readQueue();
    const pending = q.filter(i => i.status === 'pending');
    res.json(pending);
});

// Mark done
app.post('/queue/videos/mark-done', (req, res) => {
    const { id } = req.body;
    const q = readQueue();
    const idx = q.findIndex(i => i.id === id);
    if (idx >= 0) { q[idx].status = 'done'; writeQueue(q); res.json({ ok: true, id }); }
    else res.status(404).json({ ok: false, error: 'not found' });
});

// Platform placeholders
app.post('/platforms/:platform/upload', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM UPLOAD', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, received: true });
});

app.post('/platforms/:platform/post', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM POST', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, posted: true });
});

// Funding endpoints used by Lane4
app.post('/grants/check', (req, res) => { res.json({ handled: false }); });
app.post('/verifier/verify', (req, res) => { res.json({ deliverable: true }); });
app.post('/notify/approval', (req, res) => { console.log('Approval notify', req.body); res.json({ ok: true }); });
// Simulate sending an interactive Slack message (placeholder for real Slack integration)
// Payload: { id }
app.post('/notify/slack', (req, res) => {
    const { id } = req.body || {};
    console.log('Slack notify', req.body);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // return a message URL the UI could link to
    const messageUrl = `/approvals/${id}`;
    return res.json({ ok: true, messageUrl, note: 'This is a simulated Slack message. Use /slack/action to simulate a button click.' });
});

// Simulate a Slack action callback (button press)
// Accepts { id, action: 'approve'|'reject', variantIndex }
app.post('/slack/action', (req, res) => {
    const { id, action, variantIndex } = req.body || {};
    if (!id || !action) return res.status(400).json({ ok: false, error: 'id & action required' });
    if (action !== 'approve') return res.json({ ok: true, action, result: 'ignored (only approve simulated)' });
    // call the internal webhook to simulate n8n receiving the Slack interaction
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => res.json({ ok: true, forwarded: true, result: r.data })).catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// Serve the approval UI static assets under /ui
app.use('/ui', express.static(path.join(process.cwd(), 'web', 'approval_ui')));
// Approvals UI: list pending funding_queue items and variants
app.get('/approvals', (req, res) => {
    try {
        const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
        if (!fs.existsSync(fd)) return res.json([]);
        const files = fs.readdirSync(fd).filter(f => f.endsWith('.json') && !f.endsWith('.pitch.json'));
        const out = files.map(f => {
            const base = path.join(fd, f);
            const id = f.replace(/\.json$/, '');
            const meta = JSON.parse(fs.readFileSync(base, 'utf8'));
            const pitchPath = path.join(fd, `${id}.pitch.json`);
            let pitches = null;
            if (fs.existsSync(pitchPath)) pitches = JSON.parse(fs.readFileSync(pitchPath, 'utf8'));
            return { id, meta, pitches };
        });
        res.json(out);
    } catch (e) { res.status(500).json({ error: e.message }) }
});

// Approvals UI page for a single id
app.get('/approvals/:id', (req, res) => {
    const id = req.params.id;
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).send('Not found');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitches = fs.existsSync(pitchFile) ? JSON.parse(fs.readFileSync(pitchFile, 'utf8')).variants : [];
    // render a tiny approval UI
    let html = `<html><head><title>Approve ${id}</title></head><body><h1>Approve: ${id}</h1><pre>${JSON.stringify(meta, null, 2)}</pre>`;
    // include suppression status server-side so tests and clients without JS can see it
    const suppressedList = loadSuppressed();
    const recipient = meta.contact || meta.email || null;
    if (recipient && suppressedList[recipient]) {
        html += `<p class='muted suppression'>Suppressed: ${suppressedList[recipient].reason || 'bounced'} — <form method='POST' action='/suppressions/un' style='display:inline'><input type='hidden' name='recipient' value='${recipient}'/><button type='submit'>Un-suppress</button></form></p>`;
    } else if (recipient) {
        html += `<p class='muted suppression'>Status: not suppressed</p>`;
    }
    if (!pitches || !pitches.length) html += `<p>No pitch variants generated yet.</p>`;
    pitches.forEach((p, idx) => {
        html += `<hr/><h3>Variant ${idx + 1}</h3><b>${p.subject || 'no subject'}</b><p>${(p.body || '').replace(/\n/g, '<br/>')}</p>`;
        html += `<form method='POST' action='/approvals/approve'><input type='hidden' name='id' value='${id}'/><input type='hidden' name='variantIndex' value='${idx}'/><button type='submit'>Approve & Send</button></form>`;
    });
    html += `</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Accept approval from the UI and route to webhook (n8n) for send
app.post('/approvals/approve', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const { id, variantIndex } = req.body || req.query || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // forward to webhook endpoint used by n8n workflow
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    // simulate POST to n8n webhook
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => {
        res.json({ ok: true, forwarded: true, result: r.data });
    }).catch(err => {
        res.status(500).json({ ok: false, error: err.message });
    });
});

// Simulated n8n webhook receiver for /webhook/funding/approve
app.post('/webhook/funding/approve', (req, res) => {
    const { id, variantIndex } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    pitch.sentVariant = Number(variantIndex || 0);
    fs.writeFileSync(pitchFile, JSON.stringify(pitch, null, 2));
    // log the send
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), variant: pitch.variants?.[Number(variantIndex || 0)] || null };
    fs.appendFileSync(path.join(logDir, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, id, sentVariant: pitch.sentVariant });
});

// Production send: send selected variant using configured SMTP senders (rotates senders if multiple provided)
app.post('/email/send', async (req, res) => {
    const { id, variantIndex = 0, to } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).json({ ok: false, error: 'meta not found' });
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    const variant = pitch.variants?.[Number(variantIndex || 0)];
    if (!variant) return res.status(400).json({ ok: false, error: 'variant not found' });

    const recipient = to || meta.contact || meta.email;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient not found' });

    // check suppression — do not reference variables that are defined later
    const suppressed = loadSuppressed();
    if (suppressed[recipient]) {
        const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
        const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sent: false, skipped: true, reason: 'suppressed' };
        fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
        return res.json({ ok: true, sent: false, skipped: true, reason: 'suppressed' });
    }

    // manage sender rotation
    const sendersEnv = process.env.SMTP_SENDERS || process.env.SMTP_FROM || '';
    const senders = sendersEnv.split(',').map(s => s.trim()).filter(Boolean);
    let sender = senders.length ? senders[0] : (process.env.SMTP_FROM || 'noreply@example.com');
    // persist index
    const stateFile = path.resolve(process.cwd(), 'data', 'email_state.json');
    let idx = 0;
    try { const st = JSON.parse(fs.readFileSync(stateFile, 'utf8') || '{}'); idx = st.index || 0 } catch (e) { idx = 0 }
    if (senders.length) { sender = senders[idx % senders.length]; idx = (idx + 1) % senders.length; fs.writeFileSync(stateFile, JSON.stringify({ index: idx })) }

    const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
    const entryBase = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sender };

    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const mailOptions = { from: sender, to: recipient, subject: variant.subject || `NovaFlux: ${id}`, text: variant.body || '' };
            const info = await transporter.sendMail(mailOptions);
            const entry = { ...entryBase, sent: true, info };
            fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
            // persist messageId mapping for bounce correlation
            const sentMapFile = path.resolve(process.cwd(), 'data', 'sent_map.json');
            let sentMap = {};
            try { sentMap = JSON.parse(fs.readFileSync(sentMapFile, 'utf8') || '{}') } catch (e) { sentMap = {} }
            sentMap[info.messageId] = { id, recipient, variantIndex: Number(variantIndex || 0), ts: new Date().toISOString(), sender };
            fs.writeFileSync(sentMapFile, JSON.stringify(sentMap, null, 2));
            return res.json({ ok: true, sent: true, info });
        } catch (err) { const entry = { ...entryBase, sent: false, error: err.message }; fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n'); return res.status(500).json({ ok: false, error: err.message }); }
    }

    // SMTP not configured: fallback to logging to test_emails.log and funding_sent.log
    const entry = { ...entryBase, sent: false, info: 'logged (no SMTP configured)' };
    fs.appendFileSync(path.join(logDir2, 'test_emails.log'), JSON.stringify(entry) + '\n');
    fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

// Suppression list helpers
const SUPPRESS_FILE = path.resolve(process.cwd(), 'data', 'suppressed.json');
function loadSuppressed() { try { return JSON.parse(fs.readFileSync(SUPPRESS_FILE, 'utf8') || '{}') } catch (e) { return {} } }
function saveSuppressed(obj) { fs.writeFileSync(SUPPRESS_FILE, JSON.stringify(obj, null, 2)) }

// Append a suppression audit entry (json line)
const exportProgress = {};
function appendSuppressionAudit(action, recipient, reason, source) {
    try {
        const entry = { ts: new Date().toISOString(), action, recipient, reason: reason || null, source: source || null };
        fs.appendFileSync(path.join(LOG_DIR, 'suppressions.log'), JSON.stringify(entry) + '\n');
    } catch (e) { /* ignore audit errors */ }
}

// Export progress helpers
function createExportEntry(total) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2));
    exportProgress[id] = { total: total || null, sent: 0, started: new Date().toISOString(), complete: false };
    return id;
}
function updateExportProgress(id, inc = 1) { if (!exportProgress[id]) exportProgress[id] = { total: null, sent: 0, started: new Date().toISOString(), complete: false }; exportProgress[id].sent += inc }
function finishExportProgress(id) { if (exportProgress[id]) { exportProgress[id].complete = true; exportProgress[id].finished = new Date().toISOString() } }

// Cleanup/retention for suppressions.log
const AUDIT_RETENTION_DAYS = Number(process.env.SUPPRESSION_AUDIT_RETENTION_DAYS || 90);
const AUDIT_MAX_ENTRIES = Number(process.env.SUPPRESSION_AUDIT_MAX_ENTRIES || 5000);
function cleanupSuppressionAudit() {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { removed: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        const parsed = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = AUDIT_RETENTION_DAYS > 0 ? (now - (AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)) : 0;
        let filtered = parsed.filter(p => { if (!p || !p.ts) return true; if (cutoff && (new Date(p.ts)).getTime() < cutoff) return false; return true });
        // limit to most recent AUDIT_MAX_ENTRIES
        if (AUDIT_MAX_ENTRIES && filtered.length > AUDIT_MAX_ENTRIES) filtered = filtered.slice(-AUDIT_MAX_ENTRIES);
        if (filtered.length === parsed.length) return { removed: 0 };
        // persist filtered back into file (oldest-first)
        const out = filtered.map(f => JSON.stringify(f)).join('\n') + '\n';
        fs.writeFileSync(logFile, out);
        return { removed: parsed.length - filtered.length };
    } catch (e) { return { removed: 0, error: e.message } }
}

// run initial cleanup at start and schedule daily pruning
try { cleanupSuppressionAudit(); } catch (e) { }
setInterval(() => { try { cleanupSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// Archive old audit entries (moves to archive file under logs/archives)
function archiveSuppressionAudit({ olderThanDays = AUDIT_RETENTION_DAYS } = {}) {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { moved: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = olderThanDays > 0 ? (now - (olderThanDays * 24 * 60 * 60 * 1000)) : 0;
        const toArchive = lines.filter(l => cutoff && (new Date(l.ts)).getTime() < cutoff);
        const keep = lines.filter(l => !(cutoff && (new Date(l.ts)).getTime() < cutoff));
        if (!toArchive.length) return { moved: 0 };
        const archiveDir = path.join(LOG_DIR, 'archives'); if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const fileName = `suppressions-${new Date().toISOString().slice(0, 10)}.jsonl`;
        const archivePath = path.join(archiveDir, fileName);
        // append archive entries to file
        const out = toArchive.map(t => JSON.stringify(t)).join('\n') + '\n';
        fs.appendFileSync(archivePath, out);

        // optionally compress
        try { const zlib = require('zlib'); const gzip = zlib.gzipSync(Buffer.from(out)); fs.appendFileSync(archivePath + '.gz', gzip); } catch (e) { }

        // replace log with kept entries
        fs.writeFileSync(logFile, keep.map(k => JSON.stringify(k)).join('\n') + '\n');

        // optionally upload to S3 if configured
        if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
            try {
                const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
                const body = fs.readFileSync(archivePath);
                const key = path.posix.join('suppression-archives', path.basename(archivePath));
                s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body }));
            } catch (e) { /* ignore S3 errors */ }
        }

        return { moved: toArchive.length, path: archivePath };
    } catch (e) { return { moved: 0, error: e.message } }
}

// schedule daily archive run as well
setInterval(() => { try { archiveSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// GET list of suppressed addresses
app.get('/suppressions', (req, res) => { const s = loadSuppressed(); res.json(s); });

// GET suppression audit log lines (most recent first) - optional ?limit=N
// paginated audit list as JSON. supports page & pageSize (1-based) and optional filters
app.get('/suppressions/audit', (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize || req.query.limit || 50)));
    const filterRecipient = req.query.recipient || null;
    const filterAction = req.query.action || null;
    const filterSource = req.query.source || null;

    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.json({ total: 0, page, pageSize, entries: [] });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    // entries oldest-first — make newest first
    let entries = lines.reverse();
    if (filterRecipient) entries = entries.filter(e => ('' + e.recipient || '').includes(filterRecipient));
    if (filterAction) entries = entries.filter(e => e.action === filterAction);
    if (filterSource) entries = entries.filter(e => e.source === filterSource);
    const total = entries.length;
    const start = (page - 1) * pageSize;
    const slice = entries.slice(start, start + pageSize);
    res.json({ total, page, pageSize, entries: slice });
});

// Get export progress by id
app.get('/suppressions/audit/progress', (req, res) => {
    const id = req.query.exportId || req.query.id || null;
    if (!id) return res.status(400).json({ ok: false, error: 'exportId required' });
    const p = exportProgress[id];
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json(Object.assign({ ok: true }, p));
});

// Manual cleanup trigger (useful for tests)
app.post('/suppressions/audit/cleanup', (req, res) => {
    const result = cleanupSuppressionAudit();
    res.json(Object.assign({ ok: true }, result));
});

// Trigger archive run via API. Accept { olderThanDays }
app.post('/suppressions/audit/archive', (req, res) => {
    const { olderThanDays } = req.body || {};
    const result = archiveSuppressionAudit({ olderThanDays: Number(olderThanDays || AUDIT_RETENTION_DAYS) });
    res.json(Object.assign({ ok: true }, result));
});

// Dedicated main app audit page (server-rendered) with filtering/sorting
app.get('/audit', (req, res) => {
    const { recipient, action, source, sort = 'ts', order = 'desc', limit = 200 } = req.query || {};
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    let entries = [];
    if (fs.existsSync(logFile)) {
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        entries = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    }
    // filter
    let out = entries.filter(e => { if (recipient && (!e.recipient || !('' + e.recipient).includes(recipient))) return false; if (action && e.action !== action) return false; if (source && e.source !== source) return false; return true });
    // sort
    out.sort((a, b) => {
        let av = a[sort] || '';
        let bv = b[sort] || '';
        if (sort === 'ts') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
        if (av < bv) return order === 'asc' ? -1 : 1; if (av > bv) return order === 'asc' ? 1 : -1; return 0;
    });
    out = out.slice(0, Number(limit || 200));
    // render simple HTML table
    let html = `<html><head><title>Audit</title><link rel="stylesheet" href="/ui/style.css"/></head><body><div id=app style="max-width:1100px;margin:18px auto;padding:12px"><header><h1>Suppression Audit</h1><div class="controls"><a href="/ui/" class="btn ghost">Approvals</a> <a href="/ui/audit.html" class="btn ghost">UI Audit</a> <a href="/suppressions/audit.csv" class="btn">Export CSV</a></div></header>`;
    html += `<form method="GET" action="/audit" style="margin:10px 0"><input name="recipient" placeholder="recipient" value="${recipient || ''}"/> <input name="action" placeholder="action" value="${action || ''}"/> <input name="source" placeholder="source" value="${source || ''}"/> <select name="sort"><option value="ts">time</option><option value="recipient">recipient</option><option value="action">action</option></select> <select name="order"><option value="desc">desc</option><option value="asc">asc</option></select> <button>Apply</button></form>`;
    html += `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>`;
    out.forEach(r => { html += `<tr><td>${r.ts}</td><td>${r.action}</td><td>${r.recipient}</td><td>${r.reason || ''}</td><td>${r.source || ''}</td></tr>` });
    html += `</tbody></table></div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Stream audit log as CSV (useful for large logs) - optional ?limit=N or ?since=ISO
app.get('/suppressions/audit.csv', (req, res) => {
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.status(404).send('no audit log');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suppressions_audit.csv"');

    const since = req.query.since ? new Date(req.query.since) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    // decide compression early and create appropriate writable stream
    const accept = (req.headers['accept-encoding'] || '').toLowerCase();
    const compressParam = (req.query.compress || '').toLowerCase();
    const useBrotli = (compressParam === 'br') || accept.includes('br');
    const useGzip = (!useBrotli && ((compressParam === 'true') || accept.includes('gzip')));
    let stream = res;
    if (useBrotli) {
        res.setHeader('Content-Encoding', 'br');
        const zlib = require('zlib');
        const br = zlib.createBrotliCompress();
        br.pipe(res);
        stream = br;
    } else if (useGzip) {
        res.setHeader('Content-Encoding', 'gzip');
        const zlib = require('zlib');
        const gz = zlib.createGzip();
        gz.pipe(res);
        stream = gz;
    }

    // count total lines to provide progress info
    const rawLines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const totalLines = rawLines.length;
    // expose total lines for progress metrics
    res.setHeader('X-Audit-Total', String(totalLines));
    const exportId = createExportEntry(totalLines);
    // expose export id for client
    res.setHeader('X-Export-Id', exportId);

    // create read stream from file so we stream lines
    const readStream = fs.createReadStream(logFile, { encoding: 'utf8' });
    const rl = require('readline').createInterface({ input: readStream });
    // write header
    stream.write('ts,action,recipient,reason,source\n');
    let count = 0;
    rl.on('line', (line) => {
        if (!line) return;
        try {
            const obj = JSON.parse(line);
            if (since && new Date(obj.ts) < since) return;
            const row = [obj.ts, obj.action, obj.recipient, (obj.reason || '').replace(/"/g, '""'), obj.source || ''].map(v => `"${('' + (v || '')).replace(/"/g, '""')}"`).join(',') + '\n';
            stream.write(row);
            updateExportProgress(exportId, 1);
            count++;
            if (limit && count >= limit) { rl.close(); readStream.destroy(); stream.end(); finishExportProgress(exportId); }
        } catch (e) { /* ignore malformed */ }
    });
    rl.on('close', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });
    rl.on('error', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });

    // (compression handled above)
});

// POST add suppression { recipient, reason }
app.post('/suppressions', (req, res) => {
    const { recipient, reason } = req.body || {};
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'manually suppressed', source: 'manual' };
    saveSuppressed(suppressed);
    appendSuppressionAudit('add', recipient, reason || 'manually suppressed', 'manual');
    res.json({ ok: true, suppressed: suppressed[recipient] });
});

// POST remove suppression via form-friendly endpoint { recipient }
app.post('/suppressions/un', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const recipient = (req.body && (req.body.recipient || req.body.email)) || null;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    if (!suppressed[recipient]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[recipient]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', recipient, null, 'manual');
    // if called from form submit, redirect back to approvals list
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return res.redirect('/approvals');
    return res.json({ ok: true });
});

// DELETE suppression
app.delete('/suppressions/:recipient', (req, res) => {
    const r = req.params.recipient;
    const suppressed = loadSuppressed();
    if (!suppressed[r]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[r]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', r, null, 'manual');
    res.json({ ok: true });
});

// Bounce callback from provider; stores bounces into data/bounces.json
app.post('/email/bounce', (req, res) => {
    const { messageId, recipient, reason } = req.body || {};
    if (!messageId || !recipient) return res.status(400).json({ ok: false, error: 'messageId and recipient required' });
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    let bounces = {};
    try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
    bounces[recipient] = { ts: new Date().toISOString(), messageId, reason: reason || null };
    fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
    // also write to logs
    const logDir3 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir3)) fs.mkdirSync(logDir3, { recursive: true });
    fs.appendFileSync(path.join(logDir3, 'bounces.log'), JSON.stringify({ ts: new Date().toISOString(), messageId, recipient, reason: reason || null }) + '\n');
    res.json({ ok: true });
});

// SendGrid Events Webhook
app.post('/webhook/sendgrid/events', bodyParser.raw({ type: '*/*' }), (req, res) => {
    let rawBody = '';
    if (Buffer.isBuffer(req.body)) rawBody = req.body.toString();
    else if (typeof req.body === 'string') rawBody = req.body;
    else rawBody = JSON.stringify(req.body || '');
    const sig = req.get('X-Twilio-Email-Event-Webhook-Signature') || req.get('x-twilio-email-event-webhook-signature');
    const ts = req.get('X-Twilio-Email-Event-Webhook-Timestamp') || req.get('x-twilio-email-event-webhook-timestamp');
    const pub = process.env.SENDGRID_PUBLIC_KEY || '';
    if (pub) {
        if (!sig || !ts) return res.status(400).json({ ok: false, error: 'signature required' });
        const payload = ts + rawBody;
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(payload);
            verify.end();
            const ok = verify.verify(pub, sig, 'base64');
            if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });
        } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    }
    // parse events — SendGrid typically sends array of event objects
    let events = [];
    try { events = JSON.parse(rawBody); } catch (e) { try { events = [req.body]; } catch (e) { } }
    // process bounces and delivery events
    for (const ev of events) {
        const t = (ev.event || ev.type || '').toLowerCase();
        if (t.includes('bounce') || t === 'dropped' || t === 'dropped_soft' || t === 'dropped_hard') {
            // map fields — SendGrid has 'smtp-id' and 'email' or 'sg_message_id'
            const messageId = ev.sg_message_id || ev['sg_message_id'] || ev['smtp-id'] || ev.messageId || null;
            const recipient = ev.email || ev.recipient || ev.to || null;
            const reason = ev.reason || ev['response'] || ev.type || t;
            if (recipient && messageId) {
                const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
                let bounces = {};
                try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
                bounces[recipient] = { ts: new Date().toISOString(), provider: 'sendgrid', messageId, reason };
                fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
                // auto-suppress recipient on hard bounce events
                try {
                    const suppressed = loadSuppressed();
                    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'sendgrid bounce', source: 'sendgrid' };
                    saveSuppressed(suppressed);
                    appendSuppressionAudit('add', recipient, reason || 'sendgrid bounce', 'sendgrid');
                } catch (e) { /* ignore */ }
            }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), rawBody + '\n');
    res.json({ ok: true, received: events.length || 1 });
});

// Postmark events webhook (simple token verification)
app.post('/webhook/postmark/events', (req, res) => {
    // Postmark sends json body; you can verify via your webhook token if set
    const token = process.env.POSTMARK_WEBHOOK_TOKEN;
    if (token) { const header = req.get('X-Postmark-Signature') || req.get('x-postmark-signature') || req.get('X-Postmark-Webhook-Token'); if (!header || header !== token) return res.status(401).json({ ok: false, error: 'invalid token' }); }
    const ev = req.body;
    // example mapping — Postmark uses RecordType fields like 'Delivery' and 'Bounce'
    const recordType = (ev.RecordType || ev.recordType || '').toLowerCase();
    if (recordType.includes('bounce')) {
        const recipient = ev.EmailAddress || ev.Recipient || ev.recipient;
        const messageId = ev.MessageID || ev.messageID || ev.messageId;
        const reason = ev.BounceDescription || ev.bounce_description || ev.Description || ev.description || 'bounce';
        if (recipient) {
            const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
            let bounces = {};
            try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
            bounces[recipient] = { ts: new Date().toISOString(), provider: 'postmark', messageId, reason };
            fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
            // auto-suppress postmark bounce recipients
            try {
                const suppressed = loadSuppressed();
                suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'postmark bounce', source: 'postmark' };
                saveSuppressed(suppressed);
                appendSuppressionAudit('add', recipient, reason || 'postmark bounce', 'postmark');
            } catch (e) { /* ignore */ }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), JSON.stringify(req.body) + '\n');
    return res.json({ ok: true });
});

app.get('/email/bounces', (req, res) => {
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    try { const b = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}'); return res.json(b) } catch (e) { return res.json({}) }
});

// Send test email for a variant (if SMTP env set, attempt send, otherwise write to test_emails.log)
app.post('/email/send-test', async (req, res) => {
    const { to, subject, body } = req.body || {};
    if (!to || !subject || !body) return res.status(400).json({ ok: false, error: 'to, subject and body required' });
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), to, subject, body };
    // If SMTP configured via env, try to send
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const info = await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@example.com', to, subject, text: body });
            entry.sent = true; entry.info = info;
            fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.json({ ok: true, sent: true, info });
        } catch (err) {
            entry.sent = false; entry.error = err.message; fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.status(500).json({ ok: false, error: err.message });
        }
    }
    // not configured — write log and return
    fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

app.listen(PORT, () => console.log(`Queue stub running on http://localhost:${PORT}`));

>>>>>>> IMPORT (TEXT)

=======
#!/usr/bin/env node
// Simple local queue stub for testing Lane 3 / Lane 4 endpoints
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;

const dbDir = path.resolve(process.cwd(), 'data', 'queue_db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// global logs directory
const LOG_DIR = path.resolve(process.cwd(), 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const QUEUE_FILE = path.join(dbDir, 'videos.json');
function readQueue() {
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

// Add a video to queue
app.post('/queue/videos', (req, res) => {
    const body = req.body;
    const q = readQueue();
    const id = body.id || `video_${Date.now()}`;
    const item = { id, path: body.path, thumb: body.thumb, metadata: body.metadata || {}, created: new Date().toISOString(), status: 'pending' };
    q.push(item);
    writeQueue(q);
    res.json({ ok: true, id });
});

// Return pending items
app.get('/queue/videos/pending', (req, res) => {
    const q = readQueue();
    const pending = q.filter(i => i.status === 'pending');
    res.json(pending);
});

// Mark done
app.post('/queue/videos/mark-done', (req, res) => {
    const { id } = req.body;
    const q = readQueue();
    const idx = q.findIndex(i => i.id === id);
    if (idx >= 0) { q[idx].status = 'done'; writeQueue(q); res.json({ ok: true, id }); }
    else res.status(404).json({ ok: false, error: 'not found' });
});

// Platform placeholders
app.post('/platforms/:platform/upload', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM UPLOAD', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, received: true });
});

app.post('/platforms/:platform/post', (req, res) => {
    const { platform } = req.params;
    console.log('PLATFORM POST', platform, req.body?.id);
    res.json({ ok: true, platform, id: req.body?.id || null, posted: true });
});

// Funding endpoints used by Lane4
app.post('/grants/check', (req, res) => { res.json({ handled: false }); });
app.post('/verifier/verify', (req, res) => { res.json({ deliverable: true }); });
app.post('/notify/approval', (req, res) => { console.log('Approval notify', req.body); res.json({ ok: true }); });
// Simulate sending an interactive Slack message (placeholder for real Slack integration)
// Payload: { id }
app.post('/notify/slack', (req, res) => {
    const { id } = req.body || {};
    console.log('Slack notify', req.body);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // return a message URL the UI could link to
    const messageUrl = `/approvals/${id}`;
    return res.json({ ok: true, messageUrl, note: 'This is a simulated Slack message. Use /slack/action to simulate a button click.' });
});

// Simulate a Slack action callback (button press)
// Accepts { id, action: 'approve'|'reject', variantIndex }
app.post('/slack/action', (req, res) => {
    const { id, action, variantIndex } = req.body || {};
    if (!id || !action) return res.status(400).json({ ok: false, error: 'id & action required' });
    if (action !== 'approve') return res.json({ ok: true, action, result: 'ignored (only approve simulated)' });
    // call the internal webhook to simulate n8n receiving the Slack interaction
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => res.json({ ok: true, forwarded: true, result: r.data })).catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// Serve the approval UI static assets under /ui
app.use('/ui', express.static(path.join(process.cwd(), 'web', 'approval_ui')));
// Approvals UI: list pending funding_queue items and variants
app.get('/approvals', (req, res) => {
    try {
        const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
        if (!fs.existsSync(fd)) return res.json([]);
        const files = fs.readdirSync(fd).filter(f => f.endsWith('.json') && !f.endsWith('.pitch.json'));
        const out = files.map(f => {
            const base = path.join(fd, f);
            const id = f.replace(/\.json$/, '');
            const meta = JSON.parse(fs.readFileSync(base, 'utf8'));
            const pitchPath = path.join(fd, `${id}.pitch.json`);
            let pitches = null;
            if (fs.existsSync(pitchPath)) pitches = JSON.parse(fs.readFileSync(pitchPath, 'utf8'));
            return { id, meta, pitches };
        });
        res.json(out);
    } catch (e) { res.status(500).json({ error: e.message }) }
});

// Approvals UI page for a single id
app.get('/approvals/:id', (req, res) => {
    const id = req.params.id;
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).send('Not found');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitches = fs.existsSync(pitchFile) ? JSON.parse(fs.readFileSync(pitchFile, 'utf8')).variants : [];
    // render a tiny approval UI
    let html = `<html><head><title>Approve ${id}</title></head><body><h1>Approve: ${id}</h1><pre>${JSON.stringify(meta, null, 2)}</pre>`;
    // include suppression status server-side so tests and clients without JS can see it
    const suppressedList = loadSuppressed();
    const recipient = meta.contact || meta.email || null;
    if (recipient && suppressedList[recipient]) {
        html += `<p class='muted suppression'>Suppressed: ${suppressedList[recipient].reason || 'bounced'} — <form method='POST' action='/suppressions/un' style='display:inline'><input type='hidden' name='recipient' value='${recipient}'/><button type='submit'>Un-suppress</button></form></p>`;
    } else if (recipient) {
        html += `<p class='muted suppression'>Status: not suppressed</p>`;
    }
    if (!pitches || !pitches.length) html += `<p>No pitch variants generated yet.</p>`;
    pitches.forEach((p, idx) => {
        html += `<hr/><h3>Variant ${idx + 1}</h3><b>${p.subject || 'no subject'}</b><p>${(p.body || '').replace(/\n/g, '<br/>')}</p>`;
        html += `<form method='POST' action='/approvals/approve'><input type='hidden' name='id' value='${id}'/><input type='hidden' name='variantIndex' value='${idx}'/><button type='submit'>Approve & Send</button></form>`;
    });
    html += `</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Accept approval from the UI and route to webhook (n8n) for send
app.post('/approvals/approve', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const { id, variantIndex } = req.body || req.query || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    // forward to webhook endpoint used by n8n workflow
    const webhookUrl = `http://localhost:${PORT}/webhook/funding/approve`;
    // simulate POST to n8n webhook
    axios.post(webhookUrl, { id, variantIndex: Number(variantIndex || 0) }).then(r => {
        res.json({ ok: true, forwarded: true, result: r.data });
    }).catch(err => {
        res.status(500).json({ ok: false, error: err.message });
    });
});

// Simulated n8n webhook receiver for /webhook/funding/approve
app.post('/webhook/funding/approve', (req, res) => {
    const { id, variantIndex } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    pitch.sentVariant = Number(variantIndex || 0);
    fs.writeFileSync(pitchFile, JSON.stringify(pitch, null, 2));
    // log the send
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), variant: pitch.variants?.[Number(variantIndex || 0)] || null };
    fs.appendFileSync(path.join(logDir, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, id, sentVariant: pitch.sentVariant });
});

// Production send: send selected variant using configured SMTP senders (rotates senders if multiple provided)
app.post('/email/send', async (req, res) => {
    const { id, variantIndex = 0, to } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const fd = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
    const metaFile = path.join(fd, `${id}.json`);
    const pitchFile = path.join(fd, `${id}.pitch.json`);
    if (!fs.existsSync(metaFile)) return res.status(404).json({ ok: false, error: 'meta not found' });
    if (!fs.existsSync(pitchFile)) return res.status(404).json({ ok: false, error: 'pitch not found' });
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const pitch = JSON.parse(fs.readFileSync(pitchFile, 'utf8'));
    const variant = pitch.variants?.[Number(variantIndex || 0)];
    if (!variant) return res.status(400).json({ ok: false, error: 'variant not found' });

    const recipient = to || meta.contact || meta.email;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient not found' });

    // check suppression — do not reference variables that are defined later
    const suppressed = loadSuppressed();
    if (suppressed[recipient]) {
        const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
        const entry = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sent: false, skipped: true, reason: 'suppressed' };
        fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
        return res.json({ ok: true, sent: false, skipped: true, reason: 'suppressed' });
    }

    // manage sender rotation
    const sendersEnv = process.env.SMTP_SENDERS || process.env.SMTP_FROM || '';
    const senders = sendersEnv.split(',').map(s => s.trim()).filter(Boolean);
    let sender = senders.length ? senders[0] : (process.env.SMTP_FROM || 'noreply@example.com');
    // persist index
    const stateFile = path.resolve(process.cwd(), 'data', 'email_state.json');
    let idx = 0;
    try { const st = JSON.parse(fs.readFileSync(stateFile, 'utf8') || '{}'); idx = st.index || 0 } catch (e) { idx = 0 }
    if (senders.length) { sender = senders[idx % senders.length]; idx = (idx + 1) % senders.length; fs.writeFileSync(stateFile, JSON.stringify({ index: idx })) }

    const logDir2 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir2)) fs.mkdirSync(logDir2, { recursive: true });
    const entryBase = { ts: new Date().toISOString(), id, variantIndex: Number(variantIndex || 0), recipient, sender };

    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const mailOptions = { from: sender, to: recipient, subject: variant.subject || `NovaFlux: ${id}`, text: variant.body || '' };
            const info = await transporter.sendMail(mailOptions);
            const entry = { ...entryBase, sent: true, info };
            fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
            // persist messageId mapping for bounce correlation
            const sentMapFile = path.resolve(process.cwd(), 'data', 'sent_map.json');
            let sentMap = {};
            try { sentMap = JSON.parse(fs.readFileSync(sentMapFile, 'utf8') || '{}') } catch (e) { sentMap = {} }
            sentMap[info.messageId] = { id, recipient, variantIndex: Number(variantIndex || 0), ts: new Date().toISOString(), sender };
            fs.writeFileSync(sentMapFile, JSON.stringify(sentMap, null, 2));
            return res.json({ ok: true, sent: true, info });
        } catch (err) { const entry = { ...entryBase, sent: false, error: err.message }; fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n'); return res.status(500).json({ ok: false, error: err.message }); }
    }

    // SMTP not configured: fallback to logging to test_emails.log and funding_sent.log
    const entry = { ...entryBase, sent: false, info: 'logged (no SMTP configured)' };
    fs.appendFileSync(path.join(logDir2, 'test_emails.log'), JSON.stringify(entry) + '\n');
    fs.appendFileSync(path.join(logDir2, 'funding_sent.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

// Suppression list helpers
const SUPPRESS_FILE = path.resolve(process.cwd(), 'data', 'suppressed.json');
function loadSuppressed() { try { return JSON.parse(fs.readFileSync(SUPPRESS_FILE, 'utf8') || '{}') } catch (e) { return {} } }
function saveSuppressed(obj) { fs.writeFileSync(SUPPRESS_FILE, JSON.stringify(obj, null, 2)) }

// Append a suppression audit entry (json line)
const exportProgress = {};
function appendSuppressionAudit(action, recipient, reason, source) {
    try {
        const entry = { ts: new Date().toISOString(), action, recipient, reason: reason || null, source: source || null };
        fs.appendFileSync(path.join(LOG_DIR, 'suppressions.log'), JSON.stringify(entry) + '\n');
    } catch (e) { /* ignore audit errors */ }
}

// Export progress helpers
function createExportEntry(total) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2));
    exportProgress[id] = { total: total || null, sent: 0, started: new Date().toISOString(), complete: false };
    return id;
}
function updateExportProgress(id, inc = 1) { if (!exportProgress[id]) exportProgress[id] = { total: null, sent: 0, started: new Date().toISOString(), complete: false }; exportProgress[id].sent += inc }
function finishExportProgress(id) { if (exportProgress[id]) { exportProgress[id].complete = true; exportProgress[id].finished = new Date().toISOString() } }

// Cleanup/retention for suppressions.log
const AUDIT_RETENTION_DAYS = Number(process.env.SUPPRESSION_AUDIT_RETENTION_DAYS || 90);
const AUDIT_MAX_ENTRIES = Number(process.env.SUPPRESSION_AUDIT_MAX_ENTRIES || 5000);
function cleanupSuppressionAudit() {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { removed: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        const parsed = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = AUDIT_RETENTION_DAYS > 0 ? (now - (AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)) : 0;
        let filtered = parsed.filter(p => { if (!p || !p.ts) return true; if (cutoff && (new Date(p.ts)).getTime() < cutoff) return false; return true });
        // limit to most recent AUDIT_MAX_ENTRIES
        if (AUDIT_MAX_ENTRIES && filtered.length > AUDIT_MAX_ENTRIES) filtered = filtered.slice(-AUDIT_MAX_ENTRIES);
        if (filtered.length === parsed.length) return { removed: 0 };
        // persist filtered back into file (oldest-first)
        const out = filtered.map(f => JSON.stringify(f)).join('\n') + '\n';
        fs.writeFileSync(logFile, out);
        return { removed: parsed.length - filtered.length };
    } catch (e) { return { removed: 0, error: e.message } }
}

// run initial cleanup at start and schedule daily pruning
try { cleanupSuppressionAudit(); } catch (e) { }
setInterval(() => { try { cleanupSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// Archive old audit entries (moves to archive file under logs/archives)
function archiveSuppressionAudit({ olderThanDays = AUDIT_RETENTION_DAYS } = {}) {
    try {
        const logFile = path.join(LOG_DIR, 'suppressions.log');
        if (!fs.existsSync(logFile)) return { moved: 0 };
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
        const now = Date.now();
        const cutoff = olderThanDays > 0 ? (now - (olderThanDays * 24 * 60 * 60 * 1000)) : 0;
        const toArchive = lines.filter(l => cutoff && (new Date(l.ts)).getTime() < cutoff);
        const keep = lines.filter(l => !(cutoff && (new Date(l.ts)).getTime() < cutoff));
        if (!toArchive.length) return { moved: 0 };
        const archiveDir = path.join(LOG_DIR, 'archives'); if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const fileName = `suppressions-${new Date().toISOString().slice(0, 10)}.jsonl`;
        const archivePath = path.join(archiveDir, fileName);
        // append archive entries to file
        const out = toArchive.map(t => JSON.stringify(t)).join('\n') + '\n';
        fs.appendFileSync(archivePath, out);

        // optionally compress
        try { const zlib = require('zlib'); const gzip = zlib.gzipSync(Buffer.from(out)); fs.appendFileSync(archivePath + '.gz', gzip); } catch (e) { }

        // replace log with kept entries
        fs.writeFileSync(logFile, keep.map(k => JSON.stringify(k)).join('\n') + '\n');

        // optionally upload to S3 if configured
        if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
            try {
                const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
                const body = fs.readFileSync(archivePath);
                const key = path.posix.join('suppression-archives', path.basename(archivePath));
                s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body }));
            } catch (e) { /* ignore S3 errors */ }
        }

        return { moved: toArchive.length, path: archivePath };
    } catch (e) { return { moved: 0, error: e.message } }
}

// schedule daily archive run as well
setInterval(() => { try { archiveSuppressionAudit(); } catch (e) { } }, 24 * 60 * 60 * 1000);

// GET list of suppressed addresses
app.get('/suppressions', (req, res) => { const s = loadSuppressed(); res.json(s); });

// GET suppression audit log lines (most recent first) - optional ?limit=N
// paginated audit list as JSON. supports page & pageSize (1-based) and optional filters
app.get('/suppressions/audit', (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize || req.query.limit || 50)));
    const filterRecipient = req.query.recipient || null;
    const filterAction = req.query.action || null;
    const filterSource = req.query.source || null;

    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.json({ total: 0, page, pageSize, entries: [] });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    // entries oldest-first — make newest first
    let entries = lines.reverse();
    if (filterRecipient) entries = entries.filter(e => ('' + e.recipient || '').includes(filterRecipient));
    if (filterAction) entries = entries.filter(e => e.action === filterAction);
    if (filterSource) entries = entries.filter(e => e.source === filterSource);
    const total = entries.length;
    const start = (page - 1) * pageSize;
    const slice = entries.slice(start, start + pageSize);
    res.json({ total, page, pageSize, entries: slice });
});

// Get export progress by id
app.get('/suppressions/audit/progress', (req, res) => {
    const id = req.query.exportId || req.query.id || null;
    if (!id) return res.status(400).json({ ok: false, error: 'exportId required' });
    const p = exportProgress[id];
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json(Object.assign({ ok: true }, p));
});

// Manual cleanup trigger (useful for tests)
app.post('/suppressions/audit/cleanup', (req, res) => {
    const result = cleanupSuppressionAudit();
    res.json(Object.assign({ ok: true }, result));
});

// Trigger archive run via API. Accept { olderThanDays }
app.post('/suppressions/audit/archive', (req, res) => {
    const { olderThanDays } = req.body || {};
    const result = archiveSuppressionAudit({ olderThanDays: Number(olderThanDays || AUDIT_RETENTION_DAYS) });
    res.json(Object.assign({ ok: true }, result));
});

// Dedicated main app audit page (server-rendered) with filtering/sorting
app.get('/audit', (req, res) => {
    const { recipient, action, source, sort = 'ts', order = 'desc', limit = 200 } = req.query || {};
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    let entries = [];
    if (fs.existsSync(logFile)) {
        const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
        entries = lines.map(l => { try { return JSON.parse(l) } catch (e) { return null } }).filter(Boolean);
    }
    // filter
    let out = entries.filter(e => { if (recipient && (!e.recipient || !('' + e.recipient).includes(recipient))) return false; if (action && e.action !== action) return false; if (source && e.source !== source) return false; return true });
    // sort
    out.sort((a, b) => {
        let av = a[sort] || '';
        let bv = b[sort] || '';
        if (sort === 'ts') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
        if (av < bv) return order === 'asc' ? -1 : 1; if (av > bv) return order === 'asc' ? 1 : -1; return 0;
    });
    out = out.slice(0, Number(limit || 200));
    // render simple HTML table
    let html = `<html><head><title>Audit</title><link rel="stylesheet" href="/ui/style.css"/></head><body><div id=app style="max-width:1100px;margin:18px auto;padding:12px"><header><h1>Suppression Audit</h1><div class="controls"><a href="/ui/" class="btn ghost">Approvals</a> <a href="/ui/audit.html" class="btn ghost">UI Audit</a> <a href="/suppressions/audit.csv" class="btn">Export CSV</a></div></header>`;
    html += `<form method="GET" action="/audit" style="margin:10px 0"><input name="recipient" placeholder="recipient" value="${recipient || ''}"/> <input name="action" placeholder="action" value="${action || ''}"/> <input name="source" placeholder="source" value="${source || ''}"/> <select name="sort"><option value="ts">time</option><option value="recipient">recipient</option><option value="action">action</option></select> <select name="order"><option value="desc">desc</option><option value="asc">asc</option></select> <button>Apply</button></form>`;
    html += `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>`;
    out.forEach(r => { html += `<tr><td>${r.ts}</td><td>${r.action}</td><td>${r.recipient}</td><td>${r.reason || ''}</td><td>${r.source || ''}</td></tr>` });
    html += `</tbody></table></div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Stream audit log as CSV (useful for large logs) - optional ?limit=N or ?since=ISO
app.get('/suppressions/audit.csv', (req, res) => {
    const logFile = path.join(LOG_DIR, 'suppressions.log');
    if (!fs.existsSync(logFile)) return res.status(404).send('no audit log');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suppressions_audit.csv"');

    const since = req.query.since ? new Date(req.query.since) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    // decide compression early and create appropriate writable stream
    const accept = (req.headers['accept-encoding'] || '').toLowerCase();
    const compressParam = (req.query.compress || '').toLowerCase();
    const useBrotli = (compressParam === 'br') || accept.includes('br');
    const useGzip = (!useBrotli && ((compressParam === 'true') || accept.includes('gzip')));
    let stream = res;
    if (useBrotli) {
        res.setHeader('Content-Encoding', 'br');
        const zlib = require('zlib');
        const br = zlib.createBrotliCompress();
        br.pipe(res);
        stream = br;
    } else if (useGzip) {
        res.setHeader('Content-Encoding', 'gzip');
        const zlib = require('zlib');
        const gz = zlib.createGzip();
        gz.pipe(res);
        stream = gz;
    }

    // count total lines to provide progress info
    const rawLines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const totalLines = rawLines.length;
    // expose total lines for progress metrics
    res.setHeader('X-Audit-Total', String(totalLines));
    const exportId = createExportEntry(totalLines);
    // expose export id for client
    res.setHeader('X-Export-Id', exportId);

    // create read stream from file so we stream lines
    const readStream = fs.createReadStream(logFile, { encoding: 'utf8' });
    const rl = require('readline').createInterface({ input: readStream });
    // write header
    stream.write('ts,action,recipient,reason,source\n');
    let count = 0;
    rl.on('line', (line) => {
        if (!line) return;
        try {
            const obj = JSON.parse(line);
            if (since && new Date(obj.ts) < since) return;
            const row = [obj.ts, obj.action, obj.recipient, (obj.reason || '').replace(/"/g, '""'), obj.source || ''].map(v => `"${('' + (v || '')).replace(/"/g, '""')}"`).join(',') + '\n';
            stream.write(row);
            updateExportProgress(exportId, 1);
            count++;
            if (limit && count >= limit) { rl.close(); readStream.destroy(); stream.end(); finishExportProgress(exportId); }
        } catch (e) { /* ignore malformed */ }
    });
    rl.on('close', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });
    rl.on('error', () => { try { stream.end(); finishExportProgress(exportId); } catch (e) { } });

    // (compression handled above)
});

// POST add suppression { recipient, reason }
app.post('/suppressions', (req, res) => {
    const { recipient, reason } = req.body || {};
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'manually suppressed', source: 'manual' };
    saveSuppressed(suppressed);
    appendSuppressionAudit('add', recipient, reason || 'manually suppressed', 'manual');
    res.json({ ok: true, suppressed: suppressed[recipient] });
});

// POST remove suppression via form-friendly endpoint { recipient }
app.post('/suppressions/un', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const recipient = (req.body && (req.body.recipient || req.body.email)) || null;
    if (!recipient) return res.status(400).json({ ok: false, error: 'recipient required' });
    const suppressed = loadSuppressed();
    if (!suppressed[recipient]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[recipient]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', recipient, null, 'manual');
    // if called from form submit, redirect back to approvals list
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return res.redirect('/approvals');
    return res.json({ ok: true });
});

// DELETE suppression
app.delete('/suppressions/:recipient', (req, res) => {
    const r = req.params.recipient;
    const suppressed = loadSuppressed();
    if (!suppressed[r]) return res.status(404).json({ ok: false, error: 'not found' });
    delete suppressed[r]; saveSuppressed(suppressed);
    appendSuppressionAudit('remove', r, null, 'manual');
    res.json({ ok: true });
});

// Bounce callback from provider; stores bounces into data/bounces.json
app.post('/email/bounce', (req, res) => {
    const { messageId, recipient, reason } = req.body || {};
    if (!messageId || !recipient) return res.status(400).json({ ok: false, error: 'messageId and recipient required' });
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    let bounces = {};
    try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
    bounces[recipient] = { ts: new Date().toISOString(), messageId, reason: reason || null };
    fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
    // also write to logs
    const logDir3 = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir3)) fs.mkdirSync(logDir3, { recursive: true });
    fs.appendFileSync(path.join(logDir3, 'bounces.log'), JSON.stringify({ ts: new Date().toISOString(), messageId, recipient, reason: reason || null }) + '\n');
    res.json({ ok: true });
});

// SendGrid Events Webhook
app.post('/webhook/sendgrid/events', bodyParser.raw({ type: '*/*' }), (req, res) => {
    let rawBody = '';
    if (Buffer.isBuffer(req.body)) rawBody = req.body.toString();
    else if (typeof req.body === 'string') rawBody = req.body;
    else rawBody = JSON.stringify(req.body || '');
    const sig = req.get('X-Twilio-Email-Event-Webhook-Signature') || req.get('x-twilio-email-event-webhook-signature');
    const ts = req.get('X-Twilio-Email-Event-Webhook-Timestamp') || req.get('x-twilio-email-event-webhook-timestamp');
    const pub = process.env.SENDGRID_PUBLIC_KEY || '';
    if (pub) {
        if (!sig || !ts) return res.status(400).json({ ok: false, error: 'signature required' });
        const payload = ts + rawBody;
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(payload);
            verify.end();
            const ok = verify.verify(pub, sig, 'base64');
            if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });
        } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    }
    // parse events — SendGrid typically sends array of event objects
    let events = [];
    try { events = JSON.parse(rawBody); } catch (e) { try { events = [req.body]; } catch (e) { } }
    // process bounces and delivery events
    for (const ev of events) {
        const t = (ev.event || ev.type || '').toLowerCase();
        if (t.includes('bounce') || t === 'dropped' || t === 'dropped_soft' || t === 'dropped_hard') {
            // map fields — SendGrid has 'smtp-id' and 'email' or 'sg_message_id'
            const messageId = ev.sg_message_id || ev['sg_message_id'] || ev['smtp-id'] || ev.messageId || null;
            const recipient = ev.email || ev.recipient || ev.to || null;
            const reason = ev.reason || ev['response'] || ev.type || t;
            if (recipient && messageId) {
                const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
                let bounces = {};
                try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
                bounces[recipient] = { ts: new Date().toISOString(), provider: 'sendgrid', messageId, reason };
                fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
                // auto-suppress recipient on hard bounce events
                try {
                    const suppressed = loadSuppressed();
                    suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'sendgrid bounce', source: 'sendgrid' };
                    saveSuppressed(suppressed);
                    appendSuppressionAudit('add', recipient, reason || 'sendgrid bounce', 'sendgrid');
                } catch (e) { /* ignore */ }
            }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), rawBody + '\n');
    res.json({ ok: true, received: events.length || 1 });
});

// Postmark events webhook (simple token verification)
app.post('/webhook/postmark/events', (req, res) => {
    // Postmark sends json body; you can verify via your webhook token if set
    const token = process.env.POSTMARK_WEBHOOK_TOKEN;
    if (token) { const header = req.get('X-Postmark-Signature') || req.get('x-postmark-signature') || req.get('X-Postmark-Webhook-Token'); if (!header || header !== token) return res.status(401).json({ ok: false, error: 'invalid token' }); }
    const ev = req.body;
    // example mapping — Postmark uses RecordType fields like 'Delivery' and 'Bounce'
    const recordType = (ev.RecordType || ev.recordType || '').toLowerCase();
    if (recordType.includes('bounce')) {
        const recipient = ev.EmailAddress || ev.Recipient || ev.recipient;
        const messageId = ev.MessageID || ev.messageID || ev.messageId;
        const reason = ev.BounceDescription || ev.bounce_description || ev.Description || ev.description || 'bounce';
        if (recipient) {
            const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
            let bounces = {};
            try { bounces = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}') } catch (e) { bounces = {} }
            bounces[recipient] = { ts: new Date().toISOString(), provider: 'postmark', messageId, reason };
            fs.writeFileSync(bouncesFile, JSON.stringify(bounces, null, 2));
            // auto-suppress postmark bounce recipients
            try {
                const suppressed = loadSuppressed();
                suppressed[recipient] = { ts: new Date().toISOString(), reason: reason || 'postmark bounce', source: 'postmark' };
                saveSuppressed(suppressed);
                appendSuppressionAudit('add', recipient, reason || 'postmark bounce', 'postmark');
            } catch (e) { /* ignore */ }
        }
    }
    fs.appendFileSync(path.join(LOG_DIR, 'esp_events.log'), JSON.stringify(req.body) + '\n');
    return res.json({ ok: true });
});

app.get('/email/bounces', (req, res) => {
    const bouncesFile = path.resolve(process.cwd(), 'data', 'bounces.json');
    try { const b = JSON.parse(fs.readFileSync(bouncesFile, 'utf8') || '{}'); return res.json(b) } catch (e) { return res.json({}) }
});

// Send test email for a variant (if SMTP env set, attempt send, otherwise write to test_emails.log)
app.post('/email/send-test', async (req, res) => {
    const { to, subject, body } = req.body || {};
    if (!to || !subject || !body) return res.status(400).json({ ok: false, error: 'to, subject and body required' });
    const logDir = path.resolve(process.cwd(), 'data', 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { ts: new Date().toISOString(), to, subject, body };
    // If SMTP configured via env, try to send
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: !!process.env.SMTP_SECURE, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
            const info = await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@example.com', to, subject, text: body });
            entry.sent = true; entry.info = info;
            fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.json({ ok: true, sent: true, info });
        } catch (err) {
            entry.sent = false; entry.error = err.message; fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
            return res.status(500).json({ ok: false, error: err.message });
        }
    }
    // not configured — write log and return
    fs.appendFileSync(path.join(logDir, 'test_emails.log'), JSON.stringify(entry) + '\n');
    res.json({ ok: true, sent: false, info: 'logged' });
});

app.listen(PORT, () => console.log(`Queue stub running on http://localhost:${PORT}`));

>>>>>>> IMPORT (TEXT)
