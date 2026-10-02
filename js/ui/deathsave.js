// Todesrettungswürfe sichtbar würfeln – unabhängig von der offenen Ansicht. Das Kampfverzeichnis (combat/public)
// führt je Karte die offenen Todesrettungswürfe ({ id, owner, at, adv, name }). Der Besitzer würfelt mit dem
// eigenen Todesrettungswürfel (dice3d SPECIAL_SKINS.death), die SL würfelt für Charaktere ohne Besitzer und springt
// nach 15 Sekunden ein, falls der Spieler nicht da ist. Ausgewertet wird auf der SL-Seite (actions.handleDeathSave).
import { useEffect } from '../lib/preact.js';
import { useStore } from '../core/store.js';
import { app, col, myUid } from '../core/app.js';
import { useDoc } from '../core/hooks.js';
import { prepareRoll, commitRoll, rollBridge } from '../core/rolls.js';
import { sendEvent } from '../core/relay.js';
import { INDEX_DOC, NO_MAP } from '../core/combat.js';

const done = new Set();
const EINSPRINGEN_MS = 15000;

export function rollDeathSave(mapKey, d) {
  const k = `${mapKey}|${d.id}|${d.at}`;
  if (done.has(k)) return;
  done.add(k);
  const r = prepareRoll('1d20', { label: 'Todesrettungswurf', character: d.name || '', kind: 'death', fx: d.adv ? { adv: true } : {} });
  if (!r) return;
  r.special = 'death';
  const nat = (r.dice || []).filter((x) => x.sides === 20).map((x) => x.value);
  const n = d.adv ? Math.max(...nat) : nat[0];
  r.notes = [n === 20 ? 'Natürliche 20 – wacht mit 1 TP auf!' : n === 1 ? 'Natürliche 1 – zwei Fehlschläge' : n >= 10 ? 'Erfolg' : 'Fehlschlag'];
  commitRoll(r, { combat: true });
  rollBridge.show(r);
  sendEvent({ type: 'dsave', actor: d.id, a: nat[0], b: nat[1] ?? null, mapId: mapKey === NO_MAP ? null : mapKey }).catch(() => {});
}

export function DeathSaveHost() {
  const cid = useStore(app, (s) => s.cid);
  const gm = useStore(app, (s) => s.role === 'gm');
  const ix = useDoc(cid ? col('combat') : null, INDEX_DOC);
  const me = myUid();
  const offen = Object.entries(ix?.maps || {}).flatMap(([m, v]) => (v.active ? (v.ds || []).map((d) => ({ m, d })) : []));
  const key = offen.map(({ m, d }) => `${m}|${d.id}|${d.at}`).join(',');
  useEffect(() => {
    const uhren = [];
    for (const { m, d } of offen) {
      const meins = d.owner ? d.owner === me : gm;
      if (meins) { uhren.push(setTimeout(() => rollDeathSave(m, d), 700)); continue; }
      if (gm) uhren.push(setTimeout(() => rollDeathSave(m, d), EINSPRINGEN_MS));
    }
    return () => uhren.forEach(clearTimeout);
  }, [key, gm, me]);
  return null;
}
