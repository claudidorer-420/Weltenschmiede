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
import { now, slugify, sortBy, download } from '../lib/util.js';
import { PACK_FORMAT, PACK_VERSION, CATEGORIES, NORM, emptyPack, readPack, checkPack, packDoc, arr, num, str, keyOf, AB } from './packformat.js';

export { PACK_FORMAT, PACK_VERSION, CATEGORIES, EDITIONS, NORM, emptyPack, readPack, checkPack } from './packformat.js';


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
export function packFromDoc(d) {
  const p = readPack(d.json || d);
  return { ...p, id: d.id || p.id };
}

export const listLibrary = (u) => db.list(LIB(u)).then((l) => sortBy(l, (x) => String(x.name || '').toLowerCase()));
export const watchLibrary = (u, cb) => db.watchCol(LIB(u), {}, (l) => cb(sortBy(l, (x) => String(x.name || '').toLowerCase())), () => cb([]));
export const saveToLibrary = (u, p) => db.set(LIB(u), p.id, packDoc(p));
export const removeFromLibrary = (u, id) => db.remove(LIB(u), id);

export const watchCampaignPacks = (cid, cb) => db.watchCol(CAMP(cid), {}, (l) => cb(sortBy(l, (x) => num(x.order))), () => cb([]));
export async function saveToCampaign(cid, p, { active, order } = {}) {
  const old = await db.get(CAMP(cid), p.id).catch(() => null);
  const on = active ?? old?.active ?? true;
  await db.set(CAMP(cid), p.id, packDoc(p, { active: on, order: order ?? old?.order ?? now(), activatedAt: on && !old?.active ? now() : old?.activatedAt || now() }));
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
