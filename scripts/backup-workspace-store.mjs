/**
 * One-time, read-only backup of the GSD Config Manager workspace store.
 *
 * Copies the whole app-data root to a timestamped sibling directory and
 * verifies the copy by byte-comparing every file. Touches nothing the app
 * owns, and is safe to re-run (each run makes a new timestamped copy).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const LOCALAPPDATA = process.env.LOCALAPPDATA;
if (!LOCALAPPDATA) {
  console.error('LOCALAPPDATA not set');
  process.exit(1);
}

const APP_NAMES = ['open-gsd-core-config-manager', 'gsd-config-manager'];
const BACKUP_PARENT = join(LOCALAPPDATA, 'gsd-config-manager-backups');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function listFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

const dest = join(BACKUP_PARENT, stamp());
mkdirSync(dest, { recursive: true });

let totalFiles = 0;
let totalBytes = 0;
const results = [];

for (const name of APP_NAMES) {
  const src = join(LOCALAPPDATA, name);
  if (!existsSync(src)) {
    results.push({ name, status: 'absent (nothing to back up)' });
    continue;
  }
  const files = listFiles(src);
  for (const f of files) {
    const rel = relative(src, f);
    const to = join(dest, name, rel);
    mkdirSync(join(to, '..'), { recursive: true });
    copyFileSync(f, to);
    const a = readFileSync(f);
    const b = readFileSync(to);
    const identical = a.equals(b);
    totalFiles++;
    totalBytes += a.length;
    results.push({
      name,
      rel,
      bytes: a.length,
      verify: identical ? 'OK byte-identical' : 'MISMATCH',
    });
  }
}

console.log('Backup destination: ' + dest);
console.log('');
for (const r of results) {
  if (r.status) console.log('  [ ' + r.name + ' ] ' + r.status);
  else console.log('  ' + (r.verify === 'OK byte-identical' ? '[ok]' : '[!!]') + ' ' + r.name + ' :: ' + r.rel + ' (' + r.bytes + 'b) ' + r.verify);
}
console.log('');
console.log('Files copied: ' + totalFiles + '  (' + totalBytes + ' bytes)');
const bad = results.filter((r) => r.verify && r.verify !== 'OK byte-identical');
console.log(bad.length === 0 ? 'VERIFIED: every copied file is byte-identical.' : 'FAILED: ' + bad.length + ' mismatches.');
process.exit(bad.length === 0 ? 0 : 1);
