// Was sehen die Spieler? Lichtkarte, Sichtfeld (Sichtlinie + Dunkelsicht) und erkundetes Gebiet.
// Wird von der Kartenansicht benutzt: unerkundet = schwarz, erkundet aber gerade nicht sichtbar = 40 % dunkel (ERKUNDET_DUNKEL).
import { pointInSight, rayFree, CELL_M } from './tactics.js';

export const DARK_M = 18;                 // Dunkelsicht der meisten Völker: 18 m
// Erkundet, aber gerade nicht im Blick: so stark abgedunkelt (0 = gar nicht, 1 = schwarz)
export const ERKUNDET_DUNKEL = 0.4;
export const cellsOf = (m) => (Number(m) || 0) / CELL_M;
const idx = (w, x, y) => y * w + x;

// Lichtstärke je Feld: 2 = helles Licht, 1 = dämmriges Licht, 0 = Dunkelheit.
// Grundlicht aus der Stimmung der Karte (doc.dark): draußen ist leichte Dämmerung noch Tag (< 0,45),
// bis 0,7 dämmrig, darüber Nacht. Drinnen ist ein kaum verdunkelter Raum (≤ 0,25) dämmrig beleuchtet,
// sonst zählen nur die Lichtquellen.
export function grundLicht(doc) {
  const d = Number(doc.dark) || 0;
  if (doc.outdoor) return d < 0.45 ? 2 : d < 0.7 ? 1 : 0;
  return d <= 0.25 ? 1 : 0;
}
export function lightMap(doc, grid, { glows = [] } = {}) {
  const W = grid.w;
  const H = grid.h;
  const out = new Uint8Array(W * H);
  const grund = grundLicht(doc);
  if (grund) out.fill(grund);
  const quellen = [
    ...(doc.lights || []).map((l) => ({ x: l.x, y: l.y, r: Number(l.r) || 4 })),
    ...glows.map((g) => ({ x: g.x, y: g.y, r: Number(g.r) || 3 })),
  ];
  for (const q of quellen) {
    const r = Math.max(0.5, q.r);
    const x0 = Math.max(0, Math.floor(q.x - r * 2 - 1));
    const x1 = Math.min(W - 1, Math.ceil(q.x + r * 2 + 1));
    const y0 = Math.max(0, Math.floor(q.y - r * 2 - 1));
    const y1 = Math.min(H - 1, Math.ceil(q.y + r * 2 + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(W, x, y);
        if (out[i] === 2) continue;
        const d = Math.hypot(x + 0.5 - q.x, y + 0.5 - q.y);
        if (d > r * 2) continue;
        // Licht endet an Wänden
        if (!pointInSight(grid, { x: Math.floor(q.x), y: Math.floor(q.y), size: 1 }, x + 0.5, y + 0.5)) continue;
        out[i] = Math.max(out[i], d <= r ? 2 : 1);
      }
    }
  }
  return out;
}

// Sichtfeld aller Betrachter (Tokens der Gruppe).
// viewer: { x, y, size, dark } – dark = Dunkelsicht in Feldern.
// limit: Sichtweite in Feldern (0 = unbegrenzt, z. B. Nebel oder Regen).
// Blickstrahlen gehen von der Mitte der Figur aus – ein Feld gilt als gesehen, sobald
// irgendein Punkt darin getroffen wird (Mitte oder eine der vier Ecken). Dadurch franst die
// Sicht nicht in Quadraten aus, sondern läuft an Kanten sauber entlang.
const ZIELE = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]];

// viewer.dir (Grad, 0 = rechts) + viewer.fov (Grad): nur ein Kegel in Blickrichtung ist sichtbar – das eigene Feld immer
const imKegel = (v, cx, cy, px, py) => {
  if (v.dir == null || !v.fov || v.fov >= 360) return true;
  const a = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  const diff = Math.abs((((a - v.dir) % 360) + 540) % 360 - 180);
  return diff <= v.fov / 2 + 0.5;
};
export function visibleCells(grid, licht, viewers, { limit = 0 } = {}) {
  const W = grid.w;
  const H = grid.h;
  const out = new Uint8Array(W * H);
  if (!viewers?.length) return out;
  const max = limit > 0 ? limit : Math.max(W, H) + 2;
  for (const v of viewers) {
    const n = v.size || 1;
    const cx = v.x + n / 2;
    const cy = v.y + n / 2;
    const x0 = Math.max(0, Math.floor(cx - max - 1));
    const x1 = Math.min(W - 1, Math.ceil(cx + max + 1));
    const y0 = Math.max(0, Math.floor(cy - max - 1));
    const y1 = Math.min(H - 1, Math.ceil(cy + max + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(W, x, y);
        if (out[i]) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > max) continue;
        // Im Dunkeln reicht nur die Dunkelsicht; beleuchtete Felder sieht man, solange die Sicht frei ist
        if (!licht[i] && d > (v.dark || 0)) continue;
        if (d <= 0.8 || (x >= v.x && x < v.x + n && y >= v.y && y < v.y + n)) { out[i] = 1; continue; }
        if (ZIELE.some(([fx, fy]) => imKegel(v, cx, cy, x + fx, y + fy) && rayFree(grid, cx, cy, x + fx, y + fy))) out[i] = 1;
      }
    }
  }
  return out;
}

// Sieht die Gruppe diese Figur? Es reicht, wenn irgendein Feld der Figur im Blick liegt –
// ein Troll verschwindet nicht, nur weil seine linke obere Ecke hinter einer Wand steckt.
export function tokenVisible(sicht, w, t) {
  if (!sicht) return true;
  const n = t.size || 1;
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      const i = (t.y + dy) * w + t.x + dx;
      if (sicht[i]) return true;
    }
  }
  return false;
}

// Erkundetes Gebiet je Karte und Nutzer – liegt im Gerätespeicher, wächst nur an
const KEY = (cid, mapId) => `ws.explored.${cid}.${mapId}`;

export function loadExplored(cid, mapId, size) {
  try {
    const raw = localStorage.getItem(KEY(cid, mapId)) || '';
    const a = new Uint8Array(size);
    for (let i = 0; i < Math.min(size, raw.length); i++) if (raw[i] === '1') a[i] = 1;
    return a;
  } catch {
    return new Uint8Array(size);
  }
}

export function saveExplored(cid, mapId, arr) {
  try {
    localStorage.setItem(KEY(cid, mapId), Array.from(arr, (v) => (v ? '1' : '0')).join(''));
  } catch { /* Speicher voll: dann eben nur für diese Sitzung */ }
}

// Sichtbares ins Gedächtnis übernehmen; gibt true zurück, wenn etwas Neues dazukam
export function rememberSeen(explored, visible) {
  let neu = false;
  for (let i = 0; i < visible.length; i++) if (visible[i] && !explored[i]) { explored[i] = 1; neu = true; }
  return neu;
}

// Hat die Gruppe diese Karte schon betreten? (für die Kartenliste der Spieler)
export const wasExplored = (cid, mapId) => {
  try { return (localStorage.getItem(KEY(cid, mapId)) || '').includes('1'); } catch { return false; }
};

// Dunkelsicht in Metern: aus dem Sinnestext eines Statblocks oder aus dem Volkseintrag (Fuß)
export function darkMeters({ senses = '', feet = 0 } = {}) {
  const m = /Dunkelsicht\s*(\d+(?:[.,]\d+)?)\s*m/i.exec(String(senses));
  if (m) return parseFloat(m[1].replace(',', '.'));
  const f = /darkvision\s*(\d+)\s*(?:ft|feet)/i.exec(String(senses));
  if (f) return Number(f[1]) * 0.3;
  return Number(feet) ? Number(feet) * 0.3 : 0;
}

// Wetter und Umgebung begrenzen die Sicht im Freien (Meter, 0 = so weit das Auge reicht)
export const SIGHT_LIMITS = [
  { value: 0, label: 'Klare Sicht (bis zum Horizont)' },
  { value: 1600, label: 'Regen oder leichter Nebel (1,5 km)' },
  { value: 90, label: 'Dichter Nebel (90 m)' },
  { value: 30, label: 'Sturm oder dichtes Schneetreiben (30 m)' },
  { value: 18, label: 'Undurchdringlicher Nebel (18 m)' },
];

// ───────── Dächer ─────────
// Ein Haus, in dem noch niemand aus der Gruppe war, bleibt ganz verdeckt. Steht jemand drin, verschwindet das Dach;
// danach deckt es nur noch zu ROOF_SEEN – man ahnt das Innere, wie bei schon erkundetem Gebiet.
export const ROOF_SEEN = 0.8;
const RKEY = (cid, mapId) => `ws.roofs.${cid}.${mapId}`;
export function loadRoofs(cid, mapId) {
  try { return new Set(JSON.parse(localStorage.getItem(RKEY(cid, mapId)) || '[]')); } catch { return new Set(); }
}
export function saveRoofs(cid, mapId, set) {
  try { localStorage.setItem(RKEY(cid, mapId), JSON.stringify([...set])); } catch { /* egal */ }
}
// Deckkraft eines Dachs: inside = gerade jemand aus der Gruppe drin, seen = schon einmal betreten, gm = Sicht der SL
export function roofAlpha({ inside, seen, gm }) {
  if (gm) return inside ? 0.15 : 0.4;
  if (inside) return 0;
  return seen ? ROOF_SEEN : 1;
}

// Rohdaten des erkundeten Gebiets (für die maskierte Vorschau in der Kartenliste)
export function exploredBits(cid, mapId) {
  try { return localStorage.getItem(KEY(cid, mapId)) || ''; } catch { return ''; }
}
