<<<<<<< REPO
<<<<<<< REPO
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const hasCsvParse = (() => { try { require.resolve('csv-parse/lib/sync'); return true } catch { return false } })()

const PROJECT_ROOT = process.cwd()
const CSV_PATH = path.join(PROJECT_ROOT, 'data', '30_shorts.csv')
const BACKUP = path.join(PROJECT_ROOT, 'data', '30_shorts.csv.bak')
const OUT_DIR = path.join(PROJECT_ROOT, 'data', 'staging', 'texts')

beforeAll(() => {
  // backup original CSV
  if (fs.existsSync(CSV_PATH)) fs.copyFileSync(CSV_PATH, BACKUP)
})

afterAll(() => {
  // restore original CSV and clean up staging output
  if (fs.existsSync(BACKUP)) fs.copyFileSync(BACKUP, CSV_PATH)
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  try { fs.rmSync(path.join(PROJECT_ROOT, 'data', 'queue_db'), { recursive: true, force: true }) } catch (e) {}
})

if (!hasCsvParse) {
  test.skip('csv-parse not installed, skipping csv_to_staging tests', () => {})
} else {
  test('csv_to_staging writes JSON files for small CSV', () => {
  // write small CSV
  const csv = `id,topic,script,title,description,tags,platforms,duration_seconds\nTEST001,Topic A,"Hello world","Title A",desc,"tag1,tag2",youtube,10\nTEST002,Topic B,"Hello again","Title B",desc2,"tag3",x,9\n`
  fs.writeFileSync(CSV_PATH, csv)

  // remove out dir and run script
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) {}
  execFileSync('node', ['tools/csv_to_staging.js'], { stdio: 'inherit' })

  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []
  expect(files.length).toBe(2)
  const f1 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'TEST001.json'), 'utf8'))
  expect(f1.id).toBe('TEST001')
  expect(f1.script).toMatch(/Hello world/)
  })
}

=======
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const hasCsvParse = (() => { try { require.resolve('csv-parse/lib/sync'); return true } catch { return false } })()

const PROJECT_ROOT = process.cwd()
const CSV_PATH = path.join(PROJECT_ROOT, 'data', '30_shorts.csv')
const BACKUP = path.join(PROJECT_ROOT, 'data', '30_shorts.csv.bak')
const OUT_DIR = path.join(PROJECT_ROOT, 'data', 'staging', 'texts')

beforeAll(() => {
  // backup original CSV
  if (fs.existsSync(CSV_PATH)) fs.copyFileSync(CSV_PATH, BACKUP)
})

afterAll(() => {
  // restore original CSV and clean up staging output
  if (fs.existsSync(BACKUP)) fs.copyFileSync(BACKUP, CSV_PATH)
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  try { fs.rmSync(path.join(PROJECT_ROOT, 'data', 'queue_db'), { recursive: true, force: true }) } catch (e) {}
})

if (!hasCsvParse) {
  test.skip('csv-parse not installed, skipping csv_to_staging tests', () => {})
} else {
  test('csv_to_staging writes JSON files for small CSV', () => {
  // write small CSV
  const csv = `id,topic,script,title,description,tags,platforms,duration_seconds\nTEST001,Topic A,"Hello world","Title A",desc,"tag1,tag2",youtube,10\nTEST002,Topic B,"Hello again","Title B",desc2,"tag3",x,9\n`
  fs.writeFileSync(CSV_PATH, csv)

  // remove out dir and run script
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) {}
  execFileSync('node', ['tools/csv_to_staging.js'], { stdio: 'inherit' })

  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []
  expect(files.length).toBe(2)
  const f1 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'TEST001.json'), 'utf8'))
  expect(f1.id).toBe('TEST001')
  expect(f1.script).toMatch(/Hello world/)
  })
}

>>>>>>> IMPORT (TEXT)

=======
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const hasCsvParse = (() => { try { require.resolve('csv-parse/lib/sync'); return true } catch { return false } })()

const PROJECT_ROOT = process.cwd()
const CSV_PATH = path.join(PROJECT_ROOT, 'data', '30_shorts.csv')
const BACKUP = path.join(PROJECT_ROOT, 'data', '30_shorts.csv.bak')
const OUT_DIR = path.join(PROJECT_ROOT, 'data', 'staging', 'texts')

beforeAll(() => {
  // backup original CSV
  if (fs.existsSync(CSV_PATH)) fs.copyFileSync(CSV_PATH, BACKUP)
})

afterAll(() => {
  // restore original CSV and clean up staging output
  if (fs.existsSync(BACKUP)) fs.copyFileSync(BACKUP, CSV_PATH)
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  try { fs.rmSync(path.join(PROJECT_ROOT, 'data', 'queue_db'), { recursive: true, force: true }) } catch (e) {}
})

if (!hasCsvParse) {
  test.skip('csv-parse not installed, skipping csv_to_staging tests', () => {})
} else {
  test('csv_to_staging writes JSON files for small CSV', () => {
  // write small CSV
  const csv = `id,topic,script,title,description,tags,platforms,duration_seconds\nTEST001,Topic A,"Hello world","Title A",desc,"tag1,tag2",youtube,10\nTEST002,Topic B,"Hello again","Title B",desc2,"tag3",x,9\n`
  fs.writeFileSync(CSV_PATH, csv)

  // remove out dir and run script
  try { fs.rmSync(OUT_DIR, { recursive: true, force: true }) } catch (e) {}
  execFileSync('node', ['tools/csv_to_staging.js'], { stdio: 'inherit' })

  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []
  expect(files.length).toBe(2)
  const f1 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'TEST001.json'), 'utf8'))
  expect(f1.id).toBe('TEST001')
  expect(f1.script).toMatch(/Hello world/)
  })
}

>>>>>>> IMPORT (TEXT)
