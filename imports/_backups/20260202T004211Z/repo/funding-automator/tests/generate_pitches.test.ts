<<<<<<< REPO
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const QUEUE_DIR = path.join(process.cwd(), 'data', 'staging', 'funding_queue')

beforeAll(() => {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
})

afterAll(() => {
  try { fs.rmSync(QUEUE_DIR, { recursive: true, force: true }) } catch (e) { }
})

test('generate_pitches creates pitch JSON for queued item', async () => {
  const item = { id: 'lead-test-1', org: 'TestFund', notes: 'early-stage grant' }
  const fn = path.join(QUEUE_DIR, `${item.id}.json`)
  fs.writeFileSync(fn, JSON.stringify(item, null, 2))

  // run the generator (will fallback to local variants if no LLM present)
  execFileSync('node', ['tools/generate_pitches.js'], { stdio: 'inherit' })

  const outPath = path.join(QUEUE_DIR, `${item.id}.pitch.json`)
  // allow a short retry period for the file to be written
  let exists = fs.existsSync(outPath)
  const start = Date.now()
  while (!exists && (Date.now() - start) < 2000) {
    await new Promise(r => setTimeout(r, 100))
    exists = fs.existsSync(outPath)
  }
  expect(exists).toBe(true)
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  expect(out.id).toBe(item.id)
  expect(Array.isArray(out.variants)).toBe(true)
  expect(out.variants.length).toBeGreaterThanOrEqual(1)
})

=======
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const QUEUE_DIR = path.join(process.cwd(), 'data', 'staging', 'funding_queue')

beforeAll(() => {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
})

afterAll(() => {
  try { fs.rmSync(QUEUE_DIR, { recursive: true, force: true }) } catch (e) { }
})

test('generate_pitches creates pitch JSON for queued item', async () => {
  const item = { id: 'lead-test-1', org: 'TestFund', notes: 'early-stage grant' }
  const fn = path.join(QUEUE_DIR, `${item.id}.json`)
  fs.writeFileSync(fn, JSON.stringify(item, null, 2))

  // run the generator (will fallback to local variants if no LLM present)
  execFileSync('node', ['tools/generate_pitches.js'], { stdio: 'inherit' })

  const outPath = path.join(QUEUE_DIR, `${item.id}.pitch.json`)
  // allow a short retry period for the file to be written
  let exists = fs.existsSync(outPath)
  const start = Date.now()
  while (!exists && (Date.now() - start) < 2000) {
    await new Promise(r => setTimeout(r, 100))
    exists = fs.existsSync(outPath)
  }
  expect(exists).toBe(true)
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  expect(out.id).toBe(item.id)
  expect(Array.isArray(out.variants)).toBe(true)
  expect(out.variants.length).toBeGreaterThanOrEqual(1)
})

>>>>>>> IMPORT (TEXT)
