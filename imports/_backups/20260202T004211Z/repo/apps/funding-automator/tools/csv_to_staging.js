#!/usr/bin/env node
// Reads data/30_shorts.csv and writes JSON files to /data/staging/texts
// Optionally enqueue items to the local queue stub via --enqueue
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/lib/sync');
const axios = require('axios');

const CSV = path.resolve(process.cwd(), 'data', '30_shorts.csv');
const OUT_DIR = path.resolve(process.cwd(), 'data', 'staging', 'texts');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const argv = require('minimist')(process.argv.slice(2));
const enqueue = !!argv.enqueue;
const queueUrl = argv.queue || 'http://localhost:3000/queue/videos';

const raw = fs.readFileSync(CSV, 'utf8');
const records = csv(raw, { columns: true, skip_empty_lines: true });

for (const r of records) {
    const id = r.id || `short_${Date.now()}`;
    const obj = {
        id,
        topic: r.topic,
        script: r.script,
        title: r.title,
        description: r.description,
        tags: (r.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        platforms: (r.platforms || '').split(',').map(s => s.trim()).filter(Boolean),
        duration_seconds: Number(r.duration_seconds || 10)
    };
    const outPath = path.join(OUT_DIR, `${id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
    console.log('Wrote', outPath);
    if (enqueue) {
        // push to queue
        axios.post(queueUrl, { id, path: `/data/staging/videos/${id}.mp4`, thumb: `/data/staging/videos/${id}.thumb.jpg`, metadata: obj }).then(() =>
            console.log('Enqueued', id)).catch(e => console.error('Enqueue failed', e.message));
    }
}
