import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  console.log('[fetch-and-commit] running fetch_x3vm_metadata');
  execSync('ts-node scripts/fetch_x3vm_metadata.ts', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  const metaPath = path.join(__dirname, '../metadata.json');
  if (fs.existsSync(metaPath)) {
    console.log('[fetch-and-commit] metadata.json exists; adding to git');
    execSync('git add metadata.json && git commit -m "chore(x3vm): add runtime metadata snapshot" || true', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  } else {
    console.warn('[fetch-and-commit] metadata.json not found, skipping commit');
  }
} catch (err:any) {
  console.error('[fetch-and-commit] failed', err.message || err);
  process.exit(1);
}