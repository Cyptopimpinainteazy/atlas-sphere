<<<<<<< REPO
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('audit UI and export', () => {
  let proc
  beforeAll(async () => {
    // start server if needed
    let running = false
    try { await axios.get('http://localhost:3000/queue/videos/pending'); running = true } catch (e) { running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const start = Date.now(); let ok = false
    while (Date.now() - start < 10000) { try { await axios.get('http://localhost:3000/queue/videos/pending'); ok = true; break } catch (e) { await new Promise(r => setTimeout(r, 200)) } }
    if (!ok) throw new Error('queue_stub not running')
  }, 20000)
  afterAll(() => { if (proc && !proc.killed) proc.kill() })

  test('GET /ui/audit.html served and /suppressions/audit returns entries', async () => {
    const base = 'http://localhost:3000'
    // add a suppression so audit not empty
    await axios.post(`${base}/suppressions`, { recipient: 'audit-test@example.com', reason: 'ui test' })
    const page = await axios.get(`${base}/ui/audit.html`)
    expect(page.status).toBe(200)
    expect(page.data).toContain('Suppression Audit')
    // ensure UI contains pages container for numeric pagination
    expect(page.data).toContain('id="pages"')

    const auditPage = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=10`)).data
    expect(auditPage).toHaveProperty('entries')
    expect(Array.isArray(auditPage.entries)).toBe(true)
    expect(auditPage.entries.find(e => e.recipient === 'audit-test@example.com')).toBeTruthy()
  })
})

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('audit UI and export', () => {
  let proc
  beforeAll(async () => {
    // start server if needed
    let running = false
    try { await axios.get('http://localhost:3000/queue/videos/pending'); running = true } catch (e) { running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const start = Date.now(); let ok = false
    while (Date.now() - start < 10000) { try { await axios.get('http://localhost:3000/queue/videos/pending'); ok = true; break } catch (e) { await new Promise(r => setTimeout(r, 200)) } }
    if (!ok) throw new Error('queue_stub not running')
  }, 20000)
  afterAll(() => { if (proc && !proc.killed) proc.kill() })

  test('GET /ui/audit.html served and /suppressions/audit returns entries', async () => {
    const base = 'http://localhost:3000'
    // add a suppression so audit not empty
    await axios.post(`${base}/suppressions`, { recipient: 'audit-test@example.com', reason: 'ui test' })
    const page = await axios.get(`${base}/ui/audit.html`)
    expect(page.status).toBe(200)
    expect(page.data).toContain('Suppression Audit')
    // ensure UI contains pages container for numeric pagination
    expect(page.data).toContain('id="pages"')

    const auditPage = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=10`)).data
    expect(auditPage).toHaveProperty('entries')
    expect(Array.isArray(auditPage.entries)).toBe(true)
    expect(auditPage.entries.find(e => e.recipient === 'audit-test@example.com')).toBeTruthy()
  })
})

>>>>>>> IMPORT (TEXT)
