// „Meine Kreaturen“: Monster-Bibliothek der Spielleitung über alle Kampagnen (users/{uid}/monsters) und eigene
// Namenslisten je Genre (users/{uid}/namelists, Inhalt als JSON-Text im Feld „json“ – verschachtelte Listen).
// Import und Export als Datei, damit Spielleitungen ihre Kreaturen und Listen austauschen können.
import { createStore } from './store.js';
import { db } from './db.js';
import { app, col, myUid } from './app.js';
import { setUserNameLists, normOrigin } from '../data/origins.js';
import { normalizeMonster } from '../ui/statblock.js';
import { uid, now, download, slugify, sortBy } from '../lib/util.js';

export const MONSTER_FORMAT = 'weltenschmiede-kreaturen';
export const NAMES_FORMAT = 'weltenschmiede-namen';
// monsters: null = lädt noch; lists: [{ id, genre, name, count, groups }]
export const libState = createStore({ uid: null, monsters: null, lists: [], rev: 0 });

const LIB = (u) => `users/${u}/monsters`;
const NAMES = (u) => `users/${u}/namelists`;
let unsubs = [];

// Einmal je Konto starten (Bestiarium, Encounter-Generator rufen es auf)
export function ensureMonsterLib() {
  const u = myUid();
  if (!u || libState.get().uid === u) return;
  stopMonsterLib();
  libState.set({ uid: u, monsters: null, lists: [] });
  unsubs.push(db.watchCol(LIB(u), {}, (docs) => libState.set({ monsters: sortBy(docs, (m) => String(m.name || '').toLowerCase()), rev: libState.get().rev + 1 }), () => libState.set({ monsters: [] })));
  unsubs.push(db.watchCol(NAMES(u), {}, (docs) => {
    const lists = docs.map((d) => {
      try { return { id: d.id, genre: d.genre, name: d.name, count: d.count || 0, groups: JSON.parse(d.json || '[]') }; } catch { return null; }
    }).filter(Boolean);
    setUserNameLists(lists);
    libState.set({ lists, rev: libState.get().rev + 1 });
  }, () => {}));
}
export function stopMonsterLib() {
  unsubs.forEach((f) => { try { f(); } catch { /* ignore */ } });
  unsubs = [];
  setUserNameLists([]);
  libState.set({ uid: null, monsters: null, lists: [] });
}

// Statblock ohne kampagnenbezogene Felder
function clean(m) {
  const { id, qty, createdAt, updatedAt, libId, campaignId, ...rest } = m || {};
  const n = normalizeMonster(rest);
  delete n.qty;
  return { ...rest, ...n, ...(m?.image ? { image: m.image } : {}), ...(m?.origin ? { origin: m.origin } : {}), ...(m?.srdId ? { srdId: m.srdId } : {}) };
}

// In „Meine Kreaturen“ speichern (gleicher Name + Genre wird aktualisiert statt doppelt angelegt)
export async function saveToLibrary(m, { quiet = false } = {}) {
  const u = myUid();
  if (!u) throw new Error('Nicht angemeldet.');
  const data = clean(m);
  const list = libState.get().monsters || (await db.list(LIB(u)).catch(() => []));
  const same = list.find((x) => x.id === m.libId) || list.find((x) => String(x.name).toLowerCase() === String(data.name).toLowerCase() && normOrigin(x.origin) === normOrigin(data.origin));
  const id = same?.id || uid(16);
  await db.set(LIB(u), id, { ...data, createdAt: same?.createdAt || now(), updatedAt: now() });
  if (m.id && app.get().cid && !m.srdId && m.libId !== id) db.update(col('monsters'), m.id, { libId: id }).catch(() => {});
  if (!quiet) import('../ui/components.js').then(({ toast }) => toast(same ? `„${data.name}“ in „Meine Kreaturen“ aktualisiert` : `„${data.name}“ in „Meine Kreaturen“ gespeichert – in allen Kampagnen verfügbar`, 'success'));
  return id;
}
export const removeFromLibrary = (id) => db.remove(LIB(myUid()), id);
export const updateInLibrary = (id, patch) => db.update(LIB(myUid()), id, { ...patch, updatedAt: now() });

// Aus der Bibliothek ins Bestiarium der offenen Kampagne
export async function copyToCampaign(m) {
  const { id, ...rest } = m;
  return db.add(col('monsters'), { ...clean(rest), libId: id, createdAt: now() });
}

// ── Dateien ──
export function exportMonsters(list, name = 'Kreaturen') {
  const monsters = list.map(clean);
  download(`${slugify(name) || 'kreaturen'}.${MONSTER_FORMAT}.json`, JSON.stringify({ format: MONSTER_FORMAT, version: 1, name, exported: now(), monsters }, null, 1), 'application/json;charset=utf-8');
}
export function readMonsterFile(text) {
  const raw = JSON.parse(String(text).replace(/^﻿/, ''));
  const list = Array.isArray(raw) ? raw : raw?.format === MONSTER_FORMAT || Array.isArray(raw?.monsters) ? raw.monsters : raw?.name && (raw.actions || raw.hp) ? [raw] : null;
  if (!list) throw new Error('Keine Kreaturen-Datei (erwartet: weltenschmiede-kreaturen oder ein Statblock).');
  return list.filter((m) => m && m.name).map(clean);
}
export async function importMonsters(list, target = 'lib') {
  for (const m of list) {
    if (target === 'camp') await db.add(col('monsters'), { ...m, createdAt: now() });
    else await saveToLibrary(m, { quiet: true });
  }
}

export function exportNameLists(lists, name = 'Namenslisten') {
  download(`${slugify(name) || 'namen'}.${NAMES_FORMAT}.json`, JSON.stringify({ format: NAMES_FORMAT, version: 1, name, lists: lists.map((l) => ({ genre: l.genre, name: l.name, groups: l.groups })) }, null, 1), 'application/json;charset=utf-8');
}
// Akzeptiert das eigene Format, eine Liste solcher Listen oder schlicht { genre, names: [] }
export function readNameFile(text) {
  const raw = JSON.parse(String(text).replace(/^﻿/, ''));
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.lists) ? raw.lists : raw ? [raw] : [];
  const lists = arr.map((l) => {
    const groups = Array.isArray(l.groups)
      ? l.groups.map((g) => (Array.isArray(g) ? [String(g[0] || ''), (g[1] || []).map(String)] : [String(g.group || g.name || ''), (g.names || []).map(String)]))
      : Array.isArray(l.names) ? [[String(l.name || ''), l.names.map(String)]] : [];
    return { genre: String(l.genre || l.world || '').trim(), name: String(l.name || l.genre || 'Namensliste'), groups: groups.filter(([, n]) => n.length) };
  }).filter((l) => l.genre && l.groups.length);
  if (!lists.length) throw new Error('Keine Namenslisten gefunden (erwartet: weltenschmiede-namen).');
  return lists;
}
export async function saveNameList(l) {
  const u = myUid();
  const id = l.id || `${slugify(l.genre)}-${slugify(l.name)}`.slice(0, 80) || uid(12);
  const count = l.groups.reduce((t, [, n]) => t + n.length, 0);
  await db.set(NAMES(u), id, { genre: l.genre, name: l.name, count, updatedAt: now(), json: JSON.stringify(l.groups) });
  return id;
}
export const removeNameList = (id) => db.remove(NAMES(myUid()), id);
