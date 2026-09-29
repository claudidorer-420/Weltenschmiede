// Kartenwerkstatt ohne Oberfläche: Stile, Geländematerialien, Stempel-Sets und Generatoren.
// Wird vom Karten-Editor und vom MCP-Server (mcp/) gemeinsam genutzt – hier darf beim Laden nichts das DOM anfassen.
import { uid, randInt, clamp } from '../lib/util.js';
import { STAMPS } from '../data/mapassets.js';
import { REAL_INK, PROC } from './maprender.js';

export const STYLES = {
  real: { label: 'Realistisch', real: true, bg: '#0a0b0d', hatch: '#000000', floor: '#8d8172', grid: 'rgba(0,0,0,.28)', wall: '#1a1714', ink: REAL_INK.ink, halo: REAL_INK.halo, hatchKind: 'none' },
  bild: { label: 'Bildkarte', image: true, bg: '#0a0b0d', hatch: '#000000', floor: '#8d8172', grid: 'rgba(0,0,0,.4)', wall: '#1a1714', ink: REAL_INK.ink, halo: REAL_INK.halo, hatchKind: 'none' },
  klassisch: { label: 'Klassisch', bg: '#f3efe6', hatch: '#3b3b3b', floor: '#ffffff', grid: 'rgba(80,70,60,.3)', wall: '#1d1d1d', ink: '#222222', halo: '#ffffff', hatchKind: 'lines' },
  pergament: { label: 'Pergament', bg: '#e6d5b1', hatch: '#6a4e2b', floor: '#f7eed8', grid: 'rgba(110,80,40,.28)', wall: '#3a2915', ink: '#3a2915', halo: '#f7eed8', hatchKind: 'cross' },
  blaupause: { label: 'Oldschool blau', bg: '#ffffff', hatch: '#2f67b1', floor: '#ffffff', grid: 'rgba(47,103,177,.4)', wall: '#2f67b1', ink: '#1f4f95', halo: '#ffffff', hatchKind: 'grid' },
  dunkel: { label: 'Dunkel (Spieltisch)', bg: '#101014', hatch: '#2b2b36', floor: '#4a433b', grid: 'rgba(255,255,255,.1)', wall: '#050506', ink: '#f1e7d0', halo: '#15120f', hatchKind: 'lines' },
};
export const isReal = (m) => !!(STYLES[m?.style] || STYLES.klassisch).real;
export const isImageMap = (m) => !!(STYLES[m?.style] || STYLES.klassisch).image;

// Klassische Gelände-Materialien (Vektorstile). Im realistischen Stil kommen Texturen und Flüssigkeiten dazu.
export const MATS = {
  water: { label: 'Wasser', color: '#77b1dc', deep: '#3f7fb4' },
  lava: { label: 'Lava', color: '#e2622f', deep: '#a8321a' },
  grass: { label: 'Gras', color: '#a8cc88', deep: '#6f9b52' },
  rubble: { label: 'Geröll', color: '#c3b8ab', deep: '#7d7166' },
  sand: { label: 'Sand', color: '#e7d6a2', deep: '#c2a664' },
  ice: { label: 'Eis', color: '#d4ebf5', deep: '#8fbfd8' },
  pit: { label: 'Grube', color: '#1a1a1a', deep: '#000000' },
  blood: { label: 'Blut/Schleim', color: '#8c1d1d', deep: '#5a0e0e' },
  difficult: { label: 'Schwieriges Gelände', color: 'rgba(0,0,0,0)', deep: '#7a5a2a' },
};

// ───────────────────────── Generatoren ─────────────────────────
export const r2 = (v) => Math.round(v * 100) / 100;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const TAU = Math.PI * 2;
export const stampAt = (a, x, y, o = {}) => ({ id: uid(6), t: 'stamp', a, x: r2(x), y: r2(y), r: Math.round(o.r || 0), s: r2(o.s ?? 1), ...(o.fx ? { fx: 1 } : {}), ...(o.layer ? { layer: o.layer } : {}) });
export const ids = (re) => STAMPS.filter((s) => re.test(s.id)).map((s) => `ph:${s.id}`);
// Stempel-Sets für Generatoren und den Streu-Pinsel
export const SETS = {
  laubbaum: { label: 'Laubbäume', keys: ids(/^(island_tree|tree_small_02|searsia_)/), s: [0.7, 1.15] },
  nadelbaum: { label: 'Nadelbäume', keys: ids(/^(fir_tree_01|pine_tree_01)/), s: [0.6, 1] },
  jungbaum: { label: 'Junge Bäume', keys: ids(/^(fir_sapling_medium|pine_sapling_medium|quiver_tree)/), s: [0.7, 1.1] },
  busch: { label: 'Büsche', keys: ids(/^(shrub_0[124]|wild_rooibos_bush|didelta_spinosa)/), s: [0.8, 1.6] },
  farn: { label: 'Farne & Kraut', keys: ids(/^(fern_02|othonna_cerarioides|weed_plant)/), s: [1, 2.2] },
  gras: { label: 'Grasbüschel', keys: ids(/^grass_medium/), s: [1.4, 3] },
  blume: { label: 'Blumen', keys: ids(/^(flower_|dandelion_01|celandine_01|periwinkle_plant)/), s: [1.2, 2.4] },
  fels: { label: 'Steine', keys: ids(/^(rock_moss_set_02|namaqualand_boulder|boulder_01)/), s: [0.7, 1.4] },
  felsen: { label: 'Felsen', keys: ids(/^(rock_moss_set_01|coast_rocks_05|rock_face_0|sand_rocks_small)/), s: [0.6, 1.1] },
  wurzel: { label: 'Stümpfe & Wurzeln', keys: ids(/^(tree_stump|dead_tree_trunk|root_cluster|pine_roots)/), s: [0.8, 1.3] },
  reisig: { label: 'Äste & Rinde', keys: ids(/^(dry_branches|bark_debris)/), s: [1.2, 2.6] },
  truemmer: { label: 'Trümmer & Knochen', keys: ['p:rubble', 'p:bones', 'p:skull', ...ids(/^namaqualand_boulders_01/)], s: [0.7, 1.3] },
};
export const FASS = ids(/^(wine_barrel_01|wooden_barrels_01_[a-e])/);
export const KISTE = ids(/^(wooden_crate_0|wooden_military_crate|old_military_crate)/);
export const STUHL = ids(/^(woodenchair_01|painted_wooden_chair_02|gallinera_chair|wooden_stool_01|folding_wooden_stool)/);
export const TISCH = ids(/^(round_wooden_table_0|woodentable_0|wooden_table_02)/);
export const KRAM = ids(/^(wooden_bucket|wicker_basket|ceramic_pot|jug_01|brass_pot|wooden_bowl_01|tea_set_01|carved_wooden_plate)/);
const LEHNSTUHL = ids(/^(woodenchair_01|painted_wooden_chair_02|gallinera_chair|dining_chair_02)$/);
const HOCKER = ids(/^(wooden_stool_01|folding_wooden_stool|bar_chair_round_01|painted_wooden_stool)$/);
const RUNDTISCH = ids(/^round_wooden_table_0[12]$/);
const ECKTISCH = ids(/^(woodentable_01|woodentable_03|wooden_table_02|small_wooden_table_01)$/);
const LANGTISCH = ids(/^(dining_table|painted_wooden_table)$/);
const REGAL = ids(/^(shelf_01|painted_wooden_shelves|wooden_bookshelf_worn)$/);
const SCHRANK = ids(/^(gothiccabinet_01|painted_wooden_cabinet|painted_wooden_cabinet_02|drawer_cabinet|gothiccommode_01|vintage_cabinet_01)$/);
const BETT = ids(/^(gothicbed_01|old_bed_frame)$/);
const SACK = ids(/^(wicker_basket_0|ceramic_pot|wooden_bucket_0)/);
const KERZEN = ['ph:kerzenleuchter_boden'];
const TROPHAE = ids(/^(bull_head|lion_head|horse_head|kite_shield)$/);
const SPIEL = ids(/^(chess_set|sungka_board_02)$/);
const LEUCHTER = ids(/^(chandelier_01|chandelier_03|lantern_chandelier_01)$/);
const DACH = ['thatch_roof_angled', 'clay_roof_tiles', 'roof_slates_02', 'reed_roof_03', 'roof_planks', 'clay_roof_tiles_02', 'clay_roof_tiles_03', 'ceramic_roof_01'];

// Grundgerüst: jeder Generator setzt alle Karteneigenschaften, damit beim Wechsel nichts hängen bleibt
export const base = (o) => ({ shapes: [], terrain: [], objects: [], labels: [], lights: [], outdoor: false, ground: 'dark_rock', floorTex: 'stone_tiles', wallTex: 'castle_brick_01', dark: 0, ...o });
// Zufällig streuen
export function scatter(out, set, n, fn) {
  const S = SETS[set];
  if (!S?.keys.length) return;
  for (let i = 0; i < n; i++) {
    const p = fn(i);
    if (!p) continue;
    out.push(stampAt(pick(S.keys), p.x, p.y, { r: randInt(0, 359), s: rnd(S.s[0], S.s[1]) * (p.s || 1), fx: Math.random() < 0.5 }));
  }
}

// ───────────────────────── Bausteine: Maße, Ausrichtung, Platz ─────────────────────────
// Alle Möbel schauen bei r = 0 nach Süden (Rückseite nach Norden) – so stehen sie an der Nordwand richtig.
const DIMS = new Map(STAMPS.map((s) => [`ph:${s.id}`, [s.w, s.h]]));
export function dimsOf(key) {
  const k = String(key || '');
  if (DIMS.has(k)) return DIMS.get(k);
  const p = k.startsWith('p:') ? PROC[k.slice(2)] : null;
  return p ? [p.w, p.h] : [1, 1];
}
// Blickrichtung (fx, fy) → Drehung in Grad
export const faceTo = (fx, fy) => (Math.round((Math.atan2(-fx, fy) * 180) / Math.PI) + 360) % 360;
const WAND = { n: 0, s: 180, w: 270, e: 90 };
const GEGEN = { n: 's', s: 'n', w: 'e', e: 'w' };
const SEITEN = ['n', 's', 'w', 'e'];
const mischen = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Umriss eines gedrehten Stempels (achsparallel, in Feldern)
function box(key, x, y, r, s, pad = 0) {
  const [w0, h0] = dimsOf(key);
  const a = (r * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const n = Math.abs(Math.sin(a));
  const w = (w0 * c + h0 * n) * s;
  const h = (w0 * n + h0 * c) * s;
  return [x - w / 2 - pad, y - h / 2 - pad, x + w / 2 + pad, y + h / 2 + pad];
}

// Belegungsraster in Viertelfeldern: verhindert, dass Möbel übereinander, in Türen oder in Wänden landen
export class Platz {
  constructor(W, H, res = 4) { this.W = W; this.H = H; this.r = res; this.a = new Uint8Array(W * H * res * res); }
  each(b, fn) {
    const r = this.r;
    const x0 = Math.max(0, Math.floor(b[0] * r + 1e-6));
    const y0 = Math.max(0, Math.floor(b[1] * r + 1e-6));
    const x1 = Math.min(this.W * r, Math.ceil(b[2] * r - 1e-6));
    const y1 = Math.min(this.H * r, Math.ceil(b[3] * r - 1e-6));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (fn(y * this.W * r + x) === false) return false;
    return true;
  }
  frei(b) { return b[0] >= 0 && b[1] >= 0 && b[2] <= this.W && b[3] <= this.H && this.each(b, (i) => !this.a[i]); }
  nimm(b) { this.each(b, (i) => { this.a[i] = 1; }); }
  // nur Felder, für die fn(x, y) wahr ist, dürfen belegt werden
  nurIn(fn) {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (!fn(x, y)) this.nimm([x, y, x + 1, y + 1]);
    return this;
  }
}

// Stempel setzen, wenn der Platz frei ist → Objekt oder null
function setze(out, P, key, x, y, { r = 0, s = 1, pad = 0.04, fx = false, layer, mark = true, check = true } = {}) {
  if (!key) return null;
  const b = box(key, x, y, r, s, pad);
  if (P && check && !P.frei(b)) return null;
  if (P && mark) P.nimm(b);
  const o = stampAt(key, x, y, { r, s, fx, layer });
  out.push(o);
  return o;
}
// Rücken an eine Wand des Raums R = { x, y, w, h } (seite n|s|w|e, at = 0 … 1 entlang der Wand)
function anWand(out, P, R, key, { s = 1, seite = null, at = null, tries = 24, gap = 0.06, pad = 0.04 } = {}) {
  const [w0, h0] = dimsOf(key);
  const len = w0 * s;
  const dep = h0 * s;
  for (let t = 0; t < tries; t++) {
    const sd = seite || pick(SEITEN);
    const quer = sd === 'n' || sd === 's';
    const span = quer ? R.w : R.h;
    if (len > span - 0.2) { if (seite) return null; continue; }
    const lo = len / 2 + 0.1;
    const hi = span - len / 2 - 0.1;
    const u = clamp(Math.round((at != null ? lo + (hi - lo) * clamp(at + (t ? rnd(-0.15, 0.15) : 0), 0, 1) : rnd(lo, hi)) * 2) / 2, lo, hi);
    const x = quer ? R.x + u : sd === 'w' ? R.x + dep / 2 + gap : R.x + R.w - dep / 2 - gap;
    const y = quer ? (sd === 'n' ? R.y + dep / 2 + gap : R.y + R.h - dep / 2 - gap) : R.y + u;
    const o = setze(out, P, key, x, y, { r: WAND[sd], s, pad });
    if (o) return o;
  }
  return null;
}
// Eine Reihe gleicher Dinge an einer Wand (z. B. Särge, Regale, Betten)
function reihe(out, P, R, keys, seite, { s = 1, gap = 0.35, rand = 0.3, max = 99 } = {}) {
  const k0 = Array.isArray(keys) ? keys[0] : keys;
  const [w0] = dimsOf(k0);
  const len = w0 * s;
  const span = seite === 'n' || seite === 's' ? R.w : R.h;
  const n = Math.min(max, Math.floor((span - rand * 2 + gap) / (len + gap)));
  if (n < 1) return 0;
  const start = (span - (n * len + (n - 1) * gap)) / 2 + len / 2;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const key = Array.isArray(keys) ? pick(keys) : keys;
    if (anWand(out, P, R, key, { s, seite, at: span > len + 0.4 ? (start + i * (len + gap) - len / 2 - 0.1) / (span - len - 0.2) : 0.5, tries: 1 })) c++;
  }
  return c;
}
// In eine Ecke
function inEcke(out, P, R, key, { s = 1 } = {}) {
  for (const [v, h] of mischen([['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']])) {
    const sd = chance(0.5) ? v : h;
    const r = WAND[sd];
    const b = box(key, 0, 0, r, s);
    const bw = b[2] - b[0];
    const bh = b[3] - b[1];
    const x = h === 'w' ? R.x + bw / 2 + 0.06 : R.x + R.w - bw / 2 - 0.06;
    const y = v === 'n' ? R.y + bh / 2 + 0.06 : R.y + R.h - bh / 2 - 0.06;
    const o = setze(out, P, key, x, y, { r, s });
    if (o) return o;
  }
  return null;
}
// Frei im Bereich verteilen; bereich: Rechteck { x, y, w, h } oder Funktion → { x, y } | null
function streue(out, P, bereich, keys, n, { s = [1, 1], rot = true, pad = 0.02, tries = 8, layer, inset = 0.2, mark = true, check = true } = {}) {
  let c = 0;
  const punkt = typeof bereich === 'function' ? bereich : () => ({ x: rnd(bereich.x + inset, bereich.x + bereich.w - inset), y: rnd(bereich.y + inset, bereich.y + bereich.h - inset) });
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < tries; t++) {
      const p = punkt();
      if (!p) continue;
      const key = Array.isArray(keys) ? pick(keys) : keys;
      if (setze(out, P, key, p.x, p.y, { r: rot ? randInt(0, 359) : 0, s: rnd(s[0], s[1]) * (p.s || 1), pad, fx: chance(0.5), layer, mark, check })) { c++; break; }
    }
  }
  return c;
}
// Kleiner Haufen um einen Punkt (Fässer, Kisten, Knochen …)
function haufen(out, P, x, y, keys, n, { s = [1, 1.3], rad = 1, rot = true } = {}) {
  return streue(out, P, () => { const a = rnd(0, TAU); const d = Math.sqrt(Math.random()) * rad; return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }; }, keys, n, { s, rot, tries: 6 });
}
// Tisch mit Stühlen – die Stühle schauen zum Tisch
function tischGruppe(out, P, x, y, { tisch = pick(RUNDTISCH), stuhl = null, s = 1.4, n = 4, dreh = null, kerze = true, deko = true, bank = false } = {}) {
  const [tw, th] = dimsOf(tisch);
  const stuhlKey = stuhl || pick(LEHNSTUHL);
  const [cw, ch] = dimsOf(bank ? 'ph:painted_wooden_bench' : stuhlKey);
  const lang = tw > th * 1.35;
  const d = dreh ?? (lang ? pick([0, 90]) : randInt(0, 3) * 90 + (chance(0.35) ? randInt(-25, 25) : 0));
  const tb = box(tisch, x, y, d, s);
  const ext = Math.max(cw, ch) * s + 0.1;
  const all = [tb[0] - ext, tb[1] - ext, tb[2] + ext, tb[3] + ext];
  if (P && !P.frei(all)) return false;
  P?.nimm(all);
  out.push(stampAt(tisch, x, y, { r: d, s }));
  const a = (d * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const seat = (px, py, fx2, fy2, key = stuhlKey) => out.push(stampAt(key, px, py, { r: faceTo(fx2, fy2) + randInt(-10, 10), s: s * (bank ? 1.2 : 1) }));
  if (lang) {
    // Lange Tafel: Stühle bzw. Bänke an beiden Längsseiten, dazu ab und zu die Stirnseiten
    const L = tw * s;
    const off = (th * s) / 2 + (ch * s) * 0.42;
    for (const sd of [-1, 1]) {
      const nx = -uy * sd;
      const ny = ux * sd;
      if (bank) { out.push(stampAt('ph:painted_wooden_bench', x + nx * off, y + ny * off, { r: faceTo(-nx, -ny), s: s * 1.25 })); continue; }
      const k = Math.max(1, Math.floor(L / 0.95));
      for (let i = 0; i < k; i++) {
        if (chance(0.12)) continue;
        const t = (i - (k - 1) / 2) * (L / k);
        seat(x + ux * t + nx * off, y + uy * t + ny * off, -nx, -ny);
      }
    }
    if (!bank) for (const sd of [-1, 1]) if (chance(0.45)) { const off2 = L / 2 + cw * s * 0.5; seat(x + ux * off2 * sd, y + uy * off2 * sd, -ux * sd, -uy * sd); }
  } else {
    const rad = (Math.max(tw, th) * s) / 2 + ch * s * 0.4;
    for (let i = 0; i < n; i++) {
      if (n > 2 && chance(0.12)) continue;
      const w = a + (i / n) * TAU + (n === 2 ? 0 : 0);
      const rr = rad * rnd(1, 1.12);
      seat(x + Math.cos(w) * rr, y + Math.sin(w) * rr, -Math.cos(w), -Math.sin(w));
    }
  }
  if (kerze && chance(0.6)) out.push(stampAt('p:candles', x + rnd(-0.15, 0.15), y + rnd(-0.15, 0.15), { s: 0.6 }));
  if (deko) for (let i = 0, m = randInt(0, 2); i < m; i++) out.push(stampAt(pick(['ph:jug_01', 'ph:wooden_bowl_01', 'ph:carved_wooden_plate', 'ph:metal_jug', 'ph:brass_pot_01']), x + rnd(-0.3, 0.3) * tw * s, y + rnd(-0.3, 0.3) * th * s, { r: randInt(0, 359), s: 1.3 }));
  return true;
}

// ───── Formen und Wege ─────
// Unregelmäßiger, weicher Umriss (für Höhlen, Lichtungen, Teiche, Bodenflecken)
export function blob(cx, cy, rx, ry, { n = 18, j = 0.2 } = {}) {
  const k1 = rnd(0, TAU);
  const k2 = rnd(0, TAU);
  const k3 = rnd(0, TAU);
  const a1 = rnd(0.5, 1) * j;
  const a2 = rnd(0.3, 0.8) * j;
  const a3 = rnd(0.2, 0.5) * j;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const f = 1 + a1 * Math.sin(2 * a + k1) + a2 * Math.sin(3 * a + k2) + a3 * Math.sin(5 * a + k3);
    pts.push(r2(cx + Math.cos(a) * rx * f), r2(cy + Math.sin(a) * ry * f));
  }
  return pts;
}
export function inPoly(pts, x, y) {
  let inn = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]; const yi = pts[i + 1]; const xj = pts[j]; const yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inn = !inn;
  }
  return inn;
}
function chaikin(P, it = 2) {
  let A = P;
  for (let k = 0; k < it; k++) {
    const Q = [A[0]];
    for (let i = 0; i < A.length - 1; i++) {
      const [x0, y0] = A[i];
      const [x1, y1] = A[i + 1];
      Q.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    Q.push(A[A.length - 1]);
    A = Q;
  }
  return A;
}
// Natürlich geschwungener Weg von a nach b
export function wander(a, b, { bend = 0.22, steps = 6 } = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const pts = [a];
  let off = 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    off = off * 0.55 + (Math.random() - 0.5) * L * bend;
    const damp = Math.sin(t * Math.PI);           // Enden bleiben am Ziel
    pts.push([a[0] + dx * t + nx * off * damp, a[1] + dy * t + ny * off * damp]);
  }
  pts.push(b);
  return chaikin(pts, 2);
}
const flat = (P) => P.flatMap(([x, y]) => [r2(x), r2(y)]);
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function distPath(P, x, y) {
  let d = Infinity;
  for (let i = 1; i < P.length; i++) d = Math.min(d, distSeg(x, y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]));
  return d;
}
// Punkt auf einem Weg (t = 0 … 1) samt Richtung
function aufWeg(P, t) {
  const L = [];
  let sum = 0;
  for (let i = 1; i < P.length; i++) { sum += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(sum); }
  const want = sum * clamp(t, 0, 1);
  let i = L.findIndex((v) => v >= want);
  if (i < 0) i = L.length - 1;
  const a = P[i];
  const b = P[i + 1];
  const prev = i ? L[i - 1] : 0;
  const f = (want - prev) / ((L[i] - prev) || 1);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  return { x: a[0] + dx * f, y: a[1] + dy * f, dx: dx / n, dy: dy / n };
}
// Streifen eines Wegs in der Belegung sperren
function sperreWeg(P, pts, w) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.4) + 1;
    for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n; const y = ay + ((by - ay) * k) / n; P.nimm([x - w / 2, y - w / 2, x + w / 2, y + w / 2]); }
  }
}
// Punkt am Kartenrand (seite n|s|w|e), etwas außerhalb, damit Wege aus dem Bild laufen
function randPunkt(W, H, seite, t = rnd(0.2, 0.8)) {
  if (seite === 'n') return [W * t, -1];
  if (seite === 's') return [W * t, H + 1];
  if (seite === 'w') return [-1, H * t];
  return [W + 1, H * t];
}
// Bäume mit Mindestabstand (dichter Wald ohne Klumpen)
function baeume(out, W, H, n, { min = 2, ok = () => true, sets = [['nadelbaum', 0.5], ['laubbaum', 0.3], ['jungbaum', 0.2]], s = 1 } = {}) {
  const cell = min;
  const gw = Math.ceil(W / cell) + 1;
  const grid = new Map();
  const near = (x, y) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) for (const p of grid.get(yy * gw + xx) || []) if (Math.hypot(p[0] - x, p[1] - y) < min) return true;
    return false;
  };
  let c = 0;
  for (let i = 0; i < n * 6 && c < n; i++) {
    const x = rnd(-0.5, W + 0.5);
    const y = rnd(-0.5, H + 0.5);
    if (!ok(x, y) || near(x, y)) continue;
    const k = Math.floor(y / cell) * gw + Math.floor(x / cell);
    grid.set(k, [...(grid.get(k) || []), [x, y]]);
    let z = Math.random();
    let set = sets[0][0];
    for (const [nm, p] of sets) { if (z < p) { set = nm; break; } z -= p; }
    const S = SETS[set];
    if (!S?.keys.length) continue;
    out.push(stampAt(pick(S.keys), x, y, { r: randInt(0, 359), s: rnd(S.s[0], S.s[1]) * s, fx: chance(0.5) }));
    c++;
  }
  return c;
}
const fleck = (mat, cx, cy, rx, ry, j = 0.25) => ({ id: uid(6), op: 'add', kind: 'poly', mat, pts: blob(cx, cy, rx, ry, { j }) });

function doorOnEntry(room, from, to) {
  const inside = (x, y) => x > room.x && x < room.x + room.w && y > room.y && y < room.y + room.h;
  const dx = Math.sign(to[0] - from[0]);
  const dy = Math.sign(to[1] - from[1]);
  let [x, y] = from;
  if (inside(x, y)) return null;
  for (let i = 0; i < 200; i++) {
    const nx = x + dx;
    const ny = y + dy;
    if (inside(nx, ny)) return { x: (x + nx) / 2, y: (y + ny) / 2, r: dx ? 90 : 0 };
    if (nx === to[0] && ny === to[1]) return null;
    x = nx;
    y = ny;
  }
  return null;
}

// ───────────────────────── Dungeon ─────────────────────────
// Räume bekommen ein Thema; Türbereiche und Gänge bleiben frei, Möbel stehen mit dem Rücken an der Wand.
const DUNGEON_THEMEN = {
  eingang(o, P, R) {
    anWand(o, P, R, 'p:stairs', { seite: R.fern }) || anWand(o, P, R, 'p:stairs') || inEcke(o, P, R, 'p:trapdoor');
    for (const k of [0.15, 0.85]) anWand(o, P, R, 'p:brazier', { seite: R.fern, at: k, tries: 3 });
    haufen(o, P, R.x + R.w / 2, R.y + R.h / 2, [...KISTE, ...FASS], randInt(1, 3), { s: [1.2, 1.5], rad: Math.min(R.w, R.h) / 2 - 0.6 });
  },
  lager(o, P, R) {
    for (let i = 0, n = randInt(2, 3); i < n; i++) {
      const e = inEcke(o, P, R, pick(FASS), { s: 1.4 });
      if (e) haufen(o, P, e.x, e.y, [...FASS, ...KISTE], randInt(1, 3), { s: [1.2, 1.5], rad: 1.1 });
    }
    for (let i = 0, n = randInt(2, 4); i < n; i++) anWand(o, P, R, pick(KISTE), { s: 1.4 });
    if (chance(0.5)) anWand(o, P, R, pick(['ph:wooden_ladder', 'ph:old_military_crate']), { s: 1.3 });
    streue(o, P, R, SACK, randInt(1, 3), { s: [1.3, 1.7] });
  },
  gruft(o, P, R) {
    for (const sd of mischen(SEITEN).slice(0, randInt(2, 3))) reihe(o, P, R, 'p:coffin', sd, { s: 0.9, gap: 0.45 });
    if (R.w >= 5 && R.h >= 5 && chance(0.6)) setze(o, P, 'p:sarcophagus', R.x + R.w / 2, R.y + R.h / 2, { r: R.w > R.h ? 90 : 0 });
    streue(o, P, R, ['p:bones', 'p:skull', 'p:skull'], randInt(2, 4), { s: [0.8, 1.1], mark: false });
    anWand(o, P, R, KERZEN[0], { s: 1 });
  },
  bibliothek(o, P, R) {
    const seiten = mischen(SEITEN.filter((x) => !R.eingaenge[x]));
    for (const sd of (seiten.length ? seiten : mischen(SEITEN)).slice(0, 3)) reihe(o, P, R, ['p:bookshelf', 'ph:wooden_bookshelf_worn'], sd, { s: 1, gap: 0.15 });
    if (R.w >= 4 && R.h >= 4) {
      o.push(stampAt(pick(['p:rug', 'p:rugBlue']), R.x + R.w / 2, R.y + R.h / 2, { r: R.w > R.h ? 90 : 0, s: 0.9 }));
      if (tischGruppe(o, P, R.x + R.w / 2, R.y + R.h / 2, { tisch: pick(ECKTISCH), n: 2, s: 1.4, deko: false })) o.push(stampAt('ph:zauberbuch', R.x + R.w / 2, R.y + R.h / 2, { s: 0.55, r: randInt(0, 359) }));
    }
    anWand(o, P, R, KERZEN[0], { s: 1 });
  },
  wache(o, P, R) {
    tischGruppe(o, P, R.x + R.w / 2 + rnd(-0.5, 0.5), R.y + R.h / 2 + rnd(-0.5, 0.5), { tisch: pick([...ECKTISCH, ...RUNDTISCH]), n: randInt(2, 4) });
    anWand(o, P, R, 'ph:waffenstaender', { s: 0.8 });
    for (let i = 0, n = R.w * R.h >= 30 ? 2 : 1; i < n; i++) anWand(o, P, R, 'ph:old_bed_frame', { s: 1.2 });
    inEcke(o, P, R, pick(FASS), { s: 1.4 });
    anWand(o, P, R, 'p:torch', { s: 1.4 });
    streue(o, P, R, ['ph:kite_shield', 'ph:antique_estoc', 'ph:wooden_bucket_01'], randInt(0, 2), { s: [1.3, 1.6] });
  },
  kerker(o, P, R) {
    if (!anWand(o, P, R, 'ph:folterbank', { s: 0.9 })) setze(o, P, 'ph:folterbank', R.x + R.w / 2, R.y + R.h / 2, { s: 0.9 });
    anWand(o, P, R, 'ph:pranger', { s: 0.9 });
    anWand(o, P, R, 'ph:skelett_boden', { s: 0.8 });
    anWand(o, P, R, 'p:lever', { s: 1 });
    streue(o, P, R, ['p:blood', 'p:bones', 'ph:baerenfalle'], randInt(2, 4), { s: [0.8, 1.1], mark: false });
    anWand(o, P, R, 'p:torch', { s: 1.4 });
  },
  schrein(o, P, R) {
    const sd = R.fern;
    anWand(o, P, R, 'p:altar', { seite: sd, at: 0.5 });
    for (const k of [0.1, 0.9]) anWand(o, P, R, 'ph:gothic_statue', { seite: sd, at: k, tries: 3, s: 0.9 });
    for (const k of [0.3, 0.7]) anWand(o, P, R, 'p:brazier', { seite: GEGEN[sd], at: k, tries: 3 });
    if (R.w >= 5 && R.h >= 5) o.push(stampAt(chance(0.6) ? 'p:magic' : 'p:rugRound', R.x + R.w / 2, R.y + R.h / 2, { s: Math.min(R.w, R.h) >= 6 ? 1 : 0.75, r: randInt(0, 359) }));
    streue(o, P, R, KERZEN, 2, { s: [0.9, 1] });
  },
  schatz(o, P, R) {
    anWand(o, P, R, pick(['ph:treasure_chest', 'ph:juwelentruhe']), { seite: R.fern, at: 0.5, s: 1.4 });
    anWand(o, P, R, 'ph:treasure_chest', { s: 1.3 });
    o.push(stampAt('ph:goldhaufen', R.x + R.w / 2 + rnd(-0.6, 0.6), R.y + R.h / 2 + rnd(-0.6, 0.6), { s: 1.1, r: randInt(0, 359), layer: 'floor' }));
    for (let i = 0, n = randInt(1, 2); i < n; i++) inEcke(o, P, R, 'ph:gothic_statue', { s: 0.85 });
    streue(o, P, R, ['p:trap'], randInt(1, 2), { mark: false, rot: false });
  },
  labor(o, P, R) {
    if (tischGruppe(o, P, R.x + R.w / 2, R.y + R.h / 2, { tisch: pick(LANGTISCH), n: 1, s: 1.1, kerze: false, deko: false })) {
      o.push(stampAt('ph:chemistry_set', R.x + R.w / 2, R.y + R.h / 2, { s: 1.2, r: randInt(0, 359) }));
    }
    inEcke(o, P, R, 'ph:hexenkessel_feuer', { s: 1 }) || anWand(o, P, R, 'p:cauldron');
    anWand(o, P, R, pick(['p:bookshelf', 'ph:wooden_bookshelf_worn']), { s: 1 });
    anWand(o, P, R, 'ph:kristallkugel', { s: 0.8 });
    streue(o, P, R, KRAM, randInt(1, 3), { s: [1.2, 1.6] });
  },
  schlafsaal(o, P, R) {
    const sd = R.w >= R.h ? pick(['n', 's']) : pick(['w', 'e']);
    for (const s2 of [sd, GEGEN[sd]]) reihe(o, P, R, BETT, s2, { s: 1.05, gap: 0.6, max: 4 });
    streue(o, P, R, ['ph:treasure_chest', ...FASS], randInt(1, 2), { s: [1.1, 1.3] });
    anWand(o, P, R, 'p:torch', { s: 1.4 });
  },
  verfallen(o, P, R) {
    haufen(o, P, R.x + rnd(1, R.w - 1), R.y + rnd(1, R.h - 1), ['p:rubble', ...SETS.fels.keys], randInt(3, 5), { s: [0.8, 1.2], rad: 1.3 });
    if (R.w >= 5 && chance(0.5)) setze(o, P, 'p:pillar', R.x + rnd(1.5, R.w - 1.5), R.y + rnd(1.5, R.h - 1.5));
    streue(o, P, R, ['p:bones', 'p:skull', 'ph:root_cluster_02'], randInt(1, 3), { s: [0.7, 1], mark: false });
  },
  thron(o, P, R) {
    const sd = R.fern;
    const t = anWand(o, P, R, 'p:throne', { seite: sd, at: 0.5, s: 1.6 });
    for (const k of [0.25, 0.75]) anWand(o, P, R, 'p:brazier', { seite: sd, at: k, tries: 3 });
    if (t) {
      // Läufer vom Thron zum Eingang
      const quer = sd === 'n' || sd === 's';
      const len = quer ? R.h : R.w;
      for (let d = 2.5; d < len - 1.5; d += 3.6) o.push(stampAt('p:rugGreen', quer ? t.x : t.x + (sd === 'w' ? d : -d), quer ? t.y + (sd === 'n' ? d : -d) : t.y, { r: quer ? 0 : 90, s: 0.9 }));
    }
    for (const k of [0.05, 0.95]) anWand(o, P, R, 'ph:gothic_statue', { seite: sd, at: k, tries: 2, s: 0.9 });
    streue(o, P, R, KERZEN, 2, { s: [1, 1] });
  },
  halle(o, P, R) {
    const quer = R.w >= R.h;
    tischGruppe(o, P, R.x + R.w / 2, R.y + R.h / 2, { tisch: pick(LANGTISCH), s: 1.6, dreh: quer ? 0 : 90, bank: chance(0.3) });
    anWand(o, P, R, 'p:fireplace', { seite: R.fern });
    for (let i = 0; i < 2; i++) inEcke(o, P, R, 'p:brazier');
    anWand(o, P, R, pick(TROPHAE), { s: 1.6 });
  },
};

// Füllstücke je Thema: nach dem Thema wird der Raum je nach Größe weiter bestückt (immer an den Wänden)
const DUNGEON_FUELLE = {
  eingang: [...KISTE, ...FASS], lager: [...FASS, ...KISTE, ...SACK], gruft: ['p:coffin', 'p:coffin', ...KERZEN], bibliothek: ['p:bookshelf', 'ph:wooden_bookshelf_worn', ...KERZEN, 'ph:treasure_chest'],
  wache: [...FASS, ...KISTE, 'ph:old_bed_frame', 'ph:waffenstaender'], kerker: ['ph:skelett_boden', 'p:bones', 'ph:pranger', 'p:torch'], schrein: [...KERZEN, 'ph:gothic_statue', 'p:brazier'],
  schatz: ['ph:treasure_chest', 'ph:gothic_statue', ...KISTE], labor: [...REGAL, 'ph:drawer_cabinet', ...KERZEN], schlafsaal: ['ph:treasure_chest', ...FASS, ...BETT], verfallen: ['p:rubble', ...SETS.fels.keys],
  thron: ['ph:gothic_statue', ...KERZEN, 'p:brazier'], halle: [...FASS, ...TROPHAE, 'p:brazier'],
};
const skal = (key) => (String(key).startsWith('p:') ? 1 : dimsOf(key)[0] < 0.7 ? 1.35 : dimsOf(key)[0] > 1.3 ? 0.9 : 1.05);

function genDungeon(W, H) {
  const shapes = [];
  const objects = [];
  const labels = [];
  const rooms = [];
  const big = Math.sqrt(W * H);
  const maxW = clamp(Math.round(big / 4), 7, 11);
  const maxH = clamp(Math.round(big / 5), 6, 9);
  const target = Math.max(5, Math.round((W * H) / 110));
  for (let i = 0; i < 600 && rooms.length < target; i++) {
    const w = randInt(3, maxW);
    const h = randInt(3, maxH);
    if (W - w - 2 < 1 || H - h - 2 < 1) break;
    const x = randInt(1, W - w - 2);
    const y = randInt(1, H - h - 2);
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h });
  }
  if (!rooms.length) return base({});
  const cx = (r) => Math.floor(r.x + r.w / 2) + 0.5;
  const cy = (r) => Math.floor(r.y + r.h / 2) + 0.5;
  const conns = [];
  const done = [rooms[0]];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best = null;
    for (const a of done) for (const b of rest) { const d = Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b)); if (!best || d < best.d) best = { a, b, d }; }
    conns.push(best);
    done.push(best.b);
    rest.splice(rest.indexOf(best.b), 1);
  }
  if (rooms.length > 5) conns.push({ a: rooms[1], b: rooms[rooms.length - 1] });
  const floors = ['stone_tiles', 'slab_tiles', 'monastery_stone_floor', 'worn_brick_floor', 'rock_tile_floor', 'mossy_brick_floor', 'kryptastein'];
  rooms.forEach((r, i) => {
    shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [r.x, r.y, r.x + r.w, r.y + r.h], ...(chance(0.4) ? { tex: pick(floors) } : {}) });
    labels.push({ id: uid(6), kind: 'room', text: String(i + 1), x: r.x + 0.55, y: r.y + 0.55, size: 0.6 });
  });
  // Gänge als Felder mitschreiben – daraus ergeben sich die Eingänge der Räume
  const roomAt = new Int16Array(W * H).fill(-1);
  rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomAt[y * W + x] = i; });
  const gang = new Uint8Array(W * H);
  const lauf = (x0, y0, x1, y1) => {
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const bx = Math.floor(x1);
    const by = Math.floor(y1);
    gang[y * W + x] = 1;
    while (x !== bx || y !== by) { if (x !== bx) x += Math.sign(bx - x); else y += Math.sign(by - y); gang[y * W + x] = 1; }
  };
  for (const { a, b } of conns) {
    const p1 = [cx(a), cy(a)];
    const p2 = [cx(b), cy(b)];
    const mid = chance(0.5) ? [p2[0], p1[1]] : [p1[0], p2[1]];
    shapes.push({ id: uid(6), op: 'add', kind: 'path', w: 1, pts: [...p1, ...mid, ...p2] });
    lauf(p1[0], p1[1], mid[0], mid[1]);
    lauf(mid[0], mid[1], p2[0], p2[1]);
    for (const [room, from, to] of [[a, mid, p1], [b, mid, p2]]) {
      const d = doorOnEntry(room, from, to);
      if (d && chance(0.75)) objects.push(stampAt(chance(0.08) ? 'p:secret' : pick(['p:door', 'p:door', 'p:doorDark', 'p:doorIron']), d.x, d.y, { r: d.r }));
    }
  }
  // Belegung: nur im Rauminneren; vor jedem Eingang bleibt ein Streifen frei
  const P = new Platz(W, H).nurIn((x, y) => roomAt[y * W + x] >= 0);
  rooms.forEach((r, i) => {
    r.eingaenge = { n: 0, s: 0, w: 0, e: 0 };
    const test = (x, y, nx, ny, sd, frei) => {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
      const k = ny * W + nx;
      if (roomAt[k] === i || (!gang[k] && roomAt[k] < 0)) return;
      r.eingaenge[sd]++;
      P.nimm(frei);
    };
    for (let x = r.x; x < r.x + r.w; x++) {
      test(x, r.y, x, r.y - 1, 'n', [x - 1, r.y, x + 2, r.y + 2]);
      test(x, r.y + r.h - 1, x, r.y + r.h, 's', [x - 1, r.y + r.h - 2, x + 2, r.y + r.h]);
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      test(r.x, y, r.x - 1, y, 'w', [r.x, y - 1, r.x + 2, y + 2]);
      test(r.x + r.w - 1, y, r.x + r.w, y, 'e', [r.x + r.w - 2, y - 1, r.x + r.w, y + 2]);
    }
    // „fern“ = Wand gegenüber dem Haupteingang (dort stehen Altar, Thron, Treppe)
    const haupt = SEITEN.reduce((m, sd) => (r.eingaenge[sd] > r.eingaenge[m] ? sd : m), 'n');
    r.fern = r.eingaenge[GEGEN[haupt]] ? SEITEN.find((sd) => !r.eingaenge[sd]) || GEGEN[haupt] : GEGEN[haupt];
  });
  // Themen verteilen: größter Raum wird Halle/Thron/Schrein, Raum 1 ist der Eingang
  const flaeche = (r) => r.w * r.h;
  const groesster = rooms.slice(1).sort((p, q) => flaeche(q) - flaeche(p))[0];
  const klein = ['lager', 'gruft', 'schatz', 'kerker', 'verfallen', 'labor'];
  const mittel = ['wache', 'bibliothek', 'labor', 'schlafsaal', 'gruft', 'kerker', 'schrein', 'lager', 'verfallen'];
  const benutzt = new Map();
  rooms.forEach((r, i) => {
    let th;
    if (i === 0) th = 'eingang';
    else if (r === groesster && flaeche(r) >= 30) th = pick(['thron', 'halle', 'schrein']);
    else {
      const liste = flaeche(r) < 16 ? klein : mittel;
      th = pick(liste.filter((x) => (benutzt.get(x) || 0) < 2)) || pick(liste);
    }
    benutzt.set(th, (benutzt.get(th) || 0) + 1);
    r.thema = th;
    // Säulen in großen Hallen (nur wo frei – nie vor einer Tür)
    if (r.w >= 6 && r.h >= 5 && th !== 'bibliothek' && chance(0.55)) {
      for (const [x, y] of [[r.x + 1.5, r.y + 1.5], [r.x + r.w - 1.5, r.y + 1.5], [r.x + 1.5, r.y + r.h - 1.5], [r.x + r.w - 1.5, r.y + r.h - 1.5]]) setze(objects, P, chance(0.5) ? 'p:pillar' : 'p:pillarSq', x, y, { pad: 0.02 });
    }
    DUNGEON_THEMEN[th](objects, P, r);
    for (let k = 0, n = Math.floor((r.w * r.h) / 10) + 1; k < n; k++) { const key = pick(DUNGEON_FUELLE[th]); anWand(objects, P, r, key, { s: skal(key), tries: 6 }); }
    // Licht und etwas Staub in jedem Raum
    if (!['eingang', 'schrein', 'thron'].includes(th) && chance(0.55)) inEcke(objects, P, r, 'p:brazier');
    if (chance(0.45)) objects.push(stampAt('p:web', r.x + (chance(0.5) ? 0.9 : r.w - 0.9), r.y + (chance(0.5) ? 0.9 : r.h - 0.9), { s: 0.75, r: randInt(0, 359), layer: 'top' }));
    if (chance(0.35)) streue(objects, P, r, ['p:bones', 'p:rubble', 'p:skull'], 1, { s: [0.7, 1], mark: false });
  });
  return base({ shapes, objects, labels, dark: 0.32, floorTex: pick(['stone_tiles', 'slab_tiles', 'monastery_stone_floor']), wallTex: pick(['castle_brick_01', 'stone_wall', 'old_stone_wall', 'mossy_stone_wall']) });
}

// ───────────────────────── Höhle ─────────────────────────
function genCave(W, H) {
  const shapes = [];
  const terrain = [];
  const objects = [];
  const labels = [];
  const area = W * H;
  const n = clamp(Math.round(area / 150), 3, 16);
  const rMax = clamp(Math.round(Math.sqrt(area) / 7), 3, 7);
  const kammern = [];
  for (let t = 0; t < 400 && kammern.length < n; t++) {
    const rx = rnd(2.2, rMax);
    const ry = rnd(2, rMax * 0.85);
    const x = rnd(rx + 1.2, W - rx - 1.2);
    const y = rnd(ry + 1.2, H - ry - 1.2);
    if (kammern.some((c) => Math.hypot(c.x - x, c.y - y) < (Math.max(c.rx, c.ry) + Math.max(rx, ry)) * 0.8)) continue;
    kammern.push({ x, y, rx, ry, pts: blob(x, y, rx, ry, { n: 20, j: 0.22 }) });
  }
  if (!kammern.length) return base({});
  kammern.forEach((c, i) => {
    shapes.push({ id: uid(6), op: 'add', kind: 'poly', pts: c.pts });
    labels.push({ id: uid(6), kind: 'room', text: String(i + 1), x: r2(c.x), y: r2(c.y - c.ry * 0.7), size: 0.6 });
  });
  // Verbindungen: kürzeste Wege (Baum) plus ein, zwei Schleifen
  const conns = [];
  const done = [kammern[0]];
  const rest = kammern.slice(1);
  while (rest.length) {
    let best = null;
    for (const a of done) for (const b of rest) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (!best || d < best.d) best = { a, b, d }; }
    conns.push(best);
    done.push(best.b);
    rest.splice(rest.indexOf(best.b), 1);
  }
  for (let i = 0; i < Math.floor(kammern.length / 4); i++) { const a = pick(kammern); const b = pick(kammern); if (a !== b) conns.push({ a, b }); }
  const tunnel = [];
  for (const { a, b } of conns) {
    const pts = wander([a.x, a.y], [b.x, b.y], { bend: 0.18, steps: Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3)) });
    const w = r2(rnd(1.4, 2.6));
    shapes.push({ id: uid(6), op: 'add', kind: 'brush', w, pts: flat(pts) });
    tunnel.push({ pts, w });
  }
  // Belegung: nur in den Kammern, die Tunnel bleiben frei
  const P = new Platz(W, H).nurIn((x, y) => kammern.some((c) => inPoly(c.pts, x + 0.5, y + 0.5)));
  for (const t of tunnel) sperreWeg(P, t.pts, t.w * 0.8);
  const inKammer = (c, f0 = 0, f1 = 0.85) => () => {
    const a = rnd(0, TAU);
    const d = Math.sqrt(rnd(f0 * f0, f1 * f1));
    const x = c.x + Math.cos(a) * c.rx * d;
    const y = c.y + Math.sin(a) * c.ry * d;
    return inPoly(c.pts, x, y) ? { x, y } : null;
  };
  // Boden: Flecken aus Geröll, Moos, Kies – dazu Wasser in einer oder mehreren Kammern
  const boden = pick(['dry_riverbed_rock', 'embedded_rock_floor', 'rock_ground', 'brown_mud_rocks_01']);
  const boeden = ['tex:gravel_ground_01', 'tex:mossy_rock', 'tex:lichen_rock', 'tex:river_small_rocks', 'tex:rocks_ground_02', 'tex:dry_riverbed_rock', 'tex:embedded_rock_floor'].filter((x) => x !== 'tex:' + boden);
  for (const c of kammern) for (let i = 0, m = randInt(1, 2) + Math.floor(c.rx * c.ry / 10); i < m; i++) { const p = inKammer(c, 0, 0.8)(); if (p) terrain.push(fleck(pick(boeden), p.x, p.y, rnd(1, c.rx * 0.55), rnd(0.8, c.ry * 0.55))); }
  const themen = mischen(['see', 'lager', 'nest', 'mine', 'schrein', 'spinnen', 'leer', 'leer', 'see', 'kristall', 'leer', 'nest']);
  kammern.forEach((c, i) => {
    const th = i === 0 ? 'eingang' : themen[i % themen.length];
    const fl = Math.PI * c.rx * c.ry;
    // Tropfsteine und Felsen am Rand – je größer die Kammer, desto mehr
    // Tropfsteine in Gruppen an der Wand, einzelne Brocken im Raum
    for (let k = 0, m = Math.round(fl / 14) + 1; k < m; k++) { const p = inKammer(c, 0.72, 0.9)(); if (p) haufen(objects, P, p.x, p.y, [...SETS.felsen.keys, ...SETS.fels.keys, 'ph:boulder_01'], randInt(2, 4), { s: [0.7, 1.4], rad: 0.9 }); }
    streue(objects, P, inKammer(c, 0.25, 0.75), [...SETS.fels.keys, 'ph:namaqualand_boulder_05', 'ph:namaqualand_boulder_06'], Math.round(fl / 16), { s: [0.8, 1.5] });
    streue(objects, P, inKammer(c, 0.2, 0.9), ['p:rubble', ...ids(/^namaqualand_rocks_01|^namaqualand_boulders_01|^moon_rock/)], Math.round(fl / 5), { s: [1, 2.2], mark: false });
    if (th === 'eingang') {
      objects.push(stampAt('p:torch', c.x + c.rx * 0.5, c.y, { s: 1.4 }));
      streue(objects, P, inKammer(c, 0, 0.6), [...KISTE, ...FASS], randInt(1, 2), { s: [1.2, 1.4] });
    } else if (th === 'see') {
      const lake = blob(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), c.rx * rnd(0.45, 0.65), c.ry * rnd(0.4, 0.6), { j: 0.25 });
      terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: 'tex:river_small_rocks', pts: blob(c.x, c.y, c.rx * 0.75, c.ry * 0.7, { j: 0.2 }) });
      terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: fl > 30 && chance(0.5) ? 'deepwater' : 'water', pts: lake });
    } else if (th === 'lager') {
      const f = setze(objects, P, chance(0.5) ? 'p:campfire' : 'ph:stone_fire_pit', c.x, c.y, { s: 1 });
      if (f) {
        for (let k = 0; k < randInt(2, 4); k++) { const a = rnd(0, TAU); setze(objects, P, pick(['ph:tree_stump_01', 'ph:tree_stump_02', 'ph:dead_tree_trunk']), c.x + Math.cos(a) * 1.8, c.y + Math.sin(a) * 1.8, { s: 0.6, r: Math.round((a * 180) / Math.PI) + 90 }); }
        if (fl > 25) setze(objects, P, 'p:tent', c.x + c.rx * 0.45, c.y - c.ry * 0.3, { s: 0.8, r: randInt(0, 359) });
      }
      streue(objects, P, inKammer(c, 0.4, 0.8), [...KISTE, ...FASS, 'ph:treasure_chest'], randInt(2, 4), { s: [1.2, 1.4] });
      streue(objects, P, inKammer(c, 0.2, 0.8), ['p:bones', 'ph:wooden_bucket_01', 'ph:wicker_basket_01'], randInt(1, 3), { s: [0.9, 1.4], mark: false });
    } else if (th === 'nest') {
      haufen(objects, P, c.x, c.y, ['p:bones', 'p:skull', 'p:bones', 'ph:skelett_boden'], randInt(4, 7), { s: [0.8, 1.1], rad: Math.min(c.rx, c.ry) * 0.5 });
      if (chance(0.6)) setze(objects, P, pick(['ph:treasure_chest', 'ph:goldhaufen']), c.x + rnd(-1, 1), c.y + rnd(-1, 1), { s: 1.2 });
    } else if (th === 'mine') {
      streue(objects, P, inKammer(c, 0.2, 0.7), ['ph:industrial_storage_cart', 'ph:picke_dirty_01', 'ph:wooden_ladder', 'ph:wooden_lantern_01', ...KISTE, 'ph:wooden_bucket_02_a'], randInt(3, 6), { s: [1, 1.4] });
      objects.push(stampAt('p:torch', c.x, c.y - c.ry * 0.5, { s: 1.4 }));
    } else if (th === 'schrein') {
      setze(objects, P, 'ph:opferaltar', c.x, c.y, { s: 0.8 });
      streue(objects, P, inKammer(c, 0.35, 0.6), [...KERZEN, 'p:skull', 'p:candles'], randInt(3, 5), { s: [0.8, 1] });
    } else if (th === 'spinnen') {
      for (let k = 0; k < randInt(2, 4); k++) { const p = inKammer(c, 0.3, 0.8)(); if (p) objects.push(stampAt('p:web', p.x, p.y, { s: rnd(0.8, 1.3), r: randInt(0, 359), layer: 'top' })); }
      streue(objects, P, inKammer(c), ['p:bones', 'p:skull', 'ph:skelett_boden'], randInt(2, 4), { s: [0.8, 1], mark: false });
    } else if (th === 'kristall') {
      objects.push(stampAt('p:magic', c.x, c.y, { s: Math.min(c.rx, c.ry) > 3 ? 0.9 : 0.7 }));
      streue(objects, P, inKammer(c, 0.5, 0.85), SETS.felsen.keys, randInt(2, 3), { s: [0.5, 0.8] });
    }
  });
  // Eine Kluft in großen Höhlen
  if (area > 1200 && chance(0.5)) {
    const c = pick(kammern.slice(1));
    if (c) terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: 1.2, mat: 'pit', pts: flat(wander([c.x - c.rx * 0.6, c.y + rnd(-1, 1)], [c.x + c.rx * 0.6, c.y + rnd(-1, 1)], { bend: 0.3, steps: 4 })) });
  }
  return base({ shapes, terrain, objects, labels, dark: 0.45, ground: 'dark_rock', floorTex: boden, wallTex: pick(['rock_wall_08', 'rock_wall_08', 'cliff_side', 'dark_rock_02']), soft: 0.4 });
}

// ───────────────────────── Taverne ─────────────────────────
function genTavern(W, H) {
  const w = clamp(W - 4, 10, 46);
  const h = clamp(H - 4, 8, 34);
  const x0 = Math.floor((W - w) / 2);
  const y0 = Math.floor((H - h) / 2);
  const shapes = [{ id: uid(6), op: 'add', kind: 'rect', pts: [x0, y0, x0 + w, y0 + h], tex: pick(['old_wood_floor', 'wood_floor_worn', 'weathered_planks', 'dark_wooden_planks']) }];
  const objects = [];
  const labels = [];
  const wand = (pts) => shapes.push({ id: uid(6), op: 'sub', kind: 'path', w: 0.3, wall: 1, pts });
  const P = new Platz(W, H).nurIn((x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h);
  // Küche (rechts) und bei großen Tavernen ein Lager darunter
  const kw = clamp(Math.round(w * 0.24), 4, 9);
  const kx = x0 + w - kw;
  const lagerH = h >= 12 && w * h >= 220 ? clamp(Math.round(h * 0.35), 4, 8) : 0;
  const ly = y0 + h - lagerH;
  shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [kx, y0, x0 + w, lagerH ? ly : y0 + h], tex: pick(['terracotta_floor_tiles', 'slate_floor', 'brick_floor']) });
  const kd = y0 + randInt(1, Math.max(1, (lagerH ? ly - y0 : h) - 3));
  wand([kx, y0, kx, kd]);
  wand([kx, kd + 1, kx, y0 + h]);
  objects.push(stampAt('p:door', kx, kd + 0.5, { r: 90 }));
  P.nimm([kx - 1.6, kd - 0.6, kx + 1.6, kd + 1.6]);
  if (lagerH) {
    shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [kx, ly, x0 + w, y0 + h], tex: 'rock_tile_floor' });
    const ld = kx + Math.floor(kw / 2);
    wand([kx, ly, ld, ly]);
    wand([ld + 1, ly, x0 + w, ly]);
    objects.push(stampAt('p:door', ld + 0.5, ly));
    P.nimm([ld - 0.6, ly - 1.4, ld + 1.6, ly + 1.4]);
  }
  // Hinterausgang aus der Küche
  const hinten = chance(0.6) ? y0 + randInt(1, Math.max(1, (lagerH ? ly - y0 : h) - 2)) : null;
  if (hinten != null) objects.push(stampAt('p:door', x0 + w, hinten + 0.5, { r: 90 }));
  // Schankraum
  const T = { x: x0, y: y0, w: kx - x0, h };
  // Eingang (Doppeltür unten) mit freiem Weg zur Theke
  const ex = x0 + clamp(Math.round(T.w * rnd(0.3, 0.6)), 2, T.w - 2);
  objects.push(stampAt('p:door2', ex, y0 + h));
  P.nimm([ex - 1.6, y0 + h - 3.5, ex + 1.6, y0 + h]);
  // Theke vor der Küchenwand, Tür zur Küche liegt dahinter
  const nC = clamp(Math.round((h - 4) / 3.5), 1, 4);
  let ya = clamp(kd - 2, y0 + 1, y0 + h - 3 * nC - 2);
  if (ya + 3 * nC > y0 + h - 2) ya = y0 + 1;
  const barX = kx - 2.05;
  for (let i = 0; i < nC; i++) objects.push(stampAt('p:counter', barX, ya + 1.5 + i * 3, { r: 90 }));
  for (let y = ya + 0.6; y < ya + 3 * nC - 0.2; y += 1.05) objects.push(stampAt(pick(HOCKER), barX - 1.05, y, { r: faceTo(1, 0), s: 1.5 }));
  // hinter der Theke: Fässer und Regale an der Küchenwand
  for (let y = ya + 0.5; y < ya + 3 * nC; y += 1.1) if (Math.abs(y - (kd + 0.5)) > 1.3) objects.push(stampAt(chance(0.6) ? pick(FASS) : pick(REGAL), kx - 0.45, y, { r: 90, s: 1.3 }));
  P.nimm([barX - 1.7, ya - 0.3, kx, ya + 3 * nC + 0.3]);
  labels.push({ id: uid(6), kind: 'text', text: 'Theke', x: barX, y: ya - 0.5, size: 0.45 });
  // Séparées oben in großen Schankräumen
  if (T.w >= 16 && h >= 13) {
    let sx = x0 + 4;
    let nS = 0;
    while (sx + 4 <= kx - 3 && nS < Math.floor(T.w / 7)) {
      const rw = Math.min(randInt(4, 5), kx - 3 - sx);
      if (rw < 4) break;
      const dx = sx + Math.floor(rw / 2);
      wand([sx, y0, sx, y0 + 4]);
      wand([sx + rw, y0, sx + rw, y0 + 4]);
      wand([sx, y0 + 4, dx, y0 + 4]);
      wand([dx + 1, y0 + 4, sx + rw, y0 + 4]);
      objects.push(stampAt('p:door', dx + 0.5, y0 + 4));
      const R = { x: sx, y: y0, w: rw, h: 4 };
      const PS = new Platz(W, H).nurIn((x, y) => x >= sx && x < sx + rw && y >= y0 && y < y0 + 4);
      PS.nimm([dx - 0.2, y0 + 3.3, dx + 1.2, y0 + 4]);
      if (chance(0.5)) objects.push(stampAt('p:rugRound', sx + rw / 2, y0 + 1.9, { s: 0.9 }));
      let ok = false;
      for (const [tk, n2, s2] of [[pick(RUNDTISCH), 4, 1.25], [pick(RUNDTISCH), 3, 1.15], [pick(ECKTISCH), 2, 1.2]]) {
        for (const ox of [0, -0.4, 0.4]) if (!ok) ok = tischGruppe(objects, PS, sx + rw / 2 + ox, y0 + 1.75, { tisch: tk, n: n2, s: s2 });
        if (ok) break;
      }
      anWand(objects, PS, R, pick(['ph:gothiccommode_01', 'ph:classicconsole_01', 'ph:vintage_grandfather_clock_01', 'ph:painted_wooden_cabinet_02']), { s: 1.1, tries: 10 });
      inEcke(objects, PS, R, pick([...KERZEN, 'ph:planter_pot_clay']), { s: 1 });
      P.nimm([sx - 0.2, y0, sx + rw + 0.2, y0 + 4.9]);
      labels.push({ id: uid(6), kind: 'text', text: 'Séparée', x: sx + rw / 2, y: y0 + 0.5, size: 0.35 });
      sx += rw;
      nS++;
    }
  }
  // Treppe nach oben, Kamin mit Sesseln, Bühne, Spieltisch
  inEcke(objects, P, { x: x0, y: y0, w: 4, h: T.h }, 'p:stairsWood');
  const kamin = anWand(objects, P, T, 'p:fireplace', { seite: 'w', at: rnd(0.3, 0.7) }) || anWand(objects, P, T, 'p:fireplace', { seite: 'n' });
  if (kamin) {
    const [fx2, fy2] = kamin.r === 270 ? [1, 0] : kamin.r === 0 ? [0, 1] : kamin.r === 90 ? [-1, 0] : [0, -1];
    const mx = kamin.x + fx2 * 2.2;
    const my = kamin.y + fy2 * 2.2;
    objects.push(stampAt('p:rugRound', mx, my, { s: 1 }));
    for (const sd of [-1, 1]) setze(objects, P, 'ph:armchair_01', mx + fy2 * sd * 0.9 + fx2 * 0.4, my + fx2 * sd * 0.9 + fy2 * 0.4, { r: faceTo(-fx2, -fy2) + sd * 20, s: 1.5 });
    setze(objects, P, 'ph:side_table_01', mx + fx2 * 1.1, my + fy2 * 1.1, { s: 1.3 });
    P.nimm([mx - 1.2, my - 1.2, mx + 1.2, my + 1.2]);
  }
  if (T.w * h >= 260) {
    // Bühne an der Nordwand (bzw. mittig oben, wenn dort Séparées sind, weiter unten links)
    const bw = clamp(Math.round(T.w * 0.28), 4, 7);
    const bx = x0 + Math.round((T.w - bw) / 2);
    const by = T.w >= 16 && h >= 13 ? y0 + 5 : y0;
    if (P.frei([bx, by, bx + bw, by + 3])) {
      shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [bx, by, bx + bw, by + 3], tex: 'wood_floor_deck' });
      for (const k of [0.3, 0.7]) objects.push(stampAt(pick(HOCKER), bx + bw * k, by + 1.4, { s: 1.4, r: 0 }));
      objects.push(stampAt(KERZEN[0], bx + 0.5, by + 2.5, { s: 0.8 }), stampAt(KERZEN[0], bx + bw - 0.5, by + 2.5, { s: 0.8 }), stampAt('ph:treasure_chest', bx + bw - 0.8, by + 0.5, { s: 1 }));
      P.nimm([bx - 0.3, by, bx + bw + 0.3, by + 4]);
      labels.push({ id: uid(6), kind: 'text', text: 'Bühne', x: bx + bw / 2, y: by + 0.5, size: 0.4 });
    }
  }
  if (T.w * h >= 180) {
    for (let t = 0; t < 12; t++) {
      const x = rnd(x0 + 2, kx - 4);
      const y = rnd(y0 + 2, y0 + h - 2);
      if (tischGruppe(objects, P, x, y, { tisch: 'ph:gothic_coffee_table', n: 2, s: 1.2, kerze: false, deko: false })) { objects.push(stampAt(pick(SPIEL), x, y, { s: 1.4, r: randInt(0, 3) * 90 })); break; }
    }
  }
  // Tische füllen den Rest – große Tavernen auch mit langen Tafeln
  // gierig: viele Versuche an zufälligen Stellen, jede Gruppe hält ihren Platz frei
  for (let t = 0, fehl = 0; t < 400 && fehl < 120; t++) {
    const x = rnd(x0 + 1.8, kx - 2.5);
    const y = rnd(y0 + 1.8, y0 + h - 1.8);
    const lang = w * h >= 300 && chance(0.2);
    const ok = lang
      ? tischGruppe(objects, P, x, y, { tisch: 'ph:dining_table', s: 1.5, bank: chance(0.35) })
      : tischGruppe(objects, P, x, y, { tisch: pick([...RUNDTISCH, ...RUNDTISCH, 'ph:woodentable_01', 'ph:gothic_coffee_table']), n: randInt(3, 4), s: 1.4 });
    if (!ok) { fehl++; continue; }
    fehl = 0;
    if (chance(0.3)) objects.push(stampAt(pick(LEUCHTER), x, y, { s: 1.5, layer: 'top' }));
  }
  // Trophäen und Kleinkram an den Wänden
  for (let i = 0, n = Math.round(T.w * h / 90) + 1; i < n; i++) anWand(objects, P, T, pick([...TROPHAE, ...FASS, ...KISTE]), { s: 1.4 });
  // Küche
  const K = { x: kx, y: y0, w: kw, h: lagerH ? ly - y0 : h };
  const PK = new Platz(W, H).nurIn((x, y) => x >= K.x && x < K.x + K.w && y >= K.y && y < K.y + K.h);
  PK.nimm([kx, kd - 0.6, kx + 1.6, kd + 1.6]);
  if (lagerH) PK.nimm([kx + Math.floor(kw / 2) - 0.6, ly - 1.5, kx + Math.floor(kw / 2) + 1.6, ly]);
  if (hinten != null) PK.nimm([x0 + w - 1.6, hinten - 0.6, x0 + w, hinten + 1.6]);
  anWand(objects, PK, K, 'p:fireplace', { seite: 'n' }) || anWand(objects, PK, K, 'p:fireplace', { seite: 'e' });
  setze(objects, PK, 'p:cauldron', K.x + K.w / 2, K.y + 1.9);
  if (tischGruppe(objects, PK, K.x + K.w / 2 + rnd(-0.5, 0.5), K.y + K.h / 2 + 0.5, { tisch: 'ph:woodentable_01', n: 0, s: 1.5, kerze: false, deko: false })) {
    objects.push(stampAt('ph:wooden_cutting_board', K.x + K.w / 2, K.y + K.h / 2 + 0.5, { s: 1.4, r: randInt(0, 359) }), stampAt(pick(['ph:brass_pot_02', 'ph:pot_enamel_01', 'ph:bananas', 'ph:carrot_cake']), K.x + K.w / 2 + 0.4, K.y + K.h / 2 + 0.4, { s: 1.4 }));
  }
  // Arbeitstisch an der Wand, Regale, Vorräte
  const at = anWand(objects, PK, K, pick(['ph:woodentable_01', 'ph:painted_wooden_table']), { s: 1.4, tries: 12 });
  if (at) objects.push(stampAt(pick(['ph:wooden_cutting_board', 'ph:brass_pan_01', 'ph:pot_enamel_01']), at.x, at.y, { s: 1.4, r: randInt(0, 359) }), stampAt(pick(['ph:wooden_bowl_01', 'ph:jug_01', 'ph:carrot_cake']), at.x + 0.35, at.y + 0.1, { s: 1.4 }));
  for (let i = 0, n = Math.round((K.w * K.h) / 7) + 2; i < n; i++) anWand(objects, PK, K, pick([...REGAL, ...FASS, ...SACK, 'ph:drawer_cabinet', 'ph:wooden_bucket_02_a']), { s: 1.3, tries: 8 });
  for (let i = 0; i < 2; i++) { const e = inEcke(objects, PK, K, pick(FASS), { s: 1.35 }); if (e) haufen(objects, PK, e.x, e.y, [...FASS, ...SACK], 2, { s: [1.2, 1.4], rad: 0.9 }); }
  streue(objects, PK, K, KRAM, randInt(3, 5), { s: [1.2, 1.6] });
  labels.push({ id: uid(6), kind: 'text', text: 'Küche', x: K.x + K.w / 2, y: K.y + K.h - 0.7, size: 0.5 });
  if (lagerH) {
    const L = { x: kx, y: ly, w: kw, h: lagerH };
    const PL = new Platz(W, H).nurIn((x, y) => x >= L.x && x < L.x + L.w && y >= L.y && y < L.y + L.h);
    PL.nimm([kx + Math.floor(kw / 2) - 0.6, ly, kx + Math.floor(kw / 2) + 1.6, ly + 1.5]);
    for (let i = 0; i < 4; i++) { const e = inEcke(objects, PL, L, pick(FASS), { s: 1.4 }); if (e) haufen(objects, PL, e.x, e.y, [...FASS, ...KISTE], 2, { s: [1.3, 1.5], rad: 1 }); }
    for (let i = 0; i < 4; i++) anWand(objects, PL, L, pick([...KISTE, 'ph:wooden_ladder']), { s: 1.4 });
    streue(objects, PL, L, SACK, 3, { s: [1.3, 1.7] });
    labels.push({ id: uid(6), kind: 'text', text: 'Lager', x: L.x + L.w / 2, y: L.y + L.h - 0.6, size: 0.45 });
  }
  labels.push({ id: uid(6), kind: 'text', text: 'Schankraum', x: x0 + T.w / 2, y: y0 + h - 1.2, size: 0.7 });
  return base({ shapes, objects, labels, dark: 0.22, floorTex: 'old_wood_floor', wallTex: pick(['wood_plank_wall', 'beam_wall_01', 'wood_trunk_wall']), ground: 'dirt' });
}

// ───────────────────────── Tempel, Krypta, Gruft ─────────────────────────
function genTemple(W, H) {
  const art = W * H < 400 ? pick(['tempel', 'krypta']) : pick(['tempel', 'krypta', 'gruft']);
  return art === 'tempel' ? genTempel(W, H) : art === 'krypta' ? genKrypta(W, H) : genGruft(W, H);
}
// Kirchenschiff mit Apsis, Säulenreihen, Bänken und (bei Breite) Seitenkapellen
function genTempel(W, H) {
  const w = clamp(W - 4, 10, 44);
  const h = clamp(H - 4, 12, 36);
  const x0 = Math.floor((W - w) / 2);
  const y0 = Math.floor((H - h) / 2);
  const cx = x0 + Math.round(w / 2);
  const shapes = [];
  const objects = [];
  const labels = [];
  const terrain = [];
  const seite = w >= 20 ? 3 : 0;
  const N = { x: x0 + seite, y: y0 + 3, w: w - seite * 2, h: h - 6 };
  const verfallen = chance(0.3);
  shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [N.x, N.y, N.x + N.w, N.y + N.h], tex: pick(['marble_01', 'monastery_stone_floor', 'large_sandstone_blocks_01', 'slab_tiles']) });
  const ar = clamp(Math.round(N.w * 0.3), 3, 6);
  shapes.push({ id: uid(6), op: 'add', kind: 'ellipse', pts: [cx - ar, y0, cx + ar, y0 + 6], tex: pick(['marble_mosaic_tiles', 'old_mosaic_floor', 'marble_01']) });
  const pw = clamp(Math.round(N.w * 0.35), 4, 8);
  shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [cx - Math.round(pw / 2), N.y + N.h, cx - Math.round(pw / 2) + pw, y0 + h], tex: 'large_sandstone_blocks_01' });
  objects.push(stampAt('p:door2', cx, y0 + h));
  const P = new Platz(W, H);
  P.nimm([cx - 1.5, N.y + N.h - 2, cx + 1.5, y0 + h]);
  // Altar in der Apsis, Statue dahinter, Kohlebecken daneben
  setze(objects, P, 'p:altar', cx, y0 + 3.2);
  setze(objects, P, 'ph:gothic_statue', cx, y0 + 1.5, { s: 1.4 });
  for (const sd of [-1, 1]) { setze(objects, P, 'p:brazier', cx + sd * (ar - 1.2), y0 + 3.5); setze(objects, P, KERZEN[0], cx + sd * 1.8, y0 + 2.2, { s: 0.9 }); }
  // Säulenreihen
  const px = [N.x + 1.5, N.x + N.w - 1.5];
  for (let y = N.y + 2.5; y < N.y + N.h - 2; y += 3) for (const x of px) { setze(objects, P, 'p:pillar', x, y, { pad: 0.05 }); if (chance(0.4)) setze(objects, P, 'p:brazier', x + (x < cx ? 1.1 : -1.1), y + 1.5); }
  // Bänke in zwei Blöcken, Mittelgang frei
  const gang = 1.3;
  for (let y = N.y + 4.5; y < N.y + N.h - 3; y += 1.25) {
    for (const sd of [-1, 1]) {
      const inner = cx + sd * gang;
      const outer = sd < 0 ? N.x + 2.6 : N.x + N.w - 2.6;
      for (let x = inner + sd * 0.75; sd < 0 ? x > outer : x < outer; x += sd * 1.5) {
        if (verfallen && chance(0.3)) continue;
        setze(objects, P, 'ph:painted_wooden_bench', x, y, { r: 180 + (verfallen ? randInt(-25, 25) : 0), s: 1.85, pad: 0.02 });
      }
    }
  }
  for (let y = N.y + 2; y < N.y + N.h + 1; y += 3.8) objects.push(stampAt('p:rugGreen', cx, y, { s: 0.95 }));
  // Seitenkapellen
  if (seite) {
    for (let y = N.y + 2; y + 4 <= N.y + N.h - 2; y += 6) {
      for (const sd of [-1, 1]) {
        const R = { x: sd < 0 ? x0 : N.x + N.w, y, w: seite, h: 4 };
        shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [R.x, R.y, R.x + R.w, R.y + R.h], tex: 'marble_mosaic_tiles' });
        const back = sd < 0 ? 'w' : 'e';
        const PK = new Platz(W, H).nurIn((x, yy) => x >= R.x && x < R.x + R.w && yy >= R.y && yy < R.y + R.h);
        anWand(objects, PK, R, pick(['ph:gothic_statue', 'p:altar']), { seite: back, at: 0.5, s: 0.9 });
        for (const k of [0.1, 0.9]) anWand(objects, PK, R, KERZEN[0], { seite: back, at: k, s: 0.8, tries: 2 });
      }
    }
  }
  if (chance(0.5)) setze(objects, P, 'p:fountain', cx, y0 + h - 1.6, { s: 0.9 });
  if (verfallen) {
    streue(objects, P, N, ['p:rubble', 'p:rubble', ...SETS.fels.keys], Math.round(N.w * N.h / 25), { s: [0.7, 1.2], mark: false });
    for (let i = 0; i < 4; i++) objects.push(stampAt('p:web', N.x + (i % 2 ? N.w - 1 : 1), N.y + (i < 2 ? 1 : N.h - 1), { s: 1, r: randInt(0, 359), layer: 'top' }));
    terrain.push(fleck('tex:mossy_brick_floor', N.x + rnd(2, N.w - 2), N.y + rnd(2, N.h - 2), rnd(2, 4), rnd(2, 4)));
  }
  labels.push({ id: uid(6), kind: 'text', text: verfallen ? 'Verfallener Tempel' : 'Tempel', x: cx, y: y0 + h - 0.8, size: 0.6 });
  return base({ shapes, terrain, objects, labels, dark: verfallen ? 0.4 : 0.28, floorTex: 'marble_01', wallTex: pick(['large_sandstone_blocks', 'castle_wall_slates', 'church_bricks_03']), ground: 'dark_rock' });
}
// Grabhalle mit Säulenraster, Sarkophagreihen, Wandnischen mit Särgen und einem Beinhaus
function genKrypta(W, H) {
  const w = clamp(W - 6, 10, 44);
  const h = clamp(H - 6, 8, 32);
  const x0 = Math.floor((W - w) / 2);
  const y0 = Math.floor((H - h) / 2);
  const shapes = [{ id: uid(6), op: 'add', kind: 'rect', pts: [x0, y0, x0 + w, y0 + h], tex: pick(['kryptastein', 'monastery_stone_floor', 'slab_tiles']) }];
  const objects = [];
  const labels = [];
  const P = new Platz(W, H).nurIn((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h);
  // Eingang unten mit Treppe
  const ex = x0 + Math.floor(w / 2);
  objects.push(stampAt('p:door', ex + 0.5, y0 + h));
  setze(objects, P, 'p:stairs', ex + 0.5, y0 + h - 1.1, { r: 180 });
  P.nimm([ex - 1, y0 + h - 3, ex + 2, y0 + h]);
  // Wandnischen mit Särgen oben und unten
  for (let x = x0 + 1; x < x0 + w - 1; x += 2) {
    for (const top of [true, false]) {
      if (!top && Math.abs(x - ex) < 3) continue;
      if (chance(0.25)) continue;
      shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: top ? [x, y0 - 2, x + 1, y0] : [x, y0 + h, x + 1, y0 + h + 2], tex: 'kryptastein' });
      objects.push(stampAt('p:coffin', x + 0.5, top ? y0 - 1 : y0 + h + 1, { r: top ? 0 : 180, s: 0.9 }));
    }
  }
  // Ehrengrab oben in der Mitte, davor bleibt der Mittelgang frei
  const R = { x: x0, y: y0, w, h };
  anWand(objects, P, R, 'p:sarcophagus', { seite: 'n', at: 0.5, s: 1.2 });
  for (const k of [0.4, 0.6]) anWand(objects, P, R, KERZEN[0], { seite: 'n', at: k, tries: 2 });
  P.nimm([ex - 0.6, y0 + 2.6, ex + 1.6, y0 + h]);
  // Säulenraster und Sarkophage dazwischen
  const sx = 4;
  for (let y = y0 + 2; y <= y0 + h - 2; y += sx) for (let x = x0 + 2; x <= x0 + w - 2; x += sx) setze(objects, P, 'p:pillarSq', x, y, { pad: 0.05 });
  for (let y = y0 + 4; y <= y0 + h - 3; y += sx) {
    for (let x = x0 + 4; x <= x0 + w - 4; x += sx) {
      if (chance(0.3)) continue;
      setze(objects, P, chance(0.75) ? 'p:sarcophagus' : 'p:coffin', x + rnd(-0.2, 0.2), y - 0.2, { r: chance(0.8) ? 0 : 90 });
    }
  }
  for (let y = y0 + 3; y < y0 + h - 3; y += 3.8) objects.push(stampAt('p:rugGreen', ex + 0.5, y, { s: 0.9 }));
  // Beinhaus in einer Ecke
  const ecke = [chance(0.5) ? x0 + 2 : x0 + w - 2, chance(0.5) ? y0 + 2 : y0 + h - 3];
  haufen(objects, P, ecke[0], ecke[1], ['p:skull', 'p:skull', 'p:bones', 'ph:skelett_boden'], randInt(6, 10), { s: [0.8, 1.1], rad: 1.6 });
  streue(objects, P, R, ['p:bones', 'p:rubble', 'p:blood'], Math.round((w * h) / 40), { s: [0.7, 1], mark: false });
  for (let i = 0; i < 4; i++) if (chance(0.6)) objects.push(stampAt('p:web', x0 + (i % 2 ? w - 1 : 1), y0 + (i < 2 ? 1 : h - 1), { s: 1, r: randInt(0, 359), layer: 'top' }));
  for (let i = 0, n = Math.round((w * h) / 70) + 1; i < n; i++) inEcke(objects, P, { x: x0 + rnd(0, w / 2), y: y0 + rnd(0, h / 2), w: w / 2, h: h / 2 }, 'p:brazier');
  labels.push({ id: uid(6), kind: 'text', text: 'Krypta', x: ex + 0.5, y: y0 + h - 3.4, size: 0.7 });
  return base({ shapes, objects, labels, dark: 0.42, floorTex: 'kryptastein', wallTex: pick(['large_sandstone_blocks', 'old_stone_wall', 'castle_brick_01']), ground: 'dark_rock' });
}
// Gruftanlage: Mittelhalle mit Grabkammern links und rechts (je eigene Tür)
function genGruft(W, H) {
  const w = clamp(W - 4, 16, 46);
  const h = clamp(H - 4, 12, 34);
  const x0 = Math.floor((W - w) / 2);
  const y0 = Math.floor((H - h) / 2);
  const hw = Math.max(clamp(Math.round(w * 0.36), 6, 14), w - 20);   // Kammern höchstens 9 Felder breit
  const hx = x0 + Math.round((w - hw) / 2);
  const shapes = [{ id: uid(6), op: 'add', kind: 'rect', pts: [hx, y0, hx + hw, y0 + h], tex: pick(['kryptastein', 'marble_01', 'monastery_stone_floor']) }];
  const objects = [];
  const labels = [];
  const P = new Platz(W, H).nurIn((x, y) => x >= hx && x < hx + hw && y >= y0 && y < y0 + h);
  const ex = hx + Math.floor(hw / 2);
  objects.push(stampAt('p:door2', ex, y0 + h));
  P.nimm([ex - 1.5, y0 + h - 3, ex + 1.5, y0 + h]);
  // Halle: Säulen, Läufer, Statue am Kopfende
  for (let y = y0 + 2.5; y < y0 + h - 2; y += 3) for (const x of [hx + 1.5, hx + hw - 1.5]) setze(objects, P, 'p:pillar', x, y, { pad: 0.05 });
  for (let y = y0 + 2; y < y0 + h; y += 3.8) objects.push(stampAt('p:rugGreen', ex, y, { s: 0.9 }));
  const H0 = { x: hx, y: y0, w: hw, h };
  anWand(objects, P, H0, pick(['ph:opferaltar', 'p:altar', 'ph:gothic_statue']), { seite: 'n', at: 0.5, s: 0.9 });
  for (const k of [0.2, 0.8]) anWand(objects, P, H0, 'p:brazier', { seite: 'n', at: k, tries: 2 });
  // Grabkammern
  const themen = ['sarkophag', 'saerge', 'schatz', 'gebeine', 'verfallen', 'ritual'];
  let nr = 0;
  for (const sd of [-1, 1]) {
    const cxL = sd < 0 ? x0 : hx + hw + 1;
    const cw = sd < 0 ? hx - 1 - x0 : x0 + w - (hx + hw + 1);
    if (cw < 3) continue;
    let y = y0;
    while (y + 3 <= y0 + h) {
      const ch = Math.min(randInt(4, 7), y0 + h - y);
      if (ch < 3) break;
      const R = { x: cxL, y, w: cw, h: ch };
      shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [R.x, R.y, R.x + R.w, R.y + R.h], ...(chance(0.5) ? { tex: 'kryptastein' } : {}) });
      const dy = y + Math.floor(ch / 2);
      const gx = sd < 0 ? hx - 1 : hx + hw;
      shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [gx, dy, gx + 1, dy + 1] });
      objects.push(stampAt(chance(0.15) ? 'p:secret' : pick(['p:door', 'p:doorIron', 'p:portcullis']), sd < 0 ? gx : gx + 1, dy + 0.5, { r: 90 }));
      P.nimm(sd < 0 ? [hx, dy - 1, hx + 1.5, dy + 2] : [hx + hw - 1.5, dy - 1, hx + hw, dy + 2]);
      const PK = new Platz(W, H).nurIn((x, yy) => x >= R.x && x < R.x + R.w && yy >= R.y && yy < R.y + R.h);
      PK.nimm(sd < 0 ? [R.x + R.w - 1.6, dy - 1, R.x + R.w, dy + 2] : [R.x, dy - 1, R.x + 1.6, dy + 2]);
      const th = pick(themen);
      const back = sd < 0 ? 'w' : 'e';
      if (th === 'sarkophag') { setze(objects, PK, 'p:sarcophagus', R.x + R.w / 2, R.y + R.h / 2, { r: 90 }); for (const k of [0.15, 0.85]) anWand(objects, PK, R, KERZEN[0], { seite: back, at: k, s: 0.8, tries: 2 }); anWand(objects, PK, R, 'ph:gothic_statue', { seite: back, at: 0.5, s: 0.8 }); }
      if (th === 'saerge') for (const s2 of ['n', 's', back]) reihe(objects, PK, R, 'p:coffin', s2, { s: 0.85, gap: 0.4 });
      if (th === 'schatz') { anWand(objects, PK, R, pick(['ph:treasure_chest', 'ph:juwelentruhe']), { seite: back, at: 0.5, s: 1.3 }); objects.push(stampAt('ph:goldhaufen', R.x + R.w / 2, R.y + R.h / 2, { s: 0.9, layer: 'floor', r: randInt(0, 359) })); streue(objects, PK, R, ['p:trap'], 1, { mark: false, rot: false }); }
      if (th === 'gebeine') haufen(objects, PK, R.x + R.w / 2, R.y + R.h / 2, ['p:bones', 'p:skull', 'ph:skelett_boden'], randInt(4, 7), { s: [0.8, 1], rad: Math.min(R.w, R.h) / 2 - 0.4 });
      if (th === 'verfallen') { haufen(objects, PK, R.x + R.w / 2, R.y + R.h / 2, ['p:rubble', ...SETS.fels.keys], randInt(3, 5), { s: [0.7, 1.1], rad: 1.4 }); objects.push(stampAt('p:web', R.x + R.w / 2, R.y + 1, { s: 0.9, layer: 'top', r: randInt(0, 359) })); }
      if (th === 'ritual') { objects.push(stampAt('p:magic', R.x + R.w / 2, R.y + R.h / 2, { s: Math.min(R.w, R.h) >= 5 ? 0.9 : 0.65 })); streue(objects, PK, R, [...KERZEN, 'p:skull'], 3, { s: [0.8, 0.9] }); }
      // je nach Größe weiter füllen
      const pool = { sarkophag: [...KERZEN, 'ph:gothic_statue', 'p:coffin'], saerge: ['p:coffin', ...KERZEN, 'p:bones'], schatz: ['ph:treasure_chest', 'ph:gothic_statue', ...KISTE, 'ph:kite_shield'], gebeine: ['ph:skelett_boden', 'p:coffin', 'p:bones'], verfallen: ['p:rubble', ...SETS.fels.keys, 'p:coffin'], ritual: [...KERZEN, 'ph:gothic_statue', 'p:brazier'] }[th];
      for (let k = 0, n = Math.floor((R.w * R.h) / 9); k < n; k++) { const key = pick(pool); anWand(objects, PK, R, key, { s: skal(key), tries: 6 }); }
      streue(objects, PK, R, ['p:bones', 'p:rubble', 'p:skull'], Math.round((R.w * R.h) / 14), { s: [0.7, 1], mark: false });
      if (chance(0.5)) objects.push(stampAt('p:web', R.x + (sd < 0 ? 0.9 : R.w - 0.9), R.y + (chance(0.5) ? 0.9 : R.h - 0.9), { s: 0.8, r: randInt(0, 359), layer: 'top' }));
      labels.push({ id: uid(6), kind: 'room', text: String(++nr), x: R.x + 0.55, y: R.y + 0.55, size: 0.5 });
      y += ch + 1;
    }
  }
  streue(objects, P, H0, ['p:bones', 'p:rubble'], Math.round(hw * h / 40), { s: [0.7, 1], mark: false });
  labels.push({ id: uid(6), kind: 'text', text: 'Gruft', x: ex, y: y0 + h - 2.6, size: 0.7 });
  return base({ shapes, objects, labels, dark: 0.45, floorTex: 'kryptastein', wallTex: pick(['large_sandstone_blocks', 'old_stone_wall', 'mossy_stone_wall']), ground: 'dark_rock' });
}

// ───────────────────────── Waldlichtung mit Lager ─────────────────────────
// opts.party = Zahl der Spielercharaktere → so viele Zelte stehen um das Feuer
function genClearing(W, H, opts = {}) {
  const party = clamp(Math.round(Number(opts.party) || 4), 1, 8);
  const cx = W / 2 + rnd(-W, W) * 0.06;
  const cy = H / 2 + rnd(-H, H) * 0.06;
  const rx = Math.max(5, W * rnd(0.3, 0.37));
  const ry = Math.max(4.5, H * rnd(0.3, 0.37));
  const rand = blob(cx, cy, rx, ry, { n: 24, j: 0.18 });
  const innen = (x, y, f = 1) => inPoly(rand, cx + (x - cx) / f, cy + (y - cy) / f);
  const terrain = [];
  const objects = [];
  const P = new Platz(W, H);
  // Waldboden draußen in Flecken, drinnen Wiese mit Abwechslung
  for (let i = 0, n = Math.round((W * H) / 70); i < n; i++) terrain.push(fleck(pick(['tex:forest_leaves_02', 'tex:dry_decay_leaves', 'tex:forest_leaves_03', 'tex:brown_mud_leaves_01', 'tex:forest_ground_04']), rnd(0, W), rnd(0, H), rnd(2, 5), rnd(2, 4)));
  terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: 'tex:leafy_grass', pts: blob(cx, cy, rx * 1.06, ry * 1.06, { n: 24, j: 0.2 }) });
  for (let i = 0, n = randInt(4, 7); i < n; i++) {
    const a = rnd(0, TAU);
    const d = rnd(0.2, 0.75);
    terrain.push(fleck(pick(['tex:forrest_ground_01', 'tex:withered_grass', 'tex:forrest_ground_01']), cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rnd(1.5, 3.2), rnd(1.2, 2.6)));
  }
  // Lagerplatz: festgetretene Erde um das Feuer
  const fx = Math.floor(cx) + 0.5;
  const fy = Math.floor(cy) + 0.5;
  const lagerR = 3.2 + party * 0.35;
  terrain.push(fleck(pick(['tex:dirt', 'tex:dry_ground_01', 'tex:forrest_ground_01']), fx, fy, lagerR * 0.75, lagerR * 0.62, 0.3));
  // Trampelpfad vom Lager aus dem Wald
  const seite = pick(SEITEN);
  const ziel = randPunkt(W, H, seite);
  const zw = Math.atan2(ziel[1] - fy, ziel[0] - fx);
  const pfad = wander([fx + Math.cos(zw) * lagerR * 0.75, fy + Math.sin(zw) * lagerR * 0.75], ziel, { bend: 0.3, steps: 6 });
  terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: 1.4, mat: pick(['tex:dirt', 'tex:rocky_trail']), pts: flat(pfad) });
  sperreWeg(P, pfad, 1.4);
  // Wasser: Bach am Rand der Lichtung oder ein Teich
  let wasser = null;
  if (chance(0.45)) {
    const quer = chance(0.5);
    const off = (quer ? ry : rx) * rnd(0.55, 0.8) * (chance(0.5) ? 1 : -1);
    const a = quer ? [-1, cy + off + rnd(-2, 2)] : [cx + off + rnd(-2, 2), -1];
    const b = quer ? [W + 1, cy + off + rnd(-2, 2)] : [cx + off + rnd(-2, 2), H + 1];
    wasser = wander(a, b, { bend: 0.15, steps: 7 });
    terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: 2.6, mat: 'tex:river_small_rocks', pts: flat(wasser) });
    terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: r2(rnd(1.2, 1.7)), mat: 'water', pts: flat(wasser) });
    sperreWeg(P, wasser, 2.4);
  } else if (chance(0.5)) {
    const a = rnd(0, TAU);
    const tx = cx + Math.cos(a) * rx * 0.62;
    const ty = cy + Math.sin(a) * ry * 0.62;
    if (Math.hypot(tx - fx, ty - fy) > lagerR + 2.5) {
      terrain.push(fleck('tex:damp_sand', tx, ty, 2.8, 2.1));
      const teich = blob(tx, ty, rnd(1.6, 2.4), rnd(1.2, 1.8), { j: 0.25 });
      terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: 'water', pts: teich });
      P.nimm([tx - 2.6, ty - 2, tx + 2.6, ty + 2]);
      streue(objects, null, () => { const b = rnd(0, TAU); return { x: tx + Math.cos(b) * rnd(2.2, 3), y: ty + Math.sin(b) * rnd(1.7, 2.4) }; }, [...SETS.gras.keys, ...SETS.fels.keys], 10, { s: [0.8, 2] });
    }
  }
  // Feuerstelle, Kochtopf, Sitzstämme
  setze(objects, P, 'ph:stone_fire_pit', fx, fy, { s: 1.2, mark: false });
  setze(objects, P, 'p:campfire', fx, fy, { s: 0.8 });
  if (chance(0.6)) setze(objects, P, 'p:cauldron', fx + 0.9, fy - 0.5, { s: 0.7, mark: false });
  const sitze = randInt(3, 4);
  const a0 = rnd(0, TAU);
  for (let i = 0; i < sitze; i++) {
    const a = a0 + (i / sitze) * TAU + rnd(-0.2, 0.2);
    const log = chance(0.6);
    setze(objects, P, log ? 'ph:dead_tree_trunk' : pick(['ph:tree_stump_01', 'ph:tree_stump_02']), fx + Math.cos(a) * 1.9, fy + Math.sin(a) * 1.9, { r: Math.round((a * 180) / Math.PI) + 90, s: log ? 0.85 : 0.55 });
  }
  // Zelte im Bogen um das Feuer, Eingang zum Feuer – eines je Spielercharakter
  const pfadWinkel = zw;
  const bogen = Math.min(TAU - 1.2, 0.95 * party);
  let gesetzt = 0;
  for (let versuch = 0; versuch < 4 && gesetzt < party; versuch++) {
    const R = lagerR + 1 + versuch * 0.8;
    for (let i = 0; i < party && gesetzt < party; i++) {
      const a = pfadWinkel + Math.PI - bogen / 2 + (party > 1 ? (bogen * i) / (party - 1) : bogen / 2) + rnd(-0.12, 0.12) + versuch * 0.3;
      const x = fx + Math.cos(a) * R;
      const y = fy + Math.sin(a) * R * 0.9;
      if (!innen(x, y, 0.92)) continue;
      const t = setze(objects, P, 'p:tent', x, y, { r: faceTo(fx - x, fy - y), s: rnd(0.7, 0.8), pad: 0.25 });
      if (!t) continue;
      gesetzt++;
      const b = a + (chance(0.5) ? 0.5 : -0.5);
      if (chance(0.6)) setze(objects, P, pick([...KISTE, ...FASS, 'ph:treasure_chest', 'ph:wicker_basket_01', 'ph:wooden_bucket_01']), fx + Math.cos(b) * (R - 0.4), fy + Math.sin(b) * (R - 0.4) * 0.9, { r: randInt(0, 359), s: 1.2 });
    }
  }
  // Holzstapel, Waffenständer, Tisch
  const lagerPunkt = (f0, f1) => () => { const a = rnd(0, TAU); const d = rnd(f0, f1); return { x: fx + Math.cos(a) * d, y: fy + Math.sin(a) * d * 0.9 }; };
  haufen(objects, P, ...Object.values(lagerPunkt(lagerR * 0.8, lagerR * 1.2)()), [...SETS.reisig.keys, 'ph:dead_tree_trunk'], randInt(3, 5), { s: [0.8, 1.6], rad: 0.8 });
  if (chance(0.45)) streue(objects, P, lagerPunkt(lagerR * 0.7, lagerR + 1.5), ['ph:waffenstaender'], 1, { s: [0.75, 0.8] });
  if (chance(0.35)) streue(objects, P, lagerPunkt(lagerR * 0.6, lagerR + 1), ['ph:wooden_picnic_table'], 1, { s: [0.75, 0.8] });
  // Baumring am Rand, dahinter dichter Wald
  const n = Math.round((rx + ry) * 1.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.08, 0.08);
    const f = rnd(1.02, 1.2);
    const x = cx + Math.cos(a) * rx * f;
    const y = cy + Math.sin(a) * ry * f;
    if (distPath(pfad, x, y) < 2.2 || (wasser && distPath(wasser, x, y) < 2)) continue;
    const S = SETS[pick(['laubbaum', 'laubbaum', 'nadelbaum', 'jungbaum'])];
    objects.push(stampAt(pick(S.keys), x, y, { r: randInt(0, 359), s: rnd(S.s[0], S.s[1]), fx: chance(0.5) }));
  }
  baeume(objects, W, H, Math.round((W * H) / 7), { min: 2.1, ok: (x, y) => !innen(x, y, 1.12) && distPath(pfad, x, y) > 1.9 && (!wasser || distPath(wasser, x, y) > 1.8), sets: [['laubbaum', 0.4], ['nadelbaum', 0.4], ['jungbaum', 0.2]] });
  // Unterholz am Rand, Gras und Blumen auf der Wiese
  const ring = (f0, f1) => () => { const a = rnd(0, TAU); const f = rnd(f0, f1); const x = cx + Math.cos(a) * rx * f; const y = cy + Math.sin(a) * ry * f; return distPath(pfad, x, y) > 1.2 ? { x, y } : null; };
  streue(objects, P, ring(0.82, 1.05), [...SETS.busch.keys, ...SETS.farn.keys], Math.round(n * 1.2), { s: [0.9, 1.6] });
  const wiese = () => { const x = rnd(0, W); const y = rnd(0, H); return innen(x, y, 0.95) && Math.hypot(x - fx, y - fy) > lagerR * 0.7 ? { x, y } : null; };
  streue(objects, null, wiese, SETS.gras.keys, Math.round(rx * ry * 1.3), { s: [1.4, 2.8], tries: 3 });
  streue(objects, null, wiese, SETS.blume.keys, Math.round(rx * ry * 0.45), { s: [1.2, 2.2], tries: 3 });
  streue(objects, P, wiese, [...SETS.fels.keys, 'ph:tree_stump_01', 'ph:dead_tree_trunk_02'], randInt(3, 6), { s: [0.7, 1.1] });
  streue(objects, null, () => { const x = rnd(0, W); const y = rnd(0, H); return innen(x, y, 1.1) ? null : { x, y }; }, [...SETS.farn.keys, ...SETS.reisig.keys, ...SETS.wurzel.keys], Math.round((W * H) / 12), { s: [0.9, 1.8], tries: 2 });
  return base({ terrain, objects, outdoor: true, ground: 'forest_floor', dark: 0.14, floorTex: 'forest_floor', soft: 0.4 });
}

// ───────────────────────── Dichter Wald ─────────────────────────
function genForest(W, H) {
  const terrain = [];
  const objects = [];
  // Boden in vielen Flecken: Laub, Moos, Schlamm, Nadeln
  const mats = ['tex:forest_leaves_02', 'tex:dry_decay_leaves', 'tex:forest_ground_04', 'tex:forest_ground_05', 'tex:forest_ground_06', 'tex:brown_mud_leaves_01', 'tex:mud_forest', 'tex:forest_leaves_03', 'tex:forest_leaves_04', 'tex:forrest_ground_03'];
  for (let i = 0, n = Math.round((W * H) / 40) + 4; i < n; i++) terrain.push(fleck(pick(mats), rnd(-1, W + 1), rnd(-1, H + 1), rnd(2, 6), rnd(1.6, 5), 0.3));
  // Zufälliger Weg zwischen zwei Rändern, manchmal mit Abzweig
  const s1 = pick(SEITEN);
  const s2 = pick(SEITEN.filter((x) => x !== s1));
  const pw = r2(rnd(1.6, 2.4));
  const wegMat = pick(['tex:dirt', 'tex:rocky_trail', 'tex:forrest_ground_01']);
  const wege = [wander(randPunkt(W, H, s1), randPunkt(W, H, s2), { bend: 0.32, steps: 8 })];
  if (chance(0.45)) { const p = aufWeg(wege[0], rnd(0.3, 0.7)); wege.push(wander([p.x, p.y], chance(0.5) ? randPunkt(W, H, pick(SEITEN.filter((x) => x !== s1 && x !== s2))) : [rnd(W * 0.2, W * 0.8), rnd(H * 0.2, H * 0.8)], { bend: 0.35, steps: 5 })); }
  wege.forEach((w, i) => terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: i ? r2(pw * 0.75) : pw, mat: wegMat, pts: flat(w) }));
  const amWeg = (x, y, d) => wege.some((w, i) => distPath(w, x, y) < (i ? pw * 0.75 : pw) / 2 + d);
  // Kleine Lichtungen, Tümpel oder Moor
  const lichtungen = [];
  for (let i = 0, n = randInt(1, 2 + Math.floor((W * H) / 1200)); i < n; i++) {
    const x = rnd(W * 0.15, W * 0.85);
    const y = rnd(H * 0.15, H * 0.85);
    const r = rnd(2, 3.6);
    lichtungen.push({ x, y, r });
    terrain.push(fleck(pick(['tex:sparse_grass', 'tex:leafy_grass', 'tex:withered_grass']), x, y, r, r * 0.8));
  }
  let tuempel = null;
  if (chance(0.4)) {
    const x = rnd(W * 0.15, W * 0.85);
    const y = rnd(H * 0.15, H * 0.85);
    if (!amWeg(x, y, 3.5)) { tuempel = { x, y, r: rnd(1.8, 3) }; terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: chance(0.5) ? 'swamp' : 'water', pts: blob(x, y, tuempel.r, tuempel.r * 0.75, { j: 0.3 }) }); }
  }
  const frei = (x, y, d = 0) => !amWeg(x, y, d) && !lichtungen.some((l) => Math.hypot(l.x - x, l.y - y) < l.r * 0.8 + d) && !(tuempel && Math.hypot(tuempel.x - x, tuempel.y - y) < tuempel.r + d);
  // Bäume dicht an dicht, Unterholz überall
  baeume(objects, W, H, Math.round((W * H) / 3.2), { min: 1.75, ok: (x, y) => frei(x, y, 0.9), sets: [['nadelbaum', 0.45], ['laubbaum', 0.33], ['jungbaum', 0.22]] });
  const irgendwo = (d) => () => { const x = rnd(0, W); const y = rnd(0, H); return frei(x, y, d) ? { x, y } : null; };
  streue(objects, null, irgendwo(0.4), SETS.busch.keys, Math.round((W * H) / 9), { s: [0.9, 1.7], tries: 3 });
  streue(objects, null, irgendwo(0.2), SETS.farn.keys, Math.round((W * H) / 6), { s: [1, 2.2], tries: 3 });
  streue(objects, null, irgendwo(-0.3), SETS.reisig.keys, Math.round((W * H) / 12), { s: [1.2, 2.6], tries: 2 });
  streue(objects, null, irgendwo(0.3), [...SETS.wurzel.keys, 'ph:dead_tree_trunk_02'], Math.round((W * H) / 45), { s: [0.8, 1.3], tries: 3 });
  streue(objects, null, irgendwo(0.3), SETS.fels.keys, Math.round((W * H) / 60), { s: [0.7, 1.3], tries: 3 });
  for (const l of lichtungen) {
    streue(objects, null, () => { const a = rnd(0, TAU); const d = Math.sqrt(Math.random()) * l.r; return { x: l.x + Math.cos(a) * d, y: l.y + Math.sin(a) * d }; }, [...SETS.gras.keys, ...SETS.blume.keys], Math.round(l.r * l.r * 3), { s: [1.2, 2.6], tries: 1 });
    if (chance(0.35)) for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; objects.push(stampAt(pick(SETS.fels.keys), l.x + Math.cos(a) * l.r * 0.55, l.y + Math.sin(a) * l.r * 0.45, { s: 0.8, r: randInt(0, 359) })); }
  }
  if (tuempel) streue(objects, null, () => { const a = rnd(0, TAU); return { x: tuempel.x + Math.cos(a) * tuempel.r * rnd(0.9, 1.2), y: tuempel.y + Math.sin(a) * tuempel.r * 0.75 * rnd(0.9, 1.2) }; }, SETS.gras.keys, 18, { s: [1.5, 2.8] });
  return base({ terrain, objects, outdoor: true, ground: 'forest_floor', dark: 0.3, floorTex: 'forest_floor', soft: 0.45 });
}

// ───────────────────────── Dorf ─────────────────────────
// Geschwungene Hauptstraße mit Abzweigen, Häuser an den Straßen (Tür zur Straße), Dorfplatz an einer Kreuzung,
// Gärten, Pferch, Obstbäume – Häuser sind begehbar und innen eingerichtet (Dächer werden beim Betreten durchsichtig).
const HAUS_EINRICHTUNG = {
  wohnhaus(o, P, R, tuer) {
    const hinten = GEGEN[tuer];
    anWand(o, P, R, pick(BETT), { seite: hinten, s: 1.05 }) || anWand(o, P, R, pick(BETT), { s: 1.05 });
    anWand(o, P, R, 'p:fireplace', { s: 0.85, seite: pick(SEITEN.filter((x) => x !== tuer && x !== hinten)) }) || anWand(o, P, R, 'ph:stone_fire_pit', { s: 0.9 });
    tischGruppe(o, P, R.x + R.w / 2 + rnd(-0.4, 0.4), R.y + R.h / 2 + rnd(-0.4, 0.4), { tisch: pick(ECKTISCH), n: 2, s: 1.3 });
    anWand(o, P, R, 'ph:treasure_chest', { s: 1.1 });
    anWand(o, P, R, pick([...SCHRANK, ...REGAL]), { s: 1.1 });
    if (chance(0.3)) anWand(o, P, R, 'ph:spinning_wheel_01', { s: 1.3 });
    inEcke(o, P, R, pick(FASS), { s: 1.3 });
    if (chance(0.4)) o.push(stampAt('p:rugRound', R.x + R.w / 2, R.y + R.h / 2, { s: 0.7, layer: 'floor' }));
    streue(o, P, R, KRAM, randInt(1, 2), { s: [1.2, 1.5] });
  },
  gasthaus(o, P, R, tuer) {
    const hinten = GEGEN[tuer];
    anWand(o, P, R, 'p:counter', { seite: hinten, s: 0.9 });
    anWand(o, P, R, 'p:fireplace', { s: 0.9, seite: pick(SEITEN.filter((x) => x !== tuer && x !== hinten)) });
    for (let i = 0, ok = 0; i < 40 && ok < 4; i++) if (tischGruppe(o, P, rnd(R.x + 1.3, R.x + R.w - 1.3), rnd(R.y + 1.3, R.y + R.h - 1.3), { tisch: pick(RUNDTISCH), n: randInt(2, 3), s: 1.15 })) ok++;
    for (let i = 0; i < 3; i++) inEcke(o, P, R, pick(FASS), { s: 1.3 });
  },
  schmiede(o, P, R, tuer) {
    anWand(o, P, R, 'ph:stone_fire_pit', { seite: GEGEN[tuer], s: 1.1 });
    anWand(o, P, R, 'ph:waffenstaender', { s: 0.75 });
    anWand(o, P, R, 'ph:tool_cart', { s: 1.1 });
    inEcke(o, P, R, 'ph:wooden_bucket_02_a', { s: 1.4 });
    streue(o, P, R, [...KISTE, ...FASS, 'ph:kite_shield', 'ph:antique_estoc'], randInt(2, 4), { s: [1.2, 1.4] });
  },
  haendler(o, P, R, tuer) {
    anWand(o, P, R, 'p:counter', { seite: tuer === 'n' || tuer === 's' ? GEGEN[tuer] : pick(['n', 's']), s: 0.85 });
    for (let i = 0; i < 4; i++) anWand(o, P, R, pick([...REGAL, ...SCHRANK]), { s: 1.1 });
    streue(o, P, R, [...KISTE, ...FASS, ...SACK], randInt(3, 5), { s: [1.2, 1.5] });
  },
  scheune(o, P, R) {
    for (let i = 0; i < 3; i++) { const e = inEcke(o, P, R, pick(KISTE), { s: 1.4 }); if (e) haufen(o, P, e.x, e.y, [...KISTE, ...FASS], 2, { s: [1.3, 1.5], rad: 0.9 }); }
    anWand(o, P, R, 'ph:wooden_ladder', { s: 1.3 });
    haufen(o, P, R.x + R.w / 2, R.y + R.h / 2, SETS.reisig.keys, randInt(3, 6), { s: [1.5, 2.5], rad: 1.2 });
  },
  kraeuter(o, P, R) {
    setze(o, P, 'ph:hexenkessel_feuer', R.x + R.w / 2, R.y + R.h / 2, { s: 0.9 });
    anWand(o, P, R, pick(['p:bookshelf', 'ph:wooden_bookshelf_worn']));
    if (tischGruppe(o, P, R.x + 1.6, R.y + 1.6, { tisch: 'ph:woodentable_01', n: 1, s: 1.2, kerze: false, deko: false })) o.push(stampAt('ph:chemistry_set', R.x + 1.6, R.y + 1.6, { s: 1.1 }));
    anWand(o, P, R, pick(BETT), { s: 1 });
    streue(o, P, R, ['ph:planter_pot_clay', 'ph:kristallkugel', 'ph:ceramic_pot', 'ph:brass_vase_01'], randInt(2, 4), { s: [1.2, 1.6] });
  },
};

function genVillage(W, H) {
  const shapes = [];
  const terrain = [];
  const objects = [];
  const labels = [];
  const area = W * H;
  const P = new Platz(W, H);
  const gras = 'leafy_grass';
  // Boden: Wiese mit Flecken
  for (let i = 0, n = Math.round(area / 110) + 3; i < n; i++) terrain.push(fleck(pick(['tex:forrest_ground_01', 'tex:forrest_ground_01', 'tex:withered_grass', 'tex:sparse_grass']), rnd(0, W), rnd(0, H), rnd(2, 5), rnd(1.6, 4), 0.3));
  // Straßen
  const quer = W >= H ? chance(0.75) : chance(0.25);
  const haupt = wander(quer ? [-1, rnd(H * 0.35, H * 0.65)] : [rnd(W * 0.35, W * 0.65), -1], quer ? [W + 1, rnd(H * 0.35, H * 0.65)] : [rnd(W * 0.35, W * 0.65), H + 1], { bend: 0.16, steps: 7 });
  const strassen = [{ pts: haupt, w: 2.4 }];
  for (let i = 0, n = clamp(Math.round(area / 550), 1, 4); i < n; i++) {
    const p = aufWeg(haupt, rnd(0.2, 0.8));
    const ziel = chance(0.7)
      ? randPunkt(W, H, quer ? (chance(0.5) ? 'n' : 's') : (chance(0.5) ? 'w' : 'e'), clamp((quer ? p.x / W : p.y / H) + rnd(-0.2, 0.2), 0.1, 0.9))
      : [clamp(p.x + rnd(-W, W) * 0.3, 3, W - 3), clamp(p.y + rnd(-H, H) * 0.3, 3, H - 3)];
    strassen.push({ pts: wander([p.x, p.y], ziel, { bend: 0.25, steps: 5 }), w: 1.7 });
  }
  const mat1 = pick(['tex:cobblestone_floor_01', 'tex:stone_pathway', 'tex:grassy_cobblestone', 'tex:cobblestone_05']);
  const mat2 = pick(['tex:rocky_trail', 'tex:dirt', 'tex:gravel_ground_01']);
  strassen.forEach((s, i) => { terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: s.w, mat: i ? mat2 : mat1, pts: flat(s.pts) }); sperreWeg(P, s.pts, s.w + 0.3); });
  // Dorfplatz an der ersten Abzweigung (sonst mitten an der Hauptstraße)
  const sp = strassen[1] ? { x: strassen[1].pts[0][0], y: strassen[1].pts[0][1] } : aufWeg(haupt, 0.5);
  const pr = clamp(Math.sqrt(area) / 7, 3, 6);
  terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: pick(['tex:mossy_cobblestone', 'tex:cobblestone_floor_01', 'tex:patterned_cobblestone']), pts: blob(sp.x, sp.y, pr, pr * 0.85, { j: 0.15 }) });
  P.nimm([sp.x - pr, sp.y - pr * 0.85, sp.x + pr, sp.y + pr * 0.85]);
  // Häuser an den Straßen
  const soll = clamp(Math.round(area / 75), 4, 26);
  const haeuser = [];
  const kandidaten = [];
  strassen.forEach((s) => { let L = 0; for (let i = 1; i < s.pts.length; i++) L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); for (let d = 1; d < L - 1; d += 1.1) kandidaten.push({ s, t: d / L }); });
  for (const { s, t } of mischen(kandidaten)) {
    if (haeuser.length >= soll) break;
    const p = aufWeg(s.pts, t);
    const horizontal = Math.abs(p.dx) >= Math.abs(p.dy);
    for (const [sd, klein] of mischen([[-1, false], [1, false]]).concat([[pick([-1, 1]), true]])) {
      const lang = klein ? 4 : randInt(4, 7);
      const tief = klein ? 4 : randInt(4, 6);
      const hw = horizontal ? lang : tief;
      const hh = horizontal ? tief : lang;
      const nx = horizontal ? 0 : sd;
      const ny = horizontal ? sd : 0;
      const abst = s.w / 2 + 0.15 + rnd(0.6, 1.6) + (horizontal ? hh : hw) / 2;
      const hx = Math.round(p.x + nx * abst - hw / 2);
      const hy = Math.round(p.y + ny * abst - hh / 2);
      if (hx < 1 || hy < 1 || hx + hw > W - 1 || hy + hh > H - 1) continue;
      if (!P.frei([hx - 0.6, hy - 0.6, hx + hw + 0.6, hy + hh + 0.6])) continue;
      P.nimm([hx - 0.8, hy - 0.8, hx + hw + 0.8, hy + hh + 0.8]);
      const tuer = horizontal ? (sd > 0 ? 'n' : 's') : (sd > 0 ? 'w' : 'e');
      haeuser.push({ x: hx, y: hy, w: hw, h: hh, tuer, strasse: s });
      break;
    }
  }
  // Zweite Reihe: Höfe im freien Gelände, die Tür zeigt zur nächsten Straße
  for (let t = 0; t < 500 && haeuser.length < soll; t++) {
    const hw = randInt(4, 7);
    const hh = randInt(4, 6);
    const hx = randInt(1, W - hw - 1);
    const hy = randInt(1, H - hh - 1);
    if (!P.frei([hx - 0.6, hy - 0.6, hx + hw + 0.6, hy + hh + 0.6])) continue;
    const mx = hx + hw / 2;
    const my = hy + hh / 2;
    let best = null;
    for (const s of strassen) for (let q = 0; q <= 1; q += 0.02) { const p = aufWeg(s.pts, q); const d = Math.hypot(p.x - mx, p.y - my); if (!best || d < best.d) best = { d, s, p }; }
    if (!best || best.d > Math.max(8, Math.min(W, H) * 0.4)) continue;
    const vx = best.p.x - mx;
    const vy = best.p.y - my;
    P.nimm([hx - 0.8, hy - 0.8, hx + hw + 0.8, hy + hh + 0.8]);
    haeuser.push({ x: hx, y: hy, w: hw, h: hh, tuer: Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : (vy > 0 ? 's' : 'n'), strasse: best.s });
  }
  // Nutzung: Gasthaus am Platz, eine Schmiede, ein Händler, ein Kräuterhaus, sonst Wohnhäuser und Scheunen
  const nahPlatz = [...haeuser].sort((a, b) => Math.hypot(a.x + a.w / 2 - sp.x, a.y + a.h / 2 - sp.y) - Math.hypot(b.x + b.w / 2 - sp.x, b.y + b.h / 2 - sp.y));
  const gross = nahPlatz.find((h) => h.w * h.h >= 30);
  if (gross) gross.art = 'gasthaus';
  for (const [art, min] of [['schmiede', 5], ['haendler', 7], ['kraeuter', 10]]) { if (haeuser.length < min) continue; const h = mischen(haeuser).find((x) => !x.art); if (h) h.art = art; }
  for (const h of haeuser) if (!h.art) h.art = chance(0.2) ? 'scheune' : 'wohnhaus';
  const NAMEN = { gasthaus: 'Gasthaus', schmiede: 'Schmiede', haendler: 'Händler', kraeuter: 'Kräuterkundige' };
  for (const h of haeuser) {
    const floor = h.art === 'scheune' ? 'weathered_planks' : h.art === 'schmiede' ? 'rock_tile_floor' : pick(['old_wood_floor', 'wood_floor_worn', 'dark_wooden_planks', 'brown_planks_05']);
    shapes.push({ id: uid(6), op: 'add', kind: 'rect', pts: [h.x, h.y, h.x + h.w, h.y + h.h], tex: floor, roof: h.art === 'gasthaus' ? pick(['clay_roof_tiles', 'roof_slates_02']) : pick(DACH) });
    // Tür zur Straße
    const quer2 = h.tuer === 'n' || h.tuer === 's';
    const off = quer2 ? clamp(Math.floor(h.w / 2) + randInt(-1, 1), 1, h.w - 2) : clamp(Math.floor(h.h / 2) + randInt(-1, 1), 1, h.h - 2);
    const dx = quer2 ? h.x + off + 0.5 : h.tuer === 'w' ? h.x : h.x + h.w;
    const dy = quer2 ? (h.tuer === 'n' ? h.y : h.y + h.h) : h.y + off + 0.5;
    objects.push(stampAt(h.art === 'gasthaus' || h.art === 'scheune' ? 'p:door2' : 'p:door', dx + (h.art === 'gasthaus' || h.art === 'scheune' ? (quer2 ? 0.5 : 0) : 0), dy + (h.art === 'gasthaus' || h.art === 'scheune' ? (quer2 ? 0 : 0.5) : 0), { r: quer2 ? 0 : 90 }));
    // Einrichtung (eigene Belegung, Türbereich frei)
    const R = { x: h.x, y: h.y, w: h.w, h: h.h };
    const PH = new Platz(W, H).nurIn((x, y) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
    PH.nimm([dx - 1.2, dy - 1.2, dx + 1.2, dy + 1.2]);
    HAUS_EINRICHTUNG[h.art](objects, PH, R, h.tuer);
    // Trampelpfad von der Tür zur Straße
    const vor = [dx + (h.tuer === 'w' ? -0.6 : h.tuer === 'e' ? 0.6 : 0), dy + (h.tuer === 'n' ? -0.6 : h.tuer === 's' ? 0.6 : 0)];
    let best = null;
    for (let t = 0; t <= 1; t += 0.01) { const q = aufWeg(h.strasse.pts, t); const d = Math.hypot(q.x - vor[0], q.y - vor[1]); if (!best || d < best.d) best = { x: q.x, y: q.y, d }; }
    if (best && best.d > 0.8) { const pfad = wander(vor, [best.x, best.y], { bend: 0.2, steps: 3 }); terrain.push({ id: uid(6), op: 'add', kind: 'brush', w: 1.1, mat: mat2, pts: flat(pfad) }); sperreWeg(P, pfad, 1); }
    // Vor dem Haus: Fässer, Bank, Laterne, Holzstapel
    const aussen = { x: h.x - 1.4, y: h.y - 1.4, w: h.w + 2.8, h: h.h + 2.8 };
    const nahTuer = () => { const a = rnd(0, TAU); return { x: dx + Math.cos(a) * rnd(1.2, 2.2), y: dy + Math.sin(a) * rnd(1.2, 2.2) }; };
    streue(objects, P, nahTuer, [...FASS, ...KISTE, ...SACK], randInt(0, 2), { s: [1.2, 1.4], tries: 5 });
    if (chance(0.45)) objects.push(stampAt('p:torch', dx + (quer2 ? 0.9 : 0), dy + (quer2 ? 0 : 0.9), { s: 1.5 }));
    if (chance(0.35)) haufen(objects, P, ...Object.values(streuPunkt(aussen)), [...SETS.reisig.keys, 'ph:dead_tree_trunk'], randInt(2, 4), { s: [0.8, 1.5], rad: 0.6 });
    if (chance(0.35)) streue(objects, P, () => streuPunkt(aussen), ['ph:painted_wooden_bench'], 1, { s: [1.4, 1.5], rot: false });
    // Garten hinter manchen Häusern
    if (h.art === 'wohnhaus' && chance(0.4)) garten(objects, terrain, P, h, W, H);
    if (NAMEN[h.art]) labels.push({ id: uid(6), kind: 'text', text: NAMEN[h.art], x: h.x + h.w / 2, y: quer2 ? (h.tuer === 'n' ? h.y - 0.6 : h.y + h.h + 0.6) : h.y + h.h / 2, size: 0.45 });
  }
  // Dorfplatz: Brunnen, Marktstände, Anschlagtafel, Dorfbaum, Bänke
  const PP = new Platz(W, H);
  for (const h of haeuser) PP.nimm([h.x - 0.5, h.y - 0.5, h.x + h.w + 0.5, h.y + h.h + 0.5]);
  setze(objects, PP, area > 1500 && chance(0.5) ? 'p:fountain' : 'p:well', sp.x, sp.y, { s: 1.3 });
  const amPlatz = (f0, f1) => () => { const a = rnd(0, TAU); const d = rnd(f0, f1) * pr; return { x: sp.x + Math.cos(a) * d, y: sp.y + Math.sin(a) * d * 0.85 }; };
  for (let i = 0, n = clamp(Math.round(pr - 1), 2, 5); i < n; i++) {
    for (let t = 0; t < 10; t++) {
      const p = amPlatz(0.45, 0.85)();
      if (tischGruppe(objects, PP, p.x, p.y, { tisch: pick(['ph:woodentable_01', 'ph:painted_wooden_table', 'ph:wooden_table_02']), n: 0, s: 1.3, kerze: false, deko: false, dreh: faceTo(sp.x - p.x, sp.y - p.y) })) {
        haufen(objects, PP, p.x, p.y, [...KISTE, ...SACK, 'ph:bananas', 'ph:cheesebox_01'], randInt(2, 3), { s: [1.1, 1.4], rad: 1.2 });
        break;
      }
    }
  }
  streue(objects, PP, amPlatz(0.5, 0.95), ['ph:standing_chalkboard_01'], 1, { s: [1.5, 1.6], rot: false });
  streue(objects, PP, amPlatz(0.4, 0.9), ['ph:painted_wooden_bench'], randInt(2, 3), { s: [1.4, 1.5] });
  streue(objects, PP, amPlatz(0.9, 1.3), ['ph:island_tree_01', 'ph:island_tree_02'], 1, { s: [0.9, 1.1] });
  labels.push({ id: uid(6), kind: 'text', text: 'Dorfplatz', x: sp.x, y: sp.y + pr * 0.85 + 0.4, size: 0.5 });
  // Pferch in großen Dörfern
  if (area >= 1100) {
    for (let t = 0; t < 30; t++) {
      const pw = randInt(5, 7);
      const ph = randInt(4, 5);
      const x = randInt(2, W - pw - 2);
      const y = randInt(2, H - ph - 2);
      if (!P.frei([x - 1, y - 1, x + pw + 1, y + ph + 1])) continue;
      P.nimm([x - 0.5, y - 0.5, x + pw + 0.5, y + ph + 0.5]);
      terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: 'tex:brown_mud', pts: blob(x + pw / 2, y + ph / 2, pw / 2 - 0.2, ph / 2 - 0.2, { j: 0.12 }) });
      zaun(objects, x, y, pw, ph);
      objects.push(stampAt('ph:wooden_bucket_02_a', x + 1, y + 1, { s: 1.5 }), stampAt(pick(SETS.reisig.keys), x + pw - 1.2, y + ph - 1, { s: 2.4, r: randInt(0, 359) }));
      break;
    }
  }
  // Teich am Dorfrand
  if (chance(0.35)) {
    for (let t = 0; t < 20; t++) {
      const x = rnd(3, W - 3);
      const y = rnd(3, H - 3);
      if (!P.frei([x - 3, y - 2.4, x + 3, y + 2.4])) continue;
      P.nimm([x - 3, y - 2.4, x + 3, y + 2.4]);
      terrain.push(fleck('tex:damp_sand', x, y, 3, 2.3));
      terrain.push({ id: uid(6), op: 'add', kind: 'poly', mat: 'water', pts: blob(x, y, rnd(1.8, 2.5), rnd(1.3, 1.9), { j: 0.25 }) });
      streue(objects, null, () => { const a = rnd(0, TAU); return { x: x + Math.cos(a) * rnd(2.3, 3), y: y + Math.sin(a) * rnd(1.8, 2.4) }; }, [...SETS.gras.keys, ...SETS.fels.keys], 12, { s: [1, 2.4] });
      break;
    }
  }
  // Natur: Obst- und Dorfbäume, Büsche an Häusern, Gras und Blumen auf freien Flächen
  const frei = () => { const x = rnd(0, W); const y = rnd(0, H); return P.frei([x - 0.3, y - 0.3, x + 0.3, y + 0.3]) ? { x, y } : null; };
  baeume(objects, W, H, Math.round(area / 28), { min: 2.8, ok: (x, y) => P.frei([x - 0.8, y - 0.8, x + 0.8, y + 0.8]), sets: [['laubbaum', 0.75], ['jungbaum', 0.1], ['nadelbaum', 0.15]], s: 0.9 });
  streue(objects, null, frei, SETS.busch.keys, Math.round(area / 25), { s: [0.8, 1.5], tries: 4 });
  streue(objects, null, frei, SETS.gras.keys, Math.round(area / 6), { s: [1.4, 3], tries: 3 });
  streue(objects, null, frei, SETS.blume.keys, Math.round(area / 14), { s: [1.2, 2.4], tries: 3 });
  streue(objects, P, frei, [...SETS.fels.keys, 'ph:tree_stump_01'], Math.round(area / 150), { s: [0.7, 1.1], tries: 4 });
  return base({ shapes, terrain, objects, labels, outdoor: true, ground: gras, floorTex: 'old_wood_floor', wallTex: pick(['wood_plank_wall', 'beam_wall_01', 'wood_trunk_wall', 'clay_plaster']), dark: 0.1, soft: 0.35 });
}
function streuPunkt(R) {
  const t = Math.random();
  const seite = pick(SEITEN);
  if (seite === 'n') return { x: R.x + R.w * t, y: R.y + 0.4 };
  if (seite === 's') return { x: R.x + R.w * t, y: R.y + R.h - 0.4 };
  if (seite === 'w') return { x: R.x + 0.4, y: R.y + R.h * t };
  return { x: R.x + R.w - 0.4, y: R.y + R.h * t };
}
// Zaun um ein Rechteck (mit Tor)
function zaun(objects, x, y, w, h) {
  const tor = randInt(0, Math.max(0, Math.floor(w / 2) - 1));
  for (let i = 0; i < Math.floor(w / 2); i++) {
    if (i !== tor) objects.push(stampAt('p:fence', x + 1 + i * 2, y + h));
    objects.push(stampAt('p:fence', x + 1 + i * 2, y));
  }
  for (let i = 0; i < Math.floor(h / 2); i++) for (const xx of [x, x + w]) objects.push(stampAt('p:fence', xx, y + 1 + i * 2, { r: 90 }));
}
// Gemüsegarten hinter einem Haus: Beete, Pflanzenreihen, Zaun
function garten(objects, terrain, P, h, W, H) {
  const hinten = GEGEN[h.tuer];
  const tief = 3;
  const R = hinten === 'n' ? { x: h.x, y: h.y - tief - 0.3, w: h.w, h: tief } : hinten === 's' ? { x: h.x, y: h.y + h.h + 0.3, w: h.w, h: tief } : hinten === 'w' ? { x: h.x - tief - 0.3, y: h.y, w: tief, h: h.h } : { x: h.x + h.w + 0.3, y: h.y, w: tief, h: h.h };
  if (R.x < 0.5 || R.y < 0.5 || R.x + R.w > W - 0.5 || R.y + R.h > H - 0.5 || !P.frei([R.x - 0.3, R.y - 0.3, R.x + R.w + 0.3, R.y + R.h + 0.3])) return;
  P.nimm([R.x - 0.3, R.y - 0.3, R.x + R.w + 0.3, R.y + R.h + 0.3]);
  terrain.push({ id: uid(6), op: 'add', kind: 'rect', mat: 'tex:farm_soil', pts: [r2(R.x + 0.2), r2(R.y + 0.2), r2(R.x + R.w - 0.2), r2(R.y + R.h - 0.2)] });
  const pflanzen = pick([ids(/^othonna_cerarioides/), ids(/^weed_plant_02/), ids(/^fern_02/), ids(/^wild_rooibos_bush/)]);
  const liegend = R.w >= R.h;
  for (let a = 0.6; a < (liegend ? R.h : R.w) - 0.4; a += 0.9) {
    for (let b = 0.6; b < (liegend ? R.w : R.h) - 0.4; b += 0.8) {
      if (chance(0.15)) continue;
      objects.push(stampAt(pick(pflanzen), R.x + (liegend ? b : a), R.y + (liegend ? a : b), { s: rnd(1, 1.5), r: randInt(0, 359) }));
    }
  }
  const zx = Math.round(R.x);
  const zy = Math.round(R.y);
  const zw = Math.max(2, Math.round(R.w / 2) * 2);
  const zh = Math.max(2, Math.round(R.h / 2) * 2);
  // Zaun nur an den drei freien Seiten
  for (let i = 0; i < zw / 2; i++) {
    if (hinten !== 's') objects.push(stampAt('p:fence', zx + 1 + i * 2, zy + zh));
    if (hinten !== 'n') objects.push(stampAt('p:fence', zx + 1 + i * 2, zy));
  }
  for (let i = 0; i < zh / 2; i++) {
    if (hinten !== 'e') objects.push(stampAt('p:fence', zx, zy + 1 + i * 2, { r: 90 }));
    if (hinten !== 'w') objects.push(stampAt('p:fence', zx + zw, zy + 1 + i * 2, { r: 90 }));
  }
  if (chance(0.5)) objects.push(stampAt('ph:wooden_bucket_01', R.x + 0.4, R.y + 0.4, { s: 1.4 }));
}

export const SCRAWL_GENERATORS = {
  leer: { label: 'Leer', fn: () => base({}) },
  dungeon: { label: 'Dungeon (Räume & Gänge)', fn: genDungeon },
  hoehle: { label: 'Höhle', fn: genCave },
  taverne: { label: 'Taverne', fn: genTavern },
  tempel: { label: 'Tempel, Krypta & Gruft', fn: genTemple },
  lichtung: { label: 'Waldlichtung mit Lager', fn: genClearing },
  wald: { label: 'Dichter Wald', fn: genForest },
  dorf: { label: 'Dorf', fn: genVillage },
};
