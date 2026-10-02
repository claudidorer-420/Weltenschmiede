// Kampfzustand – ein Kampf je Karte: vollständiger SL-Zustand (combat/gm~<kartenId>) + öffentliche Projektion für
// Spieler (combat/pub~<kartenId>). Ohne Karte (reiner Kampf-Tracker) steht „_“ statt der Karten-ID.
// combat/public ist das Verzeichnis für alle Mitglieder: { maps: { <kartenId>: { active, round, name, updatedAt } },
// prompts: [Rückfragen an Spieler] }. Gemeinsame Logik für Kampf-Tracker und Kampfkarte; die Regeln (Zugwechsel,
// Schaden, Zustände) stehen in engine.js.
import { db } from './db.js';
import { app, col, bridge } from './app.js';
import { uid, now } from '../lib/util.js';
import { roll, modifier } from '../lib/dice.js';
import { normalizeMonster } from '../ui/statblock.js';

export const EMPTY_COMBAT = { active: false, round: 1, turn: 0, combatants: [], log: [], mapId: null, zones: [], results: [], prompts: [] };

export const NO_MAP = '_';
const mk = (m) => (m && m !== NO_MAP ? String(m) : NO_MAP);
export const gmDocId = (m) => `gm~${mk(m)}`;
export const pubDocId = (m) => `pub~${mk(m)}`;
export const INDEX_DOC = 'public';

// Karte des Ereignisses, das gerade ausgewertet wird (relay.js setzt sie je Ereignis – die Ereignisse laufen
// nacheinander). Alle anderen Aufrufer geben die Karte ausdrücklich mit.
let curMap = null;
export function setCombatMap(m) { curMap = m && m !== NO_MAP ? m : null; }
export const combatMap = () => curMap;

// Älterer Stand: ein einziges Dokument „gm“ für die ganze Kampagne → einmalig zur passenden Karte umziehen
let legacyDone = null;
async function fromLegacy(mapId) {
  const cid = app.get().cid;
  if (legacyDone === cid || app.get().role !== 'gm') return null;
  const old = await db.get(col('combat'), 'gm').catch(() => null);
  if (!old) { legacyDone = cid; return null; }
  if (mk(old.mapId) !== mk(mapId)) return null;
  legacyDone = cid;
  const st = { ...old, mapId: mapId || null };
  await db.set(col('combat'), gmDocId(mapId), clean(st)).catch(() => {});
  await db.remove(col('combat'), 'gm').catch(() => {});
  return st;
}

export async function loadCombat(mapId = curMap) {
  const st = (await db.get(col('combat'), gmDocId(mapId))) || (await fromLegacy(mapId));
  return st ? { ...EMPTY_COMBAT, ...st, mapId: mapId && mapId !== NO_MAP ? mapId : null } : { ...EMPTY_COMBAT, mapId: mapId && mapId !== NO_MAP ? mapId : null };
}
// Verzeichnis: auf welchen Karten läuft gerade ein Kampf? → [{ mapId, active, round, name }]
export async function combatIndex() {
  const ix = await db.get(col('combat'), INDEX_DOC).catch(() => null);
  return Object.entries(ix?.maps || {}).map(([m, v]) => ({ mapId: m === NO_MAP ? null : m, ...v })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ───────────────────────── Ausgang ─────────────────────────
// Seiten: von der SL gesetzte Teams schlagen die Einteilung Helden ↔ Gegner; „n“ = unbeteiligt (zählt nicht)
export const sideOfCombatant = (c) => c.team || (c.isPC || c.ally ? 'pc' : 'npc');
// Steht eine Seite noch? (lebt oder macht noch Todesrettungswürfe)
export const stillStanding = (c) => !c.dead && !c.vanish && !(c.hp != null && c.hp <= 0 && (c.stable || !c.isPC));
// Ist der Kampf entschieden? → Seite, die übrig bleibt ('pc', 'npc', 'a' …), sonst null
export function combatWinner(x) {
  const list = (x.combatants || []).filter((c) => !c.vanish && sideOfCombatant(c) !== 'n');
  const sides = [...new Set(list.map(sideOfCombatant))];
  if (sides.length < 2) return null;
  const left = sides.filter((s) => list.some((c) => sideOfCombatant(c) === s && stillStanding(c)));
  if (left.length > 1) return null;
  return left[0] || 'none';
}
const AUSGANG_MS = 3000;
export function finishCombat(x, why = '') {
  x.active = false;
  x.turn = 0;
  x.zones = [];
  x.prompts = [];
  // Der nächste Kampf beginnt mit neuer Initiative
  for (const c of x.combatants || []) { c.eco = null; c.init = null; c.dsPending = null; }
  const o = x.outcome;
  x.outcome = null;
  x.log = x.log || [];
  x.log.push({ ts: now(), text: `🏁 Kampf beendet${why || (o ? (o.winner === 'pc' ? ' – Sieg' : o.winner === 'none' ? '' : ' – Niederlage') : '')}`, kind: 'round', e: { t: 'round', n: 0, end: true } });
  return x;
}

export function hpState(c) {
  if (c.dead) return 'Tot';
  if (c.hp <= 0) return 'Kampfunfähig';
  const r = c.hp / (c.maxHp || 1);
  if (r >= 1) return 'Unverletzt';
  if (r > 0.5) return 'Angeschlagen';
  if (r > 0.25) return 'Blutig';
  return 'Kritisch';
}
export const isOut = (c) => !!c.dead || (!c.isPC && c.hp <= 0);

const concPub = (c) => (c.concentration && typeof c.concentration === 'object' ? { name: c.concentration.name, spellId: c.concentration.spellId || null } : c.concentration ? { name: 'Konzentration' } : null);
const effPub = (e) => ({ id: e.id, key: e.key, name: e.name || '', src: e.src || null, rounds: e.rounds || 0, ...(e.silent ? { silent: true } : {}), ...(e.data ? { data: e.data } : {}), ...(e.until ? { until: e.until } : {}) });
const condPub = (k) => ({ name: k.name, rounds: k.rounds || 0, ...(k.src ? { src: k.src } : {}), ...(k.label ? { label: k.label } : {}), ...(k.level ? { level: k.level } : {}), ...(k.until ? { until: k.until } : {}) });

// Schlüssel einer Kreatur im Bestiarium der Spieler (campaigns/{cid}/kills)
export const killKey = (c) => {
  const sb = c?.statblock;
  return sb ? String(sb.id || sb.srdId || sb.name || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) : '';
};
// Was die Gruppe schon besiegt hat, darf sie genauer sehen (RK und TP) – sonst nur die SL
let known = { cid: null, keys: new Set() };
async function knownKills() {
  const cid = app.get().cid;
  if (known.cid !== cid) {
    known = { cid, keys: new Set() };
    try { for (const k of await db.list(col('kills'))) known.keys.add(k.key || k.id); } catch { /* offline */ }
  }
  return known.keys;
}
export function addKnownKill(key) { if (key) known.keys.add(key); }

export function projection(state, knownKeys = new Set()) {
  const isKnown = (c) => !c.isPC && !c.ownerUid && knownKeys.has(killKey(c));
  const knownIds = new Set((state.combatants || []).filter(isKnown).map((c) => c.id));
  const cur = state.combatants[state.turn];
  const t = now();
  return {
    active: !!state.active,
    round: state.round || 1,
    currentId: state.active && cur && !cur.hidden ? cur.id : null,
    mapId: state.mapId || null,
    list: state.combatants.filter((c) => !c.hidden && !c.vanish).map((c) => ({
      id: c.id, name: c.name, init: c.init ?? null, initBonus: c.initBonus || 0, isPC: !!c.isPC, ally: !!c.ally, ...(c.team ? { team: c.team } : {}), ownerUid: c.ownerUid || null, charId: c.charId || null, tokenId: c.tokenId || null,
      summonOf: c.summonOf || null,
      // eigene Beschwörungen brauchen den Statblock für die Kampfleiste, Verwandelte ihre neue Gestalt
      ...(c.ownerUid && !c.isPC && c.statblock ? { statblock: c.statblock } : {}),
      form: c.form ? { name: c.form.name, mode: c.form.mode, src: c.form.src || null, ...(c.isPC || c.ownerUid ? { statblock: c.form.statblock } : {}) } : null,
      conditions: (c.conditions || []).map(condPub), effects: (c.effects || []).map(effPub), concentration: concPub(c),
      hpState: hpState(c), down: c.hp <= 0, dead: !!c.dead, stable: !!c.stable, surprised: !!c.surprised, color: c.color || null,
      eco: c.eco || null, reaction: c.reaction !== false, turnNo: c.turnNo || 0,
      art: c.statblock ? { name: c.statblock.name, type: c.statblock.type || '', image: c.statblock.image || null, cr: c.statblock.cr ?? null, size: c.statblock.size || '', sizeKey: c.statblock.sizeKey || '' } : null,
      ...(c.isPC || c.showHp || knownIds.has(c.id) ? { hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp || 0 } : {}),
      ...(c.isPC ? { ac: c.ac, deathSaves: c.deathSaves || { s: 0, f: 0 }, dsPending: c.dsPending || null } : knownIds.has(c.id) ? { ac: c.ac, known: true } : {}),
    })),
    zones: (state.zones || []).map((z) => ({ id: z.id, name: z.name, src: z.src || null, tpl: z.tpl, follow: z.follow || null, color: z.color || null, obscure: !!z.obscure, difficult: z.difficult || 0, silence: !!z.silence, barrier: !!z.barrier, opaque: !!z.opaque })),
    results: (state.results || []).slice(-10),
    outcome: state.outcome || null,
    startedAt: state.startedAt || null,
    // Rechenweg (tip) sehen alle – SL-Zusätze (gm, gtip: RK und TP von Monstern) nicht
    // RK/TP im Rechenweg nur, wenn das Ziel schon im Bestiarium der Spieler steht
    log: (state.log || []).slice(-80).map((l) => {
      const extra = l.gtip && l.e?.o && knownIds.has(l.e.o[0]) ? l.gtip : null;
      const tip = l.tip || extra ? { ...(l.tip || {}), ...(extra || {}) } : null;
      return { ts: l.ts, text: l.text, ...(l.kind ? { kind: l.kind } : {}), ...(l.e ? { e: l.e } : {}), ...(tip ? { tip } : {}) };
    }),
    updatedAt: t,
  };
}

// Firestore kennt kein undefined – JSON räumt es weg (und kopiert dabei tief)
function clean(o) { return JSON.parse(JSON.stringify(o)); }

const indexSeen = new Map();
export async function saveCombat(state) {
  const s = clean({ ...state, prompts: [], log: (state.log || []).slice(-150), results: (state.results || []).slice(-14), updatedAt: now() });
  const ops = [
    { op: 'set', col: col('combat'), id: gmDocId(s.mapId), data: s },
    { op: 'set', col: col('combat'), id: pubDocId(s.mapId), data: projection(s, await knownKills()) },
  ];
  // Verzeichnis nur schreiben, wenn sich dort etwas ändert
  const cur = s.combatants?.[s.turn];
  const entry = { active: !!s.active, round: s.round || 1, n: (s.combatants || []).length, cur: s.active && cur && !cur.hidden ? cur.name : '',
    // offene Todesrettungswürfe – würfelt ui/deathsave.js beim Besitzer, egal welche Ansicht offen ist
    ds: (s.combatants || []).filter((c) => c.isPC && c.dsPending && !c.dead).map((c) => ({ id: c.id, owner: c.ownerUid || null, at: c.dsPending.at, adv: !!c.dsPending.adv, name: c.name })) };
  const key = `${app.get().cid}|${mk(s.mapId)}`;
  const sig = JSON.stringify(entry);
  if (indexSeen.get(key) !== sig) {
    indexSeen.set(key, sig);
    ops.push({ op: 'set', col: col('combat'), id: INDEX_DOC, data: { maps: { [mk(s.mapId)]: { ...entry, updatedAt: now() } } }, merge: true });
  }
  await db.batch(ops);
  return s;
}

// Lädt, verändert und speichert den Kampf in einem Schritt. Aufrufe laufen nacheinander, damit sich
// gleichzeitige Änderungen (Relais, Rückfragen, Karte) nicht gegenseitig überschreiben.
let lock = Promise.resolve();
const goneTokens = new Set();
const sheetKey = (c) => `${c.hp}|${c.tempHp || 0}|${c.deathSaves?.s || 0}|${c.deathSaves?.f || 0}|${c.dead ? 1 : 0}|${c.concentration?.name || ''}`;
const ausgangUhr = new Map();
export function mutateCombat(fn, mapId = curMap) {
  const run = lock.then(async () => {
    const st = await loadCombat(mapId);
    const base = { ...EMPTY_COMBAT, ...clean(st) };
    const before = new Map((st.combatants || []).map((c) => [c.id, sheetKey(c)]));
    const next = (await fn(base)) || base;
    next.mapId = base.mapId;
    // Kampf entschieden? 3 Sekunden „Gewonnen/Verloren“, dann endet er von selbst (zurück ins Erkunden)
    if (next.active) {
      const w = combatWinner(next);
      if (!w) next.outcome = null;
      else if (!next.outcome) next.outcome = { winner: w, at: now() };
      if (next.outcome && now() - next.outcome.at > AUSGANG_MS + 1500) finishCombat(next);
    } else next.outcome = null;
    const saved = await saveCombat(next);
    const uhr = mk(saved.mapId);
    if (saved.active && saved.outcome && !ausgangUhr.has(uhr)) {
      ausgangUhr.set(uhr, setTimeout(() => {
        ausgangUhr.delete(uhr);
        mutateCombat((x) => (x.active && x.outcome ? finishCombat(x) : x), saved.mapId || NO_MAP).catch(() => {});
      }, AUSGANG_MS + 200));
    }
    for (const c of saved.combatants || []) if (c.isPC && before.has(c.id) && before.get(c.id) !== sheetKey(c)) pushCharHp(c);
    // Verschwundene Beschwörungen: Token von der Karte nehmen
    for (const c of saved.combatants || []) {
      if (!c.vanish || !c.tokenId || goneTokens.has(c.tokenId)) continue;
      goneTokens.add(c.tokenId);
      db.remove(col('tokens'), c.tokenId).catch(() => {});
    }
    return saved;
  });
  lock = run.catch(() => {});
  return run;
}

export function makeCombatant({ name, hp = 10, maxHp, ac = 10, initBonus = 0, isPC = false, statblock = null, ownerUid = null, charId = null, hidden = false, color = null, init = null, tokenId = null }) {
  return {
    id: uid(8), name, hp: Number(hp) || 1, maxHp: Number(maxHp ?? hp) || 1, tempHp: 0, ac, initBonus: Number(initBonus) || 0, init,
    isPC, statblock, ownerUid, charId, hidden, conditions: [], effects: [], deathSaves: { s: 0, f: 0 }, concentration: null, legendaryUsed: 0, notes: '', color, tokenId,
    reaction: true, turnNo: 0, dead: false, stable: false, surprised: false, eco: null, mSlots: {}, perDay: {}, recharge: {}, rechargeOn: {},
  };
}

export function combatantsFromMonsters(monsters, { rollHp = false } = {}) {
  const out = [];
  for (const raw of monsters) {
    const m = normalizeMonster(raw);
    const qty = Math.max(1, Number(raw.qty) || 1);
    for (let i = 1; i <= qty; i++) {
      let hp = Number(m.hp) || 1;
      if (rollHp && m.hpDice) {
        try { hp = Math.max(1, roll(m.hpDice).total); } catch { /* Standard-TP */ }
      }
      const { qty: _q, ...sb } = m;
      if (raw.image) sb.image = raw.image;
      // normalizeMonster kennt diese Felder nicht – für Zauber, Bewegung und Größe im Kampf behalten
      for (const k of ['casting', 'speeds', 'sizeKey', 'id']) if (raw[k] != null) sb[k] = raw[k];
      out.push(makeCombatant({ name: qty > 1 ? `${m.name} ${i}` : m.name, hp, ac: parseInt(m.ac, 10) || 10, initBonus: modifier(m.abilities.dex), statblock: sb }));
    }
  }
  return out;
}

export function combatantFromCharacter({ owner, char }) {
  const dex = modifier(char.abilities?.dex ?? 10);
  const c = makeCombatant({
    name: char.name || 'Held', hp: char.hp ?? char.maxHp ?? 10, maxHp: char.maxHp ?? 10, ac: char.ac ?? 10,
    initBonus: (Number(char.initBonus) || 0) + dex, isPC: true, ownerUid: owner, charId: char.id, color: char.color || null,
  });
  c.tempHp = Number(char.tempHp) || 0;
  c.dead = !!char.dead;
  if (char.hp <= 0) c.deathSaves = char.deathSaves || { s: 0, f: 0 };
  return c;
}

export async function addToCombat(list, text, mapId = NO_MAP) {
  return mutateCombat((st) => {
    st.combatants = [...st.combatants, ...list];
    st.log = [...(st.log || []), { ts: now(), text: text || `${list.length} Kämpfer hinzugefügt` }];
    return st;
  }, mapId);
}

export function sortByInit(list) {
  return [...list].sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || (b.initBonus || 0) - (a.initBonus || 0) || (a.isPC === b.isPC ? 0 : a.isPC ? -1 : 1));
}
// Neu sortieren, ohne dass der aktuelle Kämpfer wechselt
export function resort(x) {
  const curId = x.combatants[x.turn]?.id;
  x.combatants = sortByInit(x.combatants);
  x.turn = Math.max(0, x.combatants.findIndex((c) => c.id === curId));
  return x;
}
export const initRoll = (c) => roll(`1d20${(c.initBonus || 0) >= 0 ? '+' : ''}${c.initBonus || 0}`).total;

// Zugwechsel: die Regel-Engine (engine.advance) meldet sich über actions.js an. Ohne sie einfacher Wechsel.
let turnEngine = null;
export function setTurnEngine(fn) { turnEngine = fn; }
export function advanceTurn(x, ctx) {
  const n = (x.combatants || []).length;
  if (!n) return x;
  if (turnEngine) return turnEngine(x, ctx);
  x.log = x.log || [];
  let t = x.turn;
  let guard = 0;
  do {
    t++;
    if (t >= n) {
      t = 0;
      x.round = (x.round || 1) + 1;
      x.log.push({ ts: now(), text: `— Runde ${x.round} —`, kind: 'round', e: { t: 'round', n: x.round } });
    }
    guard++;
  } while (guard < n && isOut(x.combatants[t]));
  x.turn = t;
  const c = x.combatants[t];
  c.legendaryUsed = 0;
  c.conditions = (c.conditions || []).map((k) => (k.rounds ? { ...k, rounds: k.rounds - 1 } : k)).filter((k) => {
    if (k.rounds === 0) {
      x.log.push({ ts: now(), text: `${c.name}: „${k.name}“ endet` });
      return false;
    }
    return true;
  });
  x.log.push({ ts: now(), text: `${c.name} ist am Zug`, kind: 'turn', e: { t: 'turn', o: [c.id, c.name] } });
  return x;
}

// Trefferpunkte, Todesrettungswürfe und Konzentration in den Charakterbogen zurückschreiben
export function pushCharHp(c) {
  if (!c.isPC || !c.charId || !c.ownerUid) return;
  const conc = c.concentration && typeof c.concentration === 'object' ? { name: c.concentration.name, id: c.concentration.spellId || null } : null;
  // Verwandelt (2014): im Bogen bleiben die echten TP stehen
  const hp = c.form?.mode === 'replace' ? Number(c.form.hp0) || 0 : c.hp;
  db.update(`users/${c.ownerUid}/characters`, c.charId, { hp, tempHp: c.tempHp || 0, deathSaves: c.deathSaves || { s: 0, f: 0 }, dead: !!c.dead, concentration: conc }).catch(() => {});
}

// Schaden (delta < 0) oder Heilung (delta > 0) inkl. temporärer TP, Todesrettungswürfe, Konzentrationshinweis (Kampf-Tracker)
export function applyHp(x, id, delta) {
  const c = x.combatants.find((cc) => cc.id === id);
  if (!c || !delta) return c || null;
  x.log = x.log || [];
  if (delta < 0) {
    let dmg = -delta;
    if (c.tempHp) {
      const t = Math.min(c.tempHp, dmg);
      c.tempHp -= t;
      dmg -= t;
    }
    const before = c.hp;
    c.hp = Math.max(0, c.hp - dmg);
    if (c.isPC && before === 0 && dmg > 0) c.deathSaves = { ...(c.deathSaves || { s: 0, f: 0 }), f: Math.min(3, (c.deathSaves?.f || 0) + 1) };
    if (c.concentration) bridge.toast(`${c.name}: Konzentration prüfen – KON-Rettungswurf SG ${Math.max(10, Math.floor(-delta / 2))}`, 'info', { duration: 7000 });
    x.log.push({ ts: now(), text: `${c.name} erleidet ${-delta} Schaden → ${c.isPC ? `${c.hp}/${c.maxHp}` : hpState(c)}${c.hp === 0 ? (c.isPC ? ' – bewusstlos!' : ' – besiegt!') : ''}` });
  } else {
    c.hp = Math.min(c.maxHp, c.hp + delta);
    if (c.hp > 0) c.deathSaves = { s: 0, f: 0 };
    x.log.push({ ts: now(), text: `${c.name} heilt ${delta} → ${c.isPC ? `${c.hp}/${c.maxHp}` : hpState(c)}` });
  }
  pushCharHp(c);
  return c;
}

export function combatantForToken(t, list) {
  if (!t || !list) return null;
  return list.find((c) => (t.combatantId && c.id === t.combatantId) || (t.charId && c.charId === t.charId) || (c.tokenId && c.tokenId === t.id)) || null;
}
