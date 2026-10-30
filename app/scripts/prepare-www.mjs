// Copies the Offrava website (one folder up) into app/www for the iPhone/Android app.
// Only the files the app needs — never secrets, the database folder or this app folder.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..');
const www = join(here, '..', 'www');
const SKIP = new Set(['app', 'supabase', '.github', '.git', 'node_modules', 'www', 'live']);
const OK = /\.(html|js|css|json|png|jpg|jpeg|svg|webp|ico|onnx|woff2?)$/i;

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
let n = 0;
for (const name of readdirSync(site)) {
  if (SKIP.has(name) || /secret|DO-NOT-UPLOAD/i.test(name) || name.startsWith('.')) continue;
  const from = join(site, name);
  if (statSync(from).isDirectory()) {
    if (name === 'models') { cpSync(from, join(www, name), { recursive: true }); n++; }
    continue;
  }
  if (OK.test(name)) { cpSync(from, join(www, name)); n++; }
}
if (!existsSync(join(www, 'index.html'))) throw new Error('index.html missing — run from the Offrava repo');
console.log(`www ready: ${n} files/folders copied`);
