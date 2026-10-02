// Blickrichtung von Figuren (Grad, 0 = rechts/Osten, 90 = unten/Süden): Anzeige als Kompass und Auswahl in 16 Schritten.
// Gespeichert am Token (dir) und – für Charaktere – als Voreinstellung im Bogen (facing).
import { html } from '../lib/preact.js';
import { db } from '../core/db.js';
import { app, col } from '../core/app.js';

const NAMEN = ['Osten', 'Ost-Südost', 'Südost', 'Süd-Südost', 'Süden', 'Süd-Südwest', 'Südwest', 'West-Südwest', 'Westen', 'West-Nordwest', 'Nordwest', 'Nord-Nordwest', 'Norden', 'Nord-Nordost', 'Nordost', 'Ost-Nordost'];
const KURZ = ['O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNO', 'NO', 'ONO'];
const stufe = (d) => Math.round((((Number(d) || 0) % 360) + 360) % 360 / 22.5) % 16;
export const dirName = (d) => NAMEN[stufe(d)];
export const dirShort = (d) => KURZ[stufe(d)];

// Kleiner Kompass mit Pfeil (SVG)
export function FacingIcon({ dir = 0, size = 28 }) {
  return html`<svg class="facing-ico" width=${size} height=${size} viewBox="-12 -12 24 24" aria-hidden="true">
    <circle r="10.5" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2" />
    <path d="M -7 -7 A 10 10 0 0 1 7 -7" fill="none" stroke="#ffcf3f" stroke-width="2.4" stroke-linecap="round" transform=${`rotate(${(Number(dir) || 0) + 90})`} />
    <path d="M 0 -6 L 3 2 L 0 0.5 L -3 2 Z" fill="currentColor" transform=${`rotate(${(Number(dir) || 0) + 90})`} />
  </svg>`;
}

// Auswahl in 16 Richtungen (Kreis aus Knöpfen)
export function FacingPicker({ value = 0, onPick }) {
  const cur = stufe(value);
  return html`<div class="facing-pick">
    ${KURZ.map((k, i) => {
      const a = ((i * 22.5) * Math.PI) / 180;
      return html`<button type="button" key=${k} class=${i === cur ? 'on' : ''} title=${NAMEN[i]} style=${{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 40}%` }} onClick=${() => onPick(i * 22.5)}>${k}</button>`;
    })}
    <span class="facing-mid"><${FacingIcon} dir=${value} size=${44} /></span>
  </div>`;
}

// Voreinstellung im Bogen setzen und alle Tokens dieses Charakters mitdrehen
export async function setCharFacing(char, owner, dir) {
  const d = (((Number(dir) || 0) % 360) + 360) % 360;
  if (owner && char?.id) await db.update(`users/${owner}/characters`, char.id, { facing: d }).catch(() => {});
  if (!app.get().cid || !char?.id) return d;
  const gm = app.get().role === 'gm';
  const where = gm ? [['charId', '==', char.id]] : [['charId', '==', char.id], ['visibility', '==', 'players']];
  const toks = await db.list(col('tokens'), { where }).catch(() => []);
  for (const t of toks) await db.update(col('tokens'), t.id, { dir: d }).catch(() => {});
  return d;
}
