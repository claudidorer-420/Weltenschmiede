// Regeltext mit hervorgehobenen Wirkungen: fett = wirkt, gepunktet = nur Hinweis (bedingt/Auswahl), Gold = Geld.
import { html } from '../lib/preact.js';
import { fxSegments, fxLabel } from '../core/effects.js';
import { fxText, skillName, findWeapon } from '../data/chargen.js';
import { DAMAGE_ART } from '../data/artmap.js';

export const fxNames = { skillName, weaponName: (k) => findWeapon(k)?.name || k, dmgName: (k) => DAMAGE_ART[k]?.name || k };
const WHY = { bedingt: 'nur Hinweis – an eine Situation gebunden', Auswahl: 'Auswahl – über die Felder festlegen', Hinweis: 'Hinweis', Geld: 'Geld' };

export function fxClass(f) {
  if (f.t === 'money') return 'fx-hl fx-money';
  if (f.t === 'adv') return 'fx-hl fx-hint';
  return `fx-hl${f.active ? '' : ' fx-cond'}`;
}
export function fxTitle(f) {
  return `${fxLabel(f, fxNames)}${f.active || f.t === 'money' ? '' : ` · ${WHY[f.why] || f.why || 'nicht automatisch'}`}`;
}
// list = bereits erkannte Wirkungen (sonst wird der Text hier gelesen)
export function FxText({ text, name = '', list = null, plain = false }) {
  const src = String(text || '');
  if (plain || !src) return html`<span>${src}</span>`;
  const fx = list || fxText(src, { name });
  if (!fx.length) return html`<span>${src}</span>`;
  return html`<span>${fxSegments(src, fx).map((s, i) => (s.fx ? html`<b key=${i} class=${fxClass(s.fx)} title=${fxTitle(s.fx)}>${s.text}</b>` : s.text))}</span>`;
}
