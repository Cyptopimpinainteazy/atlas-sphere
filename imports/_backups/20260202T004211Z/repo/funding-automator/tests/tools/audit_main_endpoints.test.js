<<<<<<< REPO
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const axios = require('axios')

describe('Main audit endpoints (CSV, /audit, cleanup)', () => {
  let proc
  const base = 'http://localhost:3000'
  const logFile = path.join(process.cwd(), 'data', 'logs', 'suppressions.log')

  beforeAll(async () => {
    // ensure server running
    let running = false
    try { await axios.get(base + '/queue/videos/pending'); running = true } catch (e) { running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const start = Date.now(); let ok = false
    while (Date.now() - start < 10000) { try { await axios.get(base + '/queue/videos/pending'); ok = true; break } catch (e) { await new Promise(r => setTimeout(r, 200)) } }
    if (!ok) throw new Error('queue_stub not running')
  }, 20000)
  afterAll(() => { if (proc && !proc.killed) proc.kill() })

  test('GET /suppressions/audit.csv streams CSV', async () => {
    // add a sample audit entry
    await axios.post(base + '/suppressions', { recipient: 'csv-test@example.com', reason: 'csv test' })
    const res = await axios.get(base + '/suppressions/audit.csv', { responseType: 'text' })
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.data).toContain('ts,action,recipient,reason,source')
    expect(res.data).toContain('csv-test@example.com')
    // compressed via accept-encoding
    const gzipRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'gzip' } })
    // if server compresses, content is gzipped — try to gunzip and check content
    const zlib = require('zlib')
    const buf = Buffer.from(gzipRes.data)
    let decompressed = null
    try { decompressed = zlib.gunzipSync(buf).toString('utf8') } catch (e) { /* not gzipped */ }
    if (decompressed) expect(decompressed).toContain('csv-test@example.com')

    // check Brotli compression if supported
    const brRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'br' } })
    const buf2 = Buffer.from(brRes.data)
    let decompressed2 = null
    try { decompressed2 = zlib.brotliDecompressSync(buf2).toString('utf8') } catch (e) { /* not br */ }
    if (decompressed2) expect(decompressed2).toContain('csv-test@example.com')

    // header for total lines
    const rawRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'text' })
    expect(rawRes.headers['x-audit-total']).toBeTruthy()

    // progress endpoint should return exportId header and progress
    const exportId = gzipRes.headers['x-export-id'] || brRes.headers['x-export-id']
    if (exportId) {
      const prog = (await axios.get(base + '/suppressions/audit/progress?exportId=' + exportId)).data
      expect(prog.ok).toBe(true)
      expect(prog).toHaveProperty('total')
      expect(prog).toHaveProperty('sent')
    }
  })

  test('POST /suppressions/audit/archive moves old entries to archives', async () => {
    // create a couple entries and mark them old
    const base = 'http://localhost:3000'
    const logFile = path.join(process.cwd(), 'data', 'logs', 'suppressions.log')
    const old = { ts: '2000-01-01T00:00:00Z', action: 'add', recipient: 'archive-old@example.com', reason: 'old', source: 'test' }
    const recent = { ts: new Date().toISOString(), action: 'add', recipient: 'archive-new@example.com', reason: 'new', source: 'test' }
    try { fs.mkdirSync(path.dirname(logFile), { recursive: true }) } catch (e) { }
    fs.writeFileSync(logFile, JSON.stringify(old) + '\n' + JSON.stringify(recent) + '\n')

    const res = await axios.post(base + '/suppressions/audit/archive', { olderThanDays: 3650 })
    expect(res.data.ok).toBe(true)
    expect(res.data.moved).toBeGreaterThanOrEqual(1)
    // the old entry should no longer exist in the main log
    const remaining = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l))
    expect(remaining.find(r => r.recipient === 'archive-old@example.com')).toBeFalsy()
    expect(remaining.find(r => r.recipient === 'archive-new@example.com')).toBeTruthy()
  })

  test('GET /suppressions/audit paginated JSON', async () => {
    // create multiple audit entries
    for (let i = 0; i < 5; i++) await axios.post(base + '/suppressions', { recipient: `pag${i}@example.com`, reason: 'pag' })
    const res = await axios.get(base + '/suppressions/audit?page=1&pageSize=2')
    expect(res.data).toHaveProperty('total')
    expect(res.data).toHaveProperty('page')
    expect(res.data).toHaveProperty('pageSize')
    expect(Array.isArray(res.data.entries)).toBe(true)
    expect(res.data.entries.length).toBeLessThanOrEqual(2)
  })

  test('GET /audit server-rendered page supports filtering/sorting', async () => {
    // add two entries
    await axios.post(base + '/suppressions', { recipient: 'aud1@example.com', reason: 'r1' })
    await axios.post(base + '/suppressions', { recipient: 'aud2@example.com', reason: 'r2' })
    const page = await axios.get(base + '/audit')
    expect(page.status).toBe(200)
    expect(page.data).toContain('Suppression Audit')
    const filtered = await axios.get(base + '/audit?recipient=aud1@example.com')
    expect(filtered.data).toContain('aud1@example.com')
    expect(filtered.data).not.toContain('aud2@example.com')
  })

  test('POST /suppressions/audit/cleanup removes old entries', async () => {
    // write two entries: one old, one new
    const old = { ts: '2000-01-01T00:00:00Z', action: 'add', recipient: 'old@example.com', reason: 'old', source: 'test' }
    const recent = { ts: new Date().toISOString(), action: 'add', recipient: 'new@example.com', reason: 'new', source: 'test' }
    // ensure log directory exists
    try { fs.mkdirSync(path.dirname(logFile), { recursive: true }) } catch (e) { }
    fs.writeFileSync(logFile, JSON.stringify(old) + '\n' + JSON.stringify(recent) + '\n')
    // run cleanup
    const res = await axios.post(base + '/suppressions/audit/cleanup')
    expect(res.data.ok).toBe(true)
    expect(res.data.removed).toBeGreaterThanOrEqual(1)
    const remaining = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l))
    expect(remaining.find(r => r.recipient === 'old@example.com')).toBeFalsy()
    expect(remaining.find(r => r.recipient === 'new@example.com')).toBeTruthy()
  })
})

=======
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const axios = require('axios')

describe('Main audit endpoints (CSV, /audit, cleanup)', () => {
  let proc
  const base = 'http://localhost:3000'
  const logFile = path.join(process.cwd(), 'data', 'logs', 'suppressions.log')

  beforeAll(async () => {
    // ensure server running
    let running = false
    try { await axios.get(base + '/queue/videos/pending'); running = true } catch (e) { running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const start = Date.now(); let ok = false
    while (Date.now() - start < 10000) { try { await axios.get(base + '/queue/videos/pending'); ok = true; break } catch (e) { await new Promise(r => setTimeout(r, 200)) } }
    if (!ok) throw new Error('queue_stub not running')
  }, 20000)
  afterAll(() => { if (proc && !proc.killed) proc.kill() })

  test('GET /suppressions/audit.csv streams CSV', async () => {
    // add a sample audit entry
    await axios.post(base + '/suppressions', { recipient: 'csv-test@example.com', reason: 'csv test' })
    const res = await axios.get(base + '/suppressions/audit.csv', { responseType: 'text' })
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.data).toContain('ts,action,recipient,reason,source')
    expect(res.data).toContain('csv-test@example.com')
    // compressed via accept-encoding
    const gzipRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'gzip' } })
    // if server compresses, content is gzipped — try to gunzip and check content
    const zlib = require('zlib')
    const buf = Buffer.from(gzipRes.data)
    let decompressed = null
    try { decompressed = zlib.gunzipSync(buf).toString('utf8') } catch (e) { /* not gzipped */ }
    if (decompressed) expect(decompressed).toContain('csv-test@example.com')

    // check Brotli compression if supported
    const brRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'arraybuffer', headers: { 'Accept-Encoding': 'br' } })
    const buf2 = Buffer.from(brRes.data)
    let decompressed2 = null
    try { decompressed2 = zlib.brotliDecompressSync(buf2).toString('utf8') } catch (e) { /* not br */ }
    if (decompressed2) expect(decompressed2).toContain('csv-test@example.com')

    // header for total lines
    const rawRes = await axios.get(base + '/suppressions/audit.csv', { responseType: 'text' })
    expect(rawRes.headers['x-audit-total']).toBeTruthy()

    // progress endpoint should return exportId header and progress
    const exportId = gzipRes.headers['x-export-id'] || brRes.headers['x-export-id']
    if (exportId) {
      const prog = (await axios.get(base + '/suppressions/audit/progress?exportId=' + exportId)).data
      expect(prog.ok).toBe(true)
      expect(prog).toHaveProperty('total')
      expect(prog).toHaveProperty('sent')
    }
  })

  test('POST /suppressions/audit/archive moves old entries to archives', async () => {
    // create a couple entries and mark them old
    const base = 'http://localhost:3000'
    const logFile = path.join(process.cwd(), 'data', 'logs', 'suppressions.log')
    const old = { ts: '2000-01-01T00:00:00Z', action: 'add', recipient: 'archive-old@example.com', reason: 'old', source: 'test' }
    const recent = { ts: new Date().toISOString(), action: 'add', recipient: 'archive-new@example.com', reason: 'new', source: 'test' }
    try { fs.mkdirSync(path.dirname(logFile), { recursive: true }) } catch (e) { }
    fs.writeFileSync(logFile, JSON.stringify(old) + '\n' + JSON.stringify(recent) + '\n')

    const res = await axios.post(base + '/suppressions/audit/archive', { olderThanDays: 3650 })
    expect(res.data.ok).toBe(true)
    expect(res.data.moved).toBeGreaterThanOrEqual(1)
    // the old entry should no longer exist in the main log
    const remaining = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l))
    expect(remaining.find(r => r.recipient === 'archive-old@example.com')).toBeFalsy()
    expect(remaining.find(r => r.recipient === 'archive-new@example.com')).toBeTruthy()
  })

  test('GET /suppressions/audit paginated JSON', async () => {
    // create multiple audit entries
    for (let i = 0; i < 5; i++) await axios.post(base + '/suppressions', { recipient: `pag${i}@example.com`, reason: 'pag' })
    const res = await axios.get(base + '/suppressions/audit?page=1&pageSize=2')
    expect(res.data).toHaveProperty('total')
    expect(res.data).toHaveProperty('page')
    expect(res.data).toHaveProperty('pageSize')
    expect(Array.isArray(res.data.entries)).toBe(true)
    expect(res.data.entries.length).toBeLessThanOrEqual(2)
  })

  test('GET /audit server-rendered page supports filtering/sorting', async () => {
    // add two entries
    await axios.post(base + '/suppressions', { recipient: 'aud1@example.com', reason: 'r1' })
    await axios.post(base + '/suppressions', { recipient: 'aud2@example.com', reason: 'r2' })
    const page = await axios.get(base + '/audit')
    expect(page.status).toBe(200)
    expect(page.data).toContain('Suppression Audit')
    const filtered = await axios.get(base + '/audit?recipient=aud1@example.com')
    expect(filtered.data).toContain('aud1@example.com')
    expect(filtered.data).not.toContain('aud2@example.com')
  })

  test('POST /suppressions/audit/cleanup removes old entries', async () => {
    // write two entries: one old, one new
    const old = { ts: '2000-01-01T00:00:00Z', action: 'add', recipient: 'old@example.com', reason: 'old', source: 'test' }
    const recent = { ts: new Date().toISOString(), action: 'add', recipient: 'new@example.com', reason: 'new', source: 'test' }
    // ensure log directory exists
    try { fs.mkdirSync(path.dirname(logFile), { recursive: true }) } catch (e) { }
    fs.writeFileSync(logFile, JSON.stringify(old) + '\n' + JSON.stringify(recent) + '\n')
    // run cleanup
    const res = await axios.post(base + '/suppressions/audit/cleanup')
    expect(res.data.ok).toBe(true)
    expect(res.data.removed).toBeGreaterThanOrEqual(1)
    const remaining = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l))
    expect(remaining.find(r => r.recipient === 'old@example.com')).toBeFalsy()
    expect(remaining.find(r => r.recipient === 'new@example.com')).toBeTruthy()
  })
})

>>>>>>> IMPORT (TEXT)
