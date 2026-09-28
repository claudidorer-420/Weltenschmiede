// Sicherheits-Header aus _headers (Cloudflare-Format) – für tools/serve.mjs und die Veröffentlichung.
// Die Import-Map in index.html ist ein Inline-Skript; ihr Hash wird hier für die CSP eingesetzt
// ('sha256-IMPORTMAP' in _headers). Ändert sich die Import-Map, passt sich der Hash automatisch an.
// Aufruf:  node tools/headers.mjs .deploy   → schreibt .deploy/_headers mit eingesetztem Hash
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function importmapHash(html) {
  // Browser werten CRLF als LF, bevor sie den Hash bilden
  const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html.replace(/\r\n?/g, '\n'));
  if (!m) throw new Error('Import-Map in index.html nicht gefunden.');
  return `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
}

export function renderHeaders(dir) {
  const raw = readFileSync(join(dir, '_headers'), 'utf8').replace(/\r\n?/g, '\n');
  return raw.split("'sha256-IMPORTMAP'").join(importmapHash(readFileSync(join(dir, 'index.html'), 'utf8')));
}

// → [{ pattern: '/assets/*', headers: [['Cache-Control', '…']] }]
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
    else if (rules.length) {
      const i = line.indexOf(':');
      if (i > 0) rules.at(-1).headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function headersFor(rules, path) {
  const out = {};
  for (const r of rules) {
    const p = r.pattern;
    const hit = p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p;
    if (hit) for (const [k, v] of r.headers) out[k.toLowerCase()] = v;
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Ordner angeben, z. B. node tools/headers.mjs .deploy');
  writeFileSync(join(dir, '_headers'), renderHeaders(dir));
  console.log(`_headers geschrieben (${importmapHash(readFileSync(join(dir, 'index.html'), 'utf8'))})`);
}
