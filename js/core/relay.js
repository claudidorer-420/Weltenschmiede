// Signale zwischen Spielern und Spielleitung: Spieler melden Aktionen (mit ihren Würfen), Schadenswürfe, Bewegung,
// Zugende, Initiative, Todesrettungswürfe und Antworten auf Rückfragen; die SL wertet sie hier der Reihe nach aus –
// egal, welche Ansicht offen ist. Jedes Kampfereignis trägt die Karte (mapId): je Karte läuft ein eigener Kampf.
import { db } from './db.js';
import { app, col, myUid } from './app.js';
import { mutateCombat, loadCombat, advanceTurn, resort, setCombatMap, combatMap, INDEX_DOC } from './combat.js';
import { answerPrompt, promptTarget, setRemotePrompts, setOnlineCheck } from './react.js';
import { now, uid } from '../lib/util.js';

const actions = () => import('./actions.js');
let recent = [];
let chain = Promise.resolve();

// Nacheinander auswerten (ein Schadenswurf wartet, bis sein Angriff aufgelöst ist) – Antworten auf Rückfragen sofort,
// sonst würde eine wartende Reaktionsfrage die eigene Antwort blockieren.
function dispatch(from, e) {
  if (e.type === 'answer') return handleEvent(from, e);
  const run = chain.then(() => { setCombatMap(e.mapId || null); return handleEvent(from, e); });
  chain = run.catch((err) => console.warn('[Signal]', err));
  return run;
}

// Spieler: Lebenszeichen alle 45 Sekunden (und beim Zurückkehren in die App) – die SL fragt nur anwesende Spieler
// nach Reaktionen, sonst stünde der Kampf bei jeder Frage, bis die Wartezeit abläuft
export function startHeartbeat() {
  const { cid } = app.get();
  if (!cid || db.mode !== 'cloud' || app.get().role === 'gm') return () => {};
  const puls = () => { if (!document.hidden) db.set(col('signals'), myUid(), { alive: now() }, { merge: true }).catch(() => {}); };
  puls();
  const i = setInterval(puls, 45000);
  const sicht = () => { if (!document.hidden) puls(); };
  document.addEventListener('visibilitychange', sicht);
  return () => { clearInterval(i); document.removeEventListener('visibilitychange', sicht); };
}

// Spieler: Ereignis an die SL senden (die letzten Ereignisse bleiben im Dokument, damit nichts verloren geht)
export async function sendEvent(ev) {
  const e = { id: uid(8), ts: now(), ...ev };
  if (db.mode !== 'cloud' || app.get().role === 'gm') {
    await dispatch(myUid(), e);
    return e;
  }
  recent = [...recent, e].slice(-8);
  await db.set(col('signals'), myUid(), { type: e.type, ts: e.ts, value: e.value ?? null, charId: e.charId ?? null, events: JSON.parse(JSON.stringify(recent)) });
  return e;
}

// Wege kommen flach an ([x1, y1, x2, y2 …]) – Firestore kennt keine verschachtelten Listen
const pairs = (p) => (Array.isArray(p) && typeof p[0] === 'number' ? Array.from({ length: Math.floor(p.length / 2) }, (_, i) => [p[i * 2], p[i * 2 + 1]]) : p || []);
async function owns(from, cbId) {
  if (from === myUid()) return true;
  const x = await loadCombat();
  const c = (x.combatants || []).find((y) => y.id === cbId);
  return !!c && !!c.ownerUid && c.ownerUid === from;
}

// Pausierte Karte (map.play = 'pause'): Aktionen der Spieler werden nicht ausgewertet
const SPERRBAR = new Set(['act', 'move', 'endTurn', 'dmg', 'endConc']);
async function pausiert(e) {
  if (!e.mapId) return false;
  const m = await db.get(col('maps'), e.mapId).catch(() => null);
  return m?.play === 'pause';
}
async function handleEvent(from, e) {
  if (from !== myUid() && SPERRBAR.has(e.type) && (await pausiert(e))) return;
  if (e.type === 'answer') {
    const to = promptTarget(e.promptId);
    if (to === undefined || (to && to !== from && from !== myUid())) return;
    answerPrompt(e.promptId, e.choice ?? null);
  } else if (e.type === 'endTurn') {
    const A = await actions();
    const x0 = await loadCombat();
    await A.ensureBattleContext(x0.mapId);
    await mutateCombat((x) => {
      const cur = x.combatants[x.turn];
      if (x.active && cur && (from === myUid() || cur.ownerUid === from)) advanceTurn(x, A.makeCtx(x));
      return x;
    });
  } else if (e.type === 'init') {
    await mutateCombat((x) => {
      const c = x.combatants.find((cc) => (e.charId && cc.charId === e.charId) || (!e.charId && cc.ownerUid === from));
      if (c && (from === myUid() || c.ownerUid === from)) {
        c.init = e.value;
        x.log.push({ ts: now(), text: `🎲 ${c.name} meldet Initiative ${e.value}` });
        resort(x);
      }
      return x;
    });
  } else if (e.type === 'dsave') {
    // Todesrettungswurf, sichtbar gewürfelt beim Besitzer (oder bei der SL) – die Regeln wendet die SL-Seite an
    if (!(await owns(from, e.actor))) return;
    const A = await actions();
    await A.handleDeathSave({ ...e, uid: from });
  } else if (e.type === 'act' || e.type === 'move' || e.type === 'endConc') {
    if (!(await owns(from, e.actor))) return;
    const A = await actions();
    if (e.type === 'act') await A.handleAct({ ...e, uid: from });
    else if (e.type === 'move') await A.handleMove({ ...e, path: pairs(e.path), uid: from });
    else await A.handleEndConc(e);
  } else if (e.type === 'dmg') {
    const x = await loadCombat();
    const rec = (x.results || []).find((r) => r.id === e.resultId);
    if (!rec || !(await owns(from, rec.actor))) return;
    const A = await actions();
    await A.handleDamage({ ...e, uid: from });
  } else if (e.type === 'quest') {
    // Quest-Status, den ein Spieler verschoben hat (nur freigegebene Quests)
    if (app.get().role !== 'gm' || !e.questId || !e.status) return;
    const q = await db.get(col('quests'), e.questId).catch(() => null);
    if (q && q.visibility === 'players' && (q.status || 'open') !== e.status) await db.update(col('quests'), e.questId, { status: e.status, updatedAt: now(), movedBy: from });
  }
}

// SL: Signale der Spieler beobachten (nur im Cloud-Modus nötig) und Rückfragen an Spieler über den Kampfzustand stellen.
export function startGmRelay() {
  const { cid } = app.get();
  if (!cid || db.mode !== 'cloud') return () => {};
  // Rückfragen an Spieler stehen im Verzeichnis combat/public (lesen alle Mitglieder) – mit der Karte des Kampfes
  let offen = [];
  const schreib = () => db.set(col('combat'), INDEX_DOC, { prompts: offen }, { merge: true });
  setRemotePrompts(
    (p) => { offen = [...offen.filter((q) => (q.expires || 0) > now()), { ...p, mapId: p.mapId || combatMap() || null }]; return schreib(); },
    (id) => { offen = offen.filter((q) => q.id !== id && (q.expires || 0) > now()); return schreib(); },
  );
  const key = `ws.sigev.${cid}`;
  let handled;
  try { handled = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { handled = new Set(); }
  const since = now() - 120000;
  // Wer war zuletzt da? (Lebenszeichen oder letztes Ereignis)
  const zuletzt = new Map();
  setOnlineCheck((u) => now() - (zuletzt.get(u) || 0) < 110000);
  const unsub = db.watchCol(col('signals'), {}, (docs) => {
    let changed = false;
    for (const d of docs) {
      zuletzt.set(d.id, Math.max(Number(d.alive) || 0, Number(d.ts) || 0));
      const evs = d.events?.length ? d.events : d.type && d.ts ? [{ id: `${d.id}:${d.ts}`, type: d.type, ts: d.ts, value: d.value, charId: d.charId }] : [];
      for (const e of evs) {
        const id = e.id || `${d.id}:${e.ts}`;
        if (handled.has(id)) continue;
        handled.add(id);
        changed = true;
        if ((e.ts || 0) < since && e.type !== 'quest') continue; // alte Kampfsignale verwerfen, Quest-Verschiebungen nachholen
        dispatch(d.id, { ...e, id }).catch((err) => console.warn('[Signal]', err));
      }
    }
    if (changed) {
      try { localStorage.setItem(key, JSON.stringify([...handled].slice(-400))); } catch { /* voll */ }
    }
  }, () => {});
  return () => {
    unsub();
    setRemotePrompts(null, null);
    setOnlineCheck(null);
  };
}
