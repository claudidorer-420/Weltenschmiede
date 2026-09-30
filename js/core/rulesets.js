// Regelpakete: eigene Spielregeln der Spielleitung über dem öffentlichen Grundbestand (SRD 5.1 / 5.2.1).
// Ein Paket kann Spezies, Unterarten, Hintergründe, Talente, Klassen, Unterklassen (mit Merkmalen je Stufe),
// Klassenmerkmale, Zauber, Zauberlisten, Waffen, Rüstungen und Grundregeln ergänzen, ersetzen oder ausblenden.
//
// Ablage: je Kampagne campaigns/{cid}/rules/{id} (alle Mitglieder lesen, SL schreibt) und in der eigenen Bibliothek
// users/{uid}/rulepacks/{id}. Der Inhalt steckt als JSON-Text im Feld „json“ – Firestore kennt keine verschachtelten
// Listen (Merkmale sind [[Name, Text]]). Beim Öffnen einer Kampagne legt applyPacks() die aktiven Pakete über den
// Grundbestand; alle Verbraucher lesen weiter die Tabellen aus data/chargen.js, die an Ort und Stelle ergänzt und beim
// Verlassen exakt zurückgebaut werden (resetRules).
import { createStore } from './store.js';
import { db } from './db.js';
import * as CG from '../data/chargen.js';
import { SPELL_OVERLAY } from '../data/spells.js';
import { WEAPON_RANGE } from '../data/items.js';
import { CUSTOM_STATUS } from './effects.js';
import { baseSubFeatures } from '../data/subclassbase.js';
import { uid, now, slugify, sortBy, download } from '../lib/util.js';

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

// rev steigt bei jeder Änderung → Ansichten mit useStore(rulesState, (s) => s.rev) zeichnen neu
export const rulesState = createStore({ rev: 0, cid: null, packs: [], docs: [], errors: [], ready: false });

// ───────────────────────── Grundbestand (für Vorlagen im Editor) ─────────────────────────
const BASE = {
  species: { 2014: [...CG.SPECIES[2014]], 2024: [...CG.SPECIES[2024]] },
  backgrounds: { 2014: [...CG.BACKGROUNDS[2014]], 2024: [...CG.BACKGROUNDS[2024]] },
  feats: [...CG.FEATS],
  classes: CG.CLASSES.map((c) => ({ c, subs: { 2014: [...(c.subclasses?.[2014] || [])], 2024: [...(c.subclasses?.[2024] || [])] } })),
  weapons: [...CG.WEAPONS],
  armor: [...CG.ARMOR],
};
const perLevelArray = (f) => Array.from({ length: 20 }, (_, i) => Number(f(i + 1)) || 0);
// Kopie ohne Funktionen (Zaubertricks je Stufe als Liste) – taugt als JSON und als Vorlage
export function plain(o) {
  return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? perLevelArray(v) : v instanceof Set ? [...v] : v)));
}
export function baseEntries(cat, ed) {
  const e = ed === '2014' ? '2014' : '2024';
  if (cat === 'species') return BASE.species[e].map(plain);
  if (cat === 'backgrounds') return BASE.backgrounds[e].map(plain);
  if (cat === 'feats') return BASE.feats.filter((f) => !f.ed || f.ed === e).map(plain);
  if (cat === 'classes') return BASE.classes.map(({ c, subs }) => plain({ ...c, subclasses: subs }));
  if (cat === 'subclasses') return BASE.classes.flatMap(({ c, subs }) => subs[e].map((name) => ({ cls: c.key, name, ed: e, desc: CG.SUBCLASS_DESC[name] || '', features: plain(baseSubFeatures(c.key, name, e) || {}) })));
  if (cat === 'weapons') return BASE.weapons.map(plain);
  if (cat === 'armor') return BASE.armor.map(plain);
  if (cat === 'subspecies') return BASE.species[e].flatMap((s) => (s.subs || []).map((x) => plain({ species: s.key, ...x })));
  return [];
}

// ───────────────────────── Prüfen und Vereinheitlichen ─────────────────────────
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const str = (v, d = '') => (v == null ? d : String(v));
const keyOf = (o) => str(o.key || slugify(o.name || '')).slice(0, 60);
const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const abList = (v) => arr(v).filter((k) => AB.includes(k));
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

// ───────────────────────── Anwenden und Zurückbauen ─────────────────────────
const undo = [];
function put(list, item, k = (x) => x.key) {
  const key = k(item);
  const i = list.findIndex((x) => k(x) === key);
  if (i >= 0) {
    const old = list[i];
    list[i] = item;
    undo.push(() => { const j = list.indexOf(item); if (j >= 0) list[j] = old; });
  } else {
    list.push(item);
    undo.push(() => { const j = list.indexOf(item); if (j >= 0) list.splice(j, 1); });
  }
}
function drop(list, key, k = (x) => x.key) {
  const i = list.findIndex((x) => k(x) === key);
  if (i < 0) return;
  const [old] = list.splice(i, 1);
  undo.push(() => list.splice(Math.min(i, list.length), 0, old));
}
function setKey(obj, k, v) {
  const had = Object.prototype.hasOwnProperty.call(obj, k);
  const old = obj[k];
  obj[k] = v;
  undo.push(() => { if (had) obj[k] = old; else delete obj[k]; });
}
const edsOf = (entry, pack) => (entry?.ed && ['2014', '2024'].includes(String(entry.ed)) ? [String(entry.ed)] : pack.edition === '2014' ? ['2014'] : pack.edition === '2024' ? ['2024'] : ['2014', '2024']);

export function resetRules() {
  while (undo.length) undo.pop()();
  CG.setBaseRules(null);
  SPELL_OVERLAY.add = { 2014: [], 2024: [] };
  SPELL_OVERLAY.lists = {};
  SPELL_OVERLAY.remove = new Set();
  SPELL_OVERLAY.rev = 0;
  CG.bumpFx();
}

// packs: vereinheitlichte Pakete in Reihenfolge – spätere überschreiben frühere
export function applyPacks(packs) {
  const errors = [];
  const tryDo = (pack, what, fn) => { try { fn(); } catch (e) { errors.push(`${pack.name}: ${what} – ${e.message || e}`); } };
  let rules = null;
  let spellsTouched = false;
  for (const p of packs) {
    const c = p.content || {};
    if (p.rules && Object.keys(p.rules).length) rules = { ...(rules || {}), ...p.rules };
    for (const raw of c.classes || []) tryDo(p, `Klasse ${raw?.name}`, () => {
      // Teilweise Überschreibung erlaubt: fehlende Felder kommen von der vorhandenen Klasse
      const old = CG.CLASSES.find((x) => x.key === keyOf(raw));
      const n = NORM.classes(old ? { ...plain(old), ...raw } : raw);
      if (old) for (const ed of ['2014', '2024']) n.subclasses[ed] = [...new Set([...(old.subclasses?.[ed] || []), ...n.subclasses[ed]])];
      put(CG.CLASSES, n);
    });
    for (const raw of c.subclasses || []) tryDo(p, `Unterklasse ${raw?.name}`, () => {
      const s = NORM.subclasses(raw);
      const cls = CG.CLASSES.find((x) => x.key === s.cls || x.name === s.cls);
      if (!cls) throw new Error(`Klasse „${s.cls}“ gibt es nicht`);
      for (const ed of edsOf(s, p)) {
        if (!cls.subclasses) setKey(cls, 'subclasses', { 2014: [], 2024: [] });
        if (!cls.subclasses[ed]) setKey(cls.subclasses, ed, []);
        const list = cls.subclasses[ed];
        if (!list.includes(s.name)) { list.push(s.name); undo.push(() => { const j = list.indexOf(s.name); if (j >= 0) list.splice(j, 1); }); }
      }
      if (s.desc) setKey(CG.SUBCLASS_DESC, s.name, s.desc);
      if (Object.keys(s.features).length) setKey(CG.SUBCLASS_FEATURES, `${cls.key}|${s.name}`, s.features);
      if (Object.keys(s.spells).length) setKey(CG.SUBCLASS_SPELLS, `${cls.key}|${s.name}`, s.spells);
      if (s.caster === 'third') setKey(CG.SUBCLASS_META, s.name, { caster: 'third', ability: AB.includes(s.ability) ? s.ability : 'int', list: s.list || 'magier' });
    });
    for (const raw of c.species || []) tryDo(p, `Spezies ${raw?.name}`, () => { const s = { ...NORM.species(raw), _pack: p.name }; for (const ed of edsOf(s, p)) put(CG.SPECIES[ed], s); });
    for (const raw of c.subspecies || []) tryDo(p, `Unterart ${raw?.name}`, () => {
      const s = NORM.subspecies(raw);
      const { species, ...sub } = { ...s, _pack: p.name };
      let found = false;
      for (const ed of edsOf(s, p)) {
        const sp = CG.SPECIES[ed].find((x) => x.key === species);
        if (!sp) continue;
        found = true;
        if (!sp.subs) setKey(sp, 'subs', []);
        put(sp.subs, sub);
      }
      if (!found) throw new Error(`Spezies „${species}“ gibt es nicht`);
    });
    for (const raw of c.backgrounds || []) tryDo(p, `Hintergrund ${raw?.name}`, () => { const b = { ...NORM.backgrounds(raw), _pack: p.name }; for (const ed of edsOf(b, p)) put(CG.BACKGROUNDS[ed], b); });
    for (const raw of c.feats || []) tryDo(p, `Talent ${raw?.name}`, () => {
      const f = { ...NORM.feats(raw), _pack: p.name };
      if (!f.ed && p.edition !== 'beide') f.ed = p.edition;
      put(CG.FEATS, f);
    });
    // Klassenmerkmale: Text (alt) oder { desc, fx } mit strukturierten Wirkungen
    for (const [name, v] of Object.entries(p.features || {})) tryDo(p, `Merkmal ${name}`, () => {
      const desc = v && typeof v === 'object' ? str(v.desc) : str(v);
      setKey(CG.FEATURE_INFO, name, desc);
      setKey(CG.FEATURE_SRC, name, p.name);
      if (v && typeof v === 'object' && arr(v.fx).length) setKey(CG.FEATURE_FX, name, arr(v.fx));
    });
    for (const raw of c.weapons || []) tryDo(p, `Waffe ${raw?.name}`, () => {
      const w = { ...NORM.weapons(raw), _pack: p.name };
      put(CG.WEAPONS, w);
      // Reichweite (normal/weit in Metern) für Fernkampf- und Wurfwaffen
      if (Array.isArray(w.range) && Number(w.range[0]) > 0) setKey(WEAPON_RANGE, w.key, [Number(w.range[0]), Number(w.range[1]) || Number(w.range[0]) * 4]);
    });
    for (const raw of c.armor || []) tryDo(p, `Rüstung ${raw?.name}`, () => put(CG.ARMOR, { ...NORM.armor(raw), _pack: p.name }));
    for (const raw of c.items || []) tryDo(p, `Gegenstand ${raw?.name}`, () => put(CG.ITEMS, { ...NORM.items(raw), _pack: p.name }));
    for (const raw of c.conditions || []) tryDo(p, `Zustand ${raw?.name}`, () => { const s = NORM.conditions(raw); setKey(CUSTOM_STATUS, s.key, s); });
    for (const raw of c.spells || []) tryDo(p, `Zauber ${raw?.name}`, () => {
      const sp = NORM.spells(raw);
      for (const ed of edsOf(sp, p)) {
        const list = SPELL_OVERLAY.add[ed];
        const i = list.findIndex((x) => x.id === sp.id);
        if (i >= 0) list[i] = sp; else list.push(sp);
      }
      spellsTouched = true;
    });
    for (const [cls, ids] of Object.entries(p.spellLists || {})) { SPELL_OVERLAY.lists[cls] = [...new Set([...(SPELL_OVERLAY.lists[cls] || []), ...arr(ids)])]; spellsTouched = true; }
    // Ausblenden
    const r = p.remove || {};
    for (const k of arr(r.species)) tryDo(p, `Spezies ausblenden ${k}`, () => { for (const ed of edsOf({}, p)) drop(CG.SPECIES[ed], k); });
    for (const k of arr(r.backgrounds)) tryDo(p, `Hintergrund ausblenden ${k}`, () => { for (const ed of edsOf({}, p)) drop(CG.BACKGROUNDS[ed], k); });
    for (const k of arr(r.feats)) tryDo(p, `Talent ausblenden ${k}`, () => drop(CG.FEATS, k));
    for (const k of arr(r.classes)) tryDo(p, `Klasse ausblenden ${k}`, () => drop(CG.CLASSES, k));
    for (const k of arr(r.weapons)) tryDo(p, `Waffe ausblenden ${k}`, () => drop(CG.WEAPONS, k));
    for (const k of arr(r.armor)) tryDo(p, `Rüstung ausblenden ${k}`, () => drop(CG.ARMOR, k));
    for (const x of arr(r.subclasses)) tryDo(p, `Unterklasse ausblenden ${x}`, () => {
      const [ck, name] = String(x).split('|');
      const cls = CG.CLASSES.find((y) => y.key === ck);
      for (const ed of edsOf({}, p)) {
        const list = cls?.subclasses?.[ed];
        const j = list ? list.indexOf(name) : -1;
        if (j >= 0) { list.splice(j, 1); undo.push(() => list.splice(Math.min(j, list.length), 0, name)); }
      }
    });
    for (const k of arr(r.spells)) { SPELL_OVERLAY.remove.add(k); spellsTouched = true; }
  }
  if (rules) CG.setBaseRules(rules);
  // Sprachen der Welt (Grundregeln) und Sprachen aus Spezies/Hintergründen in die Auswahl
  const langs = new Set(arr(rules?.languages));
  for (const p of packs) for (const k of ['species', 'subspecies', 'backgrounds']) for (const e of p.content?.[k] || []) for (const l of arr(e?.langs)) langs.add(str(l));
  for (const l of langs) if (l && !CG.LANGUAGES.includes(l)) { CG.LANGUAGES.push(l); undo.push(() => { const j = CG.LANGUAGES.indexOf(l); if (j >= 0) CG.LANGUAGES.splice(j, 1); }); }
  if (spellsTouched) SPELL_OVERLAY.rev = Date.now();
  CG.bumpFx();
  return { errors };
}

// ───────────────────────── Ablage ─────────────────────────
const LIB = (u) => `users/${u}/rulepacks`;
const CAMP = (cid) => `campaigns/${cid}/rules`;
function stored(p, extra = {}) {
  const chk = checkPack(p);
  return { name: p.name, edition: p.edition, description: p.description || '', author: p.author || '', version: PACK_VERSION, counts: chk.counts, updatedAt: now(), json: JSON.stringify({ ...p, updated: now() }), ...extra };
}
export function packFromDoc(d) {
  const p = readPack(d.json || d);
  return { ...p, id: d.id || p.id };
}

export const listLibrary = (u) => db.list(LIB(u)).then((l) => sortBy(l, (x) => String(x.name || '').toLowerCase()));
export const watchLibrary = (u, cb) => db.watchCol(LIB(u), {}, (l) => cb(sortBy(l, (x) => String(x.name || '').toLowerCase())), () => cb([]));
export const saveToLibrary = (u, p) => db.set(LIB(u), p.id, stored(p));
export const removeFromLibrary = (u, id) => db.remove(LIB(u), id);

export const watchCampaignPacks = (cid, cb) => db.watchCol(CAMP(cid), {}, (l) => cb(sortBy(l, (x) => num(x.order))), () => cb([]));
export async function saveToCampaign(cid, p, { active, order } = {}) {
  const old = await db.get(CAMP(cid), p.id).catch(() => null);
  const on = active ?? old?.active ?? true;
  await db.set(CAMP(cid), p.id, stored(p, { active: on, order: order ?? old?.order ?? now(), activatedAt: on && !old?.active ? now() : old?.activatedAt || now() }));
}
export const setCampaignPack = (cid, id, patch) => db.update(CAMP(cid), id, patch);
export const removeFromCampaign = (cid, id) => db.remove(CAMP(cid), id);

export function exportPack(p) {
  const file = `${slugify(p.name) || 'regelpaket'}.weltenschmiede-regeln.json`;
  download(file, JSON.stringify({ ...plain(p), format: PACK_FORMAT, version: PACK_VERSION }, null, 1), 'application/json;charset=utf-8');
}

// ───────────────────────── Kampagne ─────────────────────────
let unsub = null;
function applyDocs(cid, docs) {
  resetRules();
  const packs = [];
  const errors = [];
  const aktiv = activeDoc(docs);
  if (aktiv) {
    try { packs.push(packFromDoc(aktiv)); } catch (e) { errors.push(`${aktiv.name || aktiv.id}: ${e.message || e}`); }
  }
  const res = applyPacks(packs);
  rulesState.set({ rev: rulesState.get().rev + 1, cid, docs, packs: packs.map((p) => ({ id: p.id, name: p.name, edition: p.edition })), errors: [...errors, ...res.errors], ready: true });
}
// Je Kampagne gilt genau ein Regelwerk – bei älteren Ständen mit mehreren Häkchen das zuletzt aktivierte
let prefEd = null; // Regelstand der Kampagne – entscheidet bei älteren Ständen mit mehreren Häkchen
export function activeDoc(docs, ed = prefEd) {
  const list = (docs || []).filter((x) => x.active === true || (x.active !== false && x.active == null));
  const fit = (d) => (!ed || d.edition === ed || d.edition === 'beide' ? 1 : 0);
  return list.sort((a, b) => num(b.activatedAt) - num(a.activatedAt) || fit(b) - fit(a) || num(b.order) - num(a.order))[0] || null;
}
// Genau dieses Paket aktivieren (alle anderen der Kampagne pausieren); id = null → nur Grundbestand
export async function activateOnly(cid, id, docs) {
  for (const d of docs || []) if (d.id !== id && d.active !== false) await db.update(CAMP(cid), d.id, { active: false });
  if (id) await db.update(CAMP(cid), id, { active: true, activatedAt: now() });
}
// Beim Öffnen einer Kampagne: wartet auf den ersten Stand (höchstens 2,5 s), danach laufend aktuell
export function startRules(cid, { edition = null } = {}) {
  stopRules();
  prefEd = edition;
  if (!cid) return Promise.resolve();
  return new Promise((resolve) => {
    let first = true;
    const done = () => { if (first) { first = false; resolve(); } };
    unsub = db.watchCol(CAMP(cid), {}, (docs) => { applyDocs(cid, docs || []); done(); }, () => { rulesState.set({ ready: true }); done(); });
    setTimeout(done, 2500);
  });
}
export function stopRules() {
  unsub?.();
  unsub = null;
  const had = undo.length || SPELL_OVERLAY.rev;
  resetRules();
  if (had || rulesState.get().cid) rulesState.set({ rev: rulesState.get().rev + 1, cid: null, docs: [], packs: [], errors: [], ready: false });
}
