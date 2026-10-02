// Format der Regelpakete (weltenschmiede-regeln v1): Kategorien, Einlesen, Prüfen, Vereinheitlichen.
// Ohne DOM und ohne Datenbank – die App (core/rulesets.js) und der MCP-Server (mcp/src/rules.js) nutzen dasselbe Modul.
import { uid, now, slugify } from '../lib/util.js';

export const PACK_FORMAT = 'weltenschmiede-regeln';
export const PACK_VERSION = 1;
export const CATEGORIES = [
  { key: 'species', label: 'Spezies', one: 'Spezies' },
  { key: 'subspecies', label: 'Unterarten', one: 'Unterart' },
  { key: 'backgrounds', label: 'Hintergründe', one: 'Hintergrund' },
  { key: 'feats', label: 'Talente', one: 'Talent' },
  { key: 'classes', label: 'Klassen', one: 'Klasse' },
  { key: 'subclasses', label: 'Unterklassen', one: 'Unterklasse' },
  { key: 'spells', label: 'Zauber', one: 'Zauber' },
  { key: 'weapons', label: 'Waffen', one: 'Waffe' },
  { key: 'armor', label: 'Rüstungen', one: 'Rüstung' },
  { key: 'items', label: 'Gegenstände', one: 'Gegenstand' },
  { key: 'conditions', label: 'Zustände', one: 'Zustand' },
];
export const EDITIONS = [{ value: '2024', label: 'Regeln 2024' }, { value: '2014', label: 'Regeln 2014' }, { value: 'beide', label: 'Beide Regelstände' }];

// ───────────────────────── Prüfen und Vereinheitlichen ─────────────────────────
export const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
export const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
export const str = (v, d = '') => (v == null ? d : String(v));
export const keyOf = (o) => str(o.key || slugify(o.name || '')).slice(0, 60);
export const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const abList = (v) => arr(v).filter((k) => AB.includes(k));
const abMap = (v) => Object.fromEntries(Object.entries(v || {}).filter(([k]) => AB.includes(k)).map(([k, n]) => [k, num(n)]));
const perEdObj = (v, conv = (x) => x) => {
  if (v && typeof v === 'object' && !Array.isArray(v) && ('2014' in v || '2024' in v)) return { 2014: conv(v[2014] ?? v[2024]), 2024: conv(v[2024] ?? v[2014]) };
  return { 2014: conv(v), 2024: conv(v) };
};
const traitList = (v) => arr(v).map((t) => (Array.isArray(t) ? [str(t[0]), str(t[1])] : [str(t?.name), str(t?.desc)])).filter(([n, d]) => n || d);
const levelTable = (t) => {
  const out = {};
  for (let l = 1; l <= 20; l++) out[l] = arr(t?.[l] ?? t?.[String(l)]).map((x) => str(x).trim()).filter(Boolean);
  return out;
};
const numRow = (v) => (Array.isArray(v) ? Array.from({ length: 20 }, (_, i) => num(v[i] ?? v[v.length - 1])) : v == null || v === '' ? null : num(v));

function normSub(s) {
  return {
    ...s, key: keyOf(s), name: str(s.name || s.key), traits: traitList(s.traits),
    ...(s.asi ? { asi: abMap(s.asi) } : {}), ...(s.resist ? { resist: arr(s.resist) } : {}),
    ...(s.speed != null && s.speed !== '' ? { speed: num(s.speed, 30) } : {}), ...(s.dark != null && s.dark !== '' ? { dark: num(s.dark) } : {}),
  };
}
export const NORM = {
  species(s) {
    const o = { ...s, key: keyOf(s), name: str(s.name || s.key), size: str(s.size, 'Mittelgroß'), speed: num(s.speed, 30), dark: num(s.dark), traits: traitList(s.traits) };
    if (s.subs) o.subs = arr(s.subs).map(normSub);
    if (s.option && arr(s.option.list).length) o.option = { label: str(s.option.label, 'Auswahl'), list: arr(s.option.list).map((x) => ({ ...x, key: keyOf(x), name: str(x.name || x.key), ...(x.resist ? { resist: arr(x.resist) } : {}) })) };
    else delete o.option;
    for (const k of ['skills', 'resist']) if (s[k]) o[k] = arr(s[k]);
    if (s.asi) o.asi = abMap(s.asi);
    if (s.asiChoice) o.asiChoice = { n: num(s.asiChoice.n, 1), amount: num(s.asiChoice.amount, 1), ...(s.asiChoice.exclude ? { exclude: abList(s.asiChoice.exclude) } : {}) };
    return o;
  },
  subspecies(s) { return { ...normSub(s), species: str(s.species) }; },
  backgrounds(b) {
    const o = { ...b, key: keyOf(b), name: str(b.name || b.key), skills: arr(b.skills), equip: str(b.equip) };
    if (b.abilities) o.abilities = abList(b.abilities);
    return o;
  },
  feats(f) {
    const o = { ...f, key: keyOf(f), name: str(f.name || f.key), cat: ['origin', 'general', 'style', 'epic'].includes(f.cat) ? f.cat : 'general', desc: str(f.desc) };
    if (!o.ed || !['2014', '2024'].includes(String(o.ed))) delete o.ed;
    for (const k of ['a14', 'a24']) if (f[k]) o[k] = abList(f[k]);
    return o;
  },
  classes(c) {
    const o = { ...c, key: keyOf(c), name: str(c.name || c.key), hd: [6, 8, 10, 12].includes(num(c.hd)) ? num(c.hd) : 8, primary: abList(c.primary), saves: abList(c.saves) };
    o.subLabel = str(c.subLabel, 'Unterklasse');
    o.subLevel = perEdObj(c.subLevel ?? 3, (x) => num(x, 3));
    const sk = c.skills || {};
    const skList = (x) => (x === 'any' || x == null || (Array.isArray(x) && !x.length) ? 'any' : arr(x));
    o.skills = { n: num(sk.n, 2), list: sk.list && typeof sk.list === 'object' && !Array.isArray(sk.list) ? perEdObj(sk.list, skList) : skList(sk.list) };
    o.armor = Array.isArray(c.armor) ? c.armor : c.armor && typeof c.armor === 'object' ? perEdObj(c.armor, arr) : [];
    o.weapons = perEdObj(c.weapons ?? ['simple'], arr);
    o.tools = str(c.tools);
    o.mc = { req: arr(c.mc?.req).map((r) => abList(r)).filter((r) => r.length), gain: str(c.mc?.gain, '–'), ...(c.mc?.any ? { any: true } : {}) };
    o.equip = perEdObj(c.equip ?? '', str);
    o.gold = perEdObj(c.gold ?? 0, (x) => (typeof x === 'string' ? x : num(x)));
    o.subclasses = perEdObj(c.subclasses ?? [], (x) => arr(x).map(str).filter(Boolean));
    o.feat = perEdObj(c.feat ?? {}, levelTable);
    if (c.cast && c.cast.type && c.cast.type !== 'none') {
      const x = { ...c.cast, type: ['full', 'half', 'third', 'pact', 'artificer'].includes(c.cast.type) ? c.cast.type : 'full', ability: AB.includes(c.cast.ability) ? c.cast.ability : 'int' };
      for (const k of ['cantrips', 'prep', 'known14', 'prep24']) if (x[k] != null && typeof x[k] !== 'function') x[k] = numRow(x[k]);
      if (x.mode && !['known', 'prepare', 'book'].includes(x.mode)) delete x.mode;
      o.cast = x;
    } else delete o.cast;
    return o;
  },
  subclasses(s) {
    const features = {};
    for (const [l, list] of Object.entries(s.features || {})) {
      const lv = num(l);
      if (lv < 1 || lv > 20) continue;
      const items = arr(list).map((f) => (typeof f === 'string' ? { name: f, desc: '' } : { name: str(f.name), desc: str(f.desc), ...(arr(f.fx).length ? { fx: arr(f.fx) } : {}) })).filter((f) => f.name);
      if (items.length) features[lv] = items;
    }
    const spells = {};
    for (const [l, list] of Object.entries(s.spells || {})) { const lv = num(l); const names = arr(list).map((x) => str(x).trim()).filter(Boolean); if (lv >= 1 && lv <= 20 && names.length) spells[lv] = names; }
    return { ...s, cls: str(s.cls), name: str(s.name).trim(), desc: str(s.desc), features, spells, ...(s.ed && ['2014', '2024'].includes(String(s.ed)) ? { ed: String(s.ed) } : { ed: undefined }) };
  },
  spells(sp) {
    const o = { ...sp, id: str(sp.id || slugify(sp.name || '')), name: str(sp.name || sp.id), level: Math.max(0, Math.min(9, num(sp.level))), school: str(sp.school, 'evocation'), classes: arr(sp.classes) };
    o.desc = Array.isArray(sp.desc) ? sp.desc.map(str) : str(sp.desc).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    o.time = str(sp.time, 'Aktion');
    o.action = ['action', 'bonus', 'reaction', 'long'].includes(sp.action) ? sp.action : 'action';
    o.rangeKind = ['dist', 'self', 'touch', 'sight', 'unl'].includes(sp.rangeKind) ? sp.rangeKind : 'dist';
    o.rangeM = sp.rangeM == null || sp.rangeM === '' ? (o.rangeKind === 'touch' ? 1.5 : o.rangeKind === 'self' ? 0 : null) : num(sp.rangeM);
    o.range = str(sp.range || (o.rangeKind === 'self' ? 'Selbst' : o.rangeKind === 'touch' ? 'Berührung' : o.rangeM != null ? `${o.rangeM} Meter` : ''));
    o.comps = str(sp.comps, 'V, G');
    o.duration = str(sp.duration, 'Unmittelbar');
    o.conc = !!sp.conc;
    o.ritual = !!sp.ritual;
    if (!o.en) o.en = `custom:${o.id}`; // eigener Schlüssel: kollidiert nie mit der eingebauten Kampfwirkung
    return o;
  },
  weapons(w) { return { ...w, key: keyOf(w), name: str(w.name || w.key), cat: w.cat === 'martial' ? 'martial' : 'simple', dmg: str(w.dmg, '1d6'), type: str(w.type, 'Hieb'), p: str(w.p), m: str(w.m), ...(arr(w.fx).length ? { fx: arr(w.fx) } : {}) }; },
  // Gegenstände: Amulette, Ringe, Umhänge, Stiefel, Tränke … mit Wirkungen, Ladungen und Einstimmung
  items(it) {
    const o = { ...it, key: keyOf(it), name: str(it.name || it.key), slot: str(it.slot, 'wondrous'), rarity: str(it.rarity, 'ungewöhnlich'), desc: str(it.desc), fx: arr(it.fx) };
    o.attune = !!it.attune;
    o.consumable = !!it.consumable || o.slot === 'potion';
    if (it.charges && num(it.charges.max) > 0) o.charges = { max: num(it.charges.max), rest: ['short', 'long', 'dawn', 'never'].includes(it.charges.rest) ? it.charges.rest : 'dawn', regain: str(it.charges.regain) };
    else delete o.charges;
    return o;
  },
  // Eigene Zustände (z. B. „Brennend“, „Blutend“, „Nass“): Wirkungen auf den Träger, Schaden pro Zug, Stapel
  conditions(s) {
    const o = { ...s, key: keyOf(s), name: str(s.name || s.key), desc: str(s.desc), fx: arr(s.fx), base: arr(s.base).map(str) };
    if (s.dot && str(s.dot.dice)) o.dot = { dice: str(s.dot.dice), type: str(s.dot.type, 'fire'), at: s.dot.at === 'end' ? 'end' : 'start' };
    else delete o.dot;
    o.stack = Math.max(0, Math.min(20, num(s.stack)));
    o.rounds = num(s.rounds);
    if (s.save && AB.includes(s.save.ab)) o.save = { ab: s.save.ab, dc: num(s.save.dc) || 0, at: s.save.at === 'start' ? 'start' : 'end' };
    else delete o.save;
    return o;
  },
  armor(a) {
    const type = ['light', 'medium', 'heavy', 'clothing', 'shield'].includes(a.type) ? a.type : 'light';
    return { ...a, key: keyOf(a), name: str(a.name || a.key), type, ac: num(a.ac, type === 'shield' ? 2 : type === 'clothing' ? 0 : 11), ...(a.str ? { str: num(a.str) } : {}), ...(a.stealth ? { stealth: true } : {}) };
  },
};

export function emptyPack(name = 'Neues Regelpaket', edition = '2024') {
  return { format: PACK_FORMAT, version: PACK_VERSION, id: `rp-${uid(10)}`, name, edition, author: '', description: '', created: now(), updated: now(), rules: {}, content: Object.fromEntries(CATEGORIES.map((c) => [c.key, []])), features: {}, spellLists: {}, remove: {} };
}

// Aus Datei oder Text: Paket einlesen, alte/fremde Formen vereinheitlichen, Probleme sammeln
export function readPack(input) {
  const raw = typeof input === 'string' ? JSON.parse(input.replace(/^﻿/, '')) : input;
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige Paketdatei.');
  if (raw.format && raw.format !== PACK_FORMAT) throw new Error(`Unbekanntes Format „${raw.format}“ – erwartet wird ein Weltenschmiede-Regelpaket.`);
  const p = emptyPack(str(raw.name, 'Importiertes Paket'), ['2014', '2024', 'beide'].includes(String(raw.edition)) ? String(raw.edition) : 'beide');
  Object.assign(p, { id: str(raw.id || p.id), author: str(raw.author), description: str(raw.description), created: num(raw.created, now()), updated: num(raw.updated, now()) });
  const c = raw.content || {};
  for (const cat of CATEGORIES) p.content[cat.key] = arr(c[cat.key]);
  p.features = { ...(raw.features || c.features || {}) };
  p.spellLists = { ...(raw.spellLists || c.spellLists || {}) };
  p.rules = { ...(raw.rules || c.rules || {}) };
  p.remove = { ...(raw.remove || {}) };
  return p;
}

// Prüfung für Editor und Import: { errors, warnings, counts }
export function checkPack(p) {
  const errors = [];
  const warnings = [];
  const counts = {};
  for (const cat of CATEGORIES) {
    const list = p.content?.[cat.key] || [];
    counts[cat.key] = list.length;
    const seen = new Set();
    list.forEach((e, i) => {
      const label = `${cat.one} ${i + 1}${e?.name ? ` „${e.name}“` : ''}`;
      if (!e || typeof e !== 'object') { errors.push(`${label}: kein gültiger Eintrag`); return; }
      if (!str(e.name).trim()) errors.push(`${label}: Name fehlt`);
      const k = cat.key === 'subclasses' ? `${e.cls}|${e.name}` : cat.key === 'spells' ? str(e.id || slugify(e.name || '')) : cat.key === 'subspecies' ? `${e.species}|${keyOf(e)}` : keyOf(e);
      if (seen.has(k)) warnings.push(`${label}: kommt doppelt vor – der letzte Eintrag gilt`);
      seen.add(k);
      if (cat.key === 'subclasses' && !e.cls) errors.push(`${label}: Klasse fehlt`);
      if (cat.key === 'subspecies' && !e.species) errors.push(`${label}: Spezies fehlt`);
      if (cat.key === 'classes') {
        if (!abList(e.saves).length) warnings.push(`${label}: keine Rettungswürfe gewählt`);
        const t = e.feat && (e.feat[2024] || e.feat[2014] || e.feat);
        if (!t || !Object.values(t).some((x) => arr(x).length)) warnings.push(`${label}: Merkmalstabelle ist leer`);
      }
      if (cat.key === 'feats' && !str(e.desc).trim()) warnings.push(`${label}: Beschreibung fehlt`);
    });
  }
  const js = JSON.stringify(p);
  if (js.length > 900000) errors.push(`Paket ist zu groß (${Math.round(js.length / 1024)} KB, höchstens ~880 KB) – bitte in mehrere Pakete aufteilen.`);
  return { errors, warnings, counts, size: js.length };
}

// Dokument für die Ablage (Bibliothek bzw. Kampagne): Inhalt als JSON-Text, weil Firestore keine Listen in Listen kennt
export function packDoc(p, extra = {}) {
  const chk = checkPack(p);
  return { name: p.name, edition: p.edition, description: p.description || '', author: p.author || '', version: PACK_VERSION, counts: chk.counts, updatedAt: now(), json: JSON.stringify({ ...p, updated: now() }), ...extra };
}
