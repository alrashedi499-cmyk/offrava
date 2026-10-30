// Makes the "live update" for the Offrava app: a zip of the app's screens (HTML/JS/CSS/JSON) + live/live.json.
// The app checks live.json when it opens; if there's a newer bundle it downloads it and switches on the next start —
// no App Store / Google Play review needed for screen changes. Run by .github/workflows/live-update.yml on every push.
// Native changes (new permissions or plugins) still need a store update: raise "offravaNative" in app/package.json,
// and older apps stop receiving web bundles that need the newer native app.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash, sign as cryptoSign } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..');
const tmp = join(site, '.live-tmp');
const out = join(site, 'live');
const SKIP = new Set(['app', 'supabase', '.github', '.git', 'node_modules', 'www', 'live', 'models', '.live-tmp']);
const OK = /\.(html|js|css|json|png|jpg|jpeg|svg|webp|ico|woff2?)$/i;
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true }); mkdirSync(out, { recursive: true });
for (const name of readdirSync(site)) {
  if (SKIP.has(name) || /secret|DO-NOT-UPLOAD/i.test(name) || name.startsWith('.')) continue;
  const from = join(site, name);
  if (!statSync(from).isDirectory() && OK.test(name)) cpSync(from, join(tmp, name));
}
if (!existsSync(join(tmp, 'index.html'))) throw new Error('index.html missing');
const sha = (process.env.GITHUB_SHA || Date.now().toString(16)).slice(0, 7);
const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '-' + sha;   // e.g. 202610291530-a1b2c3d
const zip = `offrava-${version}.zip`;
execSync(`cd "${tmp}" && zip -qr "${join(out, zip)}" .`);
rmSync(tmp, { recursive: true, force: true });
const checksum = createHash('sha256').update(readFileSync(join(out, zip))).digest('hex');
// Signed with Offrava's private key (GitHub secret LIVE_SIGNING_KEY). The app only installs bundles whose signature checks out
// with the public key built into it — so nobody who can change the website alone can push code into the app.
const key = process.env.LIVE_SIGNING_KEY;
if (!key) throw new Error('LIVE_SIGNING_KEY secret is missing — the app would refuse an unsigned bundle');
const manifest = { version, url: `live/${zip}`, checksum, min_native: pkg.offravaNative || '1.0.0' };
const msg = `${manifest.version}|${manifest.url}|${manifest.checksum}|${manifest.min_native}`;
const sig = cryptoSign('sha256', Buffer.from(msg), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');
writeFileSync(join(out, 'live.json'), JSON.stringify({ ...manifest, sig, at: new Date().toISOString() }, null, 2));
// keep only the 3 newest bundles
const zips = readdirSync(out).filter((f) => /^offrava-.*\.zip$/.test(f)).sort().reverse();
for (const f of zips.slice(3)) rmSync(join(out, f));
console.log('live update ready:', version, checksum.slice(0, 12));
