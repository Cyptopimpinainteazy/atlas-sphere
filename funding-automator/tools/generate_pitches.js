#!/usr/bin/env node
// Generate multiple pitch variants for each queued funding item.
// Reads files from /data/staging/funding_queue/*.json and writes a <id>.pitch.json with variants.
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const axios = require('axios');

const QUEUE_DIR = path.resolve(process.cwd(), 'data', 'staging', 'funding_queue');
if (!fs.existsSync(QUEUE_DIR)) { fs.mkdirSync(QUEUE_DIR, { recursive: true }); }

// gather plain JSON queue files (ignore already-generated .pitch.json)
let files = [];
try {
    files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.pitch.json'));
} catch (e) { files = [] }
if (!files.length) { console.log('No queue files found in', QUEUE_DIR); process.exit(0); }

async function generate(textPrompt) {
    try {
        // call local LLM endpoint; change as needed
        const res = await axios.post('http://localhost:11434/api/generate', { model: 'llama3-8b', prompt: textPrompt });
        // handle common wrappers
        return res.data?.output || res.data?.response || res.data;
    } catch (e) {
        console.error('LLM call failed, using fallback generator:', e.message);
        return null;
    }
}

(async () => {
    for (const f of files) {
        try {
            const p = path.join(QUEUE_DIR, f);
            const content = JSON.parse(fs.readFileSync(p, 'utf8'));
            // form prompt templates
            const basicPrompt = `Persona: NovaFlux\nGenerate 3 concise micro-pitch email variants (50-200 words each) tailored to ${content.org || content.title || 'recipient'}. Include a 1-line subject and a 2-line plaintext pitch. Also produce a 3-bullet traction list based on available metadata. Return JSON with keys: variants[].`;
            const generated = await generate(basicPrompt);
            const variants = generated || [
                { subject: `Intro — ${content.org || 'team'}`, body: `Hi ${content.org || 'there'},\nWe have a public testnet and reproducible benchmark results. 15-min demo?`, traction: ['testnet live', 'public explorer', 'demo dApps'] },
                { subject: `Demo request — ${content.org || 'your team'}`, body: `Hey ${content.org || 'there'},\nWe're shipping a dual-VM chain with EVM compatibility and SVM acceleration. Quick demo?`, traction: ['fast deploy', 'faucet', 'playground'] },
                { subject: `Grant interest — ${content.org || 'partner'}`, body: `Hello ${content.org || 'there'},\nWe focus on developer access and low-cost experimentation. Can we chat about grant fit?`, traction: ['dev onboarding', 'playground', 'benchmarks'] }
            ];
            const out = { id: content.id || f.replace(/\.json$/, ''), generated: true, variants };
            const outPath = path.join(QUEUE_DIR, `${out.id}.pitch.json`);
            fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
            console.log('Wrote', outPath);
        } catch (e) { console.error('Error processing', f, e.stack || e.message); }
    }
})();
