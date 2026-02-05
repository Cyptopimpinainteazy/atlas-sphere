<<<<<<< REPO
<<<<<<< REPO
import axios from 'axios'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const hasExpress = (() => { try { require.resolve('express'); return true } catch { return false } })()

const PORT = 4001
const BASE = `http://localhost:${PORT}`
const QUEUE_DB = path.resolve(process.cwd(), 'data', 'queue_db')

let proc: any

if (!hasExpress) {
  test.skip('express not installed, skipping queue_stub tests', () => {})
} else {
  beforeAll((done) => {
    // start the queue stub on a different port
    proc = spawn('node', ['tools/queue_stub.js'], { env: { ...process.env, PORT: String(PORT) } })
    proc.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (s.includes(`Queue stub running`)) done()
    })
    proc.stderr.on('data', (d: Buffer) => console.error('queue_stub stderr:', d.toString()))
  })

  afterAll(() => {
    if (proc) proc.kill()
    // cleanup queue db
    try { fs.rmSync(QUEUE_DB, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  })

  test('queue flow: post -> pending -> mark-done', async () => {
  const resp = await axios.post(`${BASE}/queue/videos`, { id: 'test123', path: '/tmp/x.mp4' })
  expect(resp.data.ok).toBe(true)
  expect(resp.data.id).toBe('test123')

  const pending = await axios.get(`${BASE}/queue/videos/pending`)
  expect(Array.isArray(pending.data)).toBe(true)
  const found = pending.data.find((i: any) => i.id === 'test123')
  expect(found).toBeDefined()

  const mark = await axios.post(`${BASE}/queue/videos/mark-done`, { id: 'test123' })
  expect(mark.data.ok).toBe(true)

  const pending2 = await axios.get(`${BASE}/queue/videos/pending`)
  const still = pending2.data.find((i: any) => i.id === 'test123')
  expect(still).toBeUndefined()
})

}

=======
import axios from 'axios'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const hasExpress = (() => { try { require.resolve('express'); return true } catch { return false } })()

const PORT = 4001
const BASE = `http://localhost:${PORT}`
const QUEUE_DB = path.resolve(process.cwd(), 'data', 'queue_db')

let proc: any

if (!hasExpress) {
  test.skip('express not installed, skipping queue_stub tests', () => {})
} else {
  beforeAll((done) => {
    // start the queue stub on a different port
    proc = spawn('node', ['tools/queue_stub.js'], { env: { ...process.env, PORT: String(PORT) } })
    proc.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (s.includes(`Queue stub running`)) done()
    })
    proc.stderr.on('data', (d: Buffer) => console.error('queue_stub stderr:', d.toString()))
  })

  afterAll(() => {
    if (proc) proc.kill()
    // cleanup queue db
    try { fs.rmSync(QUEUE_DB, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  })

  test('queue flow: post -> pending -> mark-done', async () => {
  const resp = await axios.post(`${BASE}/queue/videos`, { id: 'test123', path: '/tmp/x.mp4' })
  expect(resp.data.ok).toBe(true)
  expect(resp.data.id).toBe('test123')

  const pending = await axios.get(`${BASE}/queue/videos/pending`)
  expect(Array.isArray(pending.data)).toBe(true)
  const found = pending.data.find((i: any) => i.id === 'test123')
  expect(found).toBeDefined()

  const mark = await axios.post(`${BASE}/queue/videos/mark-done`, { id: 'test123' })
  expect(mark.data.ok).toBe(true)

  const pending2 = await axios.get(`${BASE}/queue/videos/pending`)
  const still = pending2.data.find((i: any) => i.id === 'test123')
  expect(still).toBeUndefined()
})

}

>>>>>>> IMPORT (TEXT)

=======
import axios from 'axios'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const hasExpress = (() => { try { require.resolve('express'); return true } catch { return false } })()

const PORT = 4001
const BASE = `http://localhost:${PORT}`
const QUEUE_DB = path.resolve(process.cwd(), 'data', 'queue_db')

let proc: any

if (!hasExpress) {
  test.skip('express not installed, skipping queue_stub tests', () => {})
} else {
  beforeAll((done) => {
    // start the queue stub on a different port
    proc = spawn('node', ['tools/queue_stub.js'], { env: { ...process.env, PORT: String(PORT) } })
    proc.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (s.includes(`Queue stub running`)) done()
    })
    proc.stderr.on('data', (d: Buffer) => console.error('queue_stub stderr:', d.toString()))
  })

  afterAll(() => {
    if (proc) proc.kill()
    // cleanup queue db
    try { fs.rmSync(QUEUE_DB, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  })

  test('queue flow: post -> pending -> mark-done', async () => {
  const resp = await axios.post(`${BASE}/queue/videos`, { id: 'test123', path: '/tmp/x.mp4' })
  expect(resp.data.ok).toBe(true)
  expect(resp.data.id).toBe('test123')

  const pending = await axios.get(`${BASE}/queue/videos/pending`)
  expect(Array.isArray(pending.data)).toBe(true)
  const found = pending.data.find((i: any) => i.id === 'test123')
  expect(found).toBeDefined()

  const mark = await axios.post(`${BASE}/queue/videos/mark-done`, { id: 'test123' })
  expect(mark.data.ok).toBe(true)

  const pending2 = await axios.get(`${BASE}/queue/videos/pending`)
  const still = pending2.data.find((i: any) => i.id === 'test123')
  expect(still).toBeUndefined()
})

}

>>>>>>> IMPORT (TEXT)
