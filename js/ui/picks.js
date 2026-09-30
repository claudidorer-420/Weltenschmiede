// Auswahl aus Wirkungen (fx „pick“): Talente wie „Widerstandsfähig“ (Attribut + Rettungswurf), „Geschickt“ (3 Fertigkeiten),
// „Elementarer Adept“ (Schadensart), „Magischer Initiat“ (Zauber einer Liste), Spezies mit freier Sprache …
// Gespeichert wird im Bogen unter c.picks['<quelle>#<nummer>'] = [werte]; chargen.charFxList() setzt daraus echte Wirkungen.
import { html } from '../lib/preact.js';
import { charPicks, AB, AB_NAME, WEAPONS, LANGUAGES } from '../data/chargen.js';
import { SKILLS } from '../data/rules5e.js';
import { DAMAGE_ART } from '../data/artmap.js';
import { useSpells } from '../data/spells.js';
import { PICK_DE, STYLE_FX, fxLabel, optKey } from '../core/effects.js';
import { FxText, fxNames } from './fxtext.js';


const toArr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
// Möglichkeiten einer Auswahl: [{ value, label }]
export function pickOptions(f, spells) {
  const from = toArr(f.from);
  const only = (list) => (from.length ? list.filter((o) => from.includes(o.value)) : list);
  switch (f.k) {
    case 'skill': case 'expertise': return only(SKILLS.map((s) => ({ value: s.key, label: s.name })));
    case 'ability': case 'save': return only(AB.map((k) => ({ value: k, label: AB_NAME[k] })));
    case 'dmg': return only(Object.entries(DAMAGE_ART).map(([k, v]) => ({ value: k, label: v.name })));
    case 'lang': return only(LANGUAGES.map((l) => ({ value: l, label: l })));
    case 'weapon': return only([{ value: 'simple', label: 'einfache Waffen' }, { value: 'martial', label: 'Kriegswaffen' }, ...WEAPONS.map((w) => ({ value: w.key, label: w.name }))]);
    case 'armor': return only([{ value: 'light', label: 'leichte Rüstung' }, { value: 'medium', label: 'mittelschwere Rüstung' }, { value: 'heavy', label: 'schwere Rüstung' }, { value: 'shield', label: 'Schilde' }]);
    case 'style': return only(Object.entries(STYLE_FX).map(([value, label]) => ({ value, label })));
    case 'spell': case 'cantrip': {
      const lv = f.k === 'cantrip' ? 0 : Number(f.lv) || 1;
      return (spells || []).filter((s) => s.level === lv && (!f.list || (s.classes || []).includes(f.list)) && (!from.length || from.includes(s.name))).map((s) => ({ value: s.name, label: s.name }));
    }
    case 'option': return toArr(f.options).filter((o) => o && o.name).map((o) => ({ value: optKey(o), label: o.name, desc: o.desc || '', fx: o.fx || [] }));
    default: return from.map((x) => ({ value: x, label: x }));
  }
}
// Offene Auswahlen zählen (für Hinweise „noch 2 Auswahlen offen“)
export const openPicks = (c) => charPicks(c).filter((p) => (p.chosen || []).length < (Number(p.f.n) || 1)).length;

export function PicksPanel({ char, ed = '2014', disabled = false, onChange, only = null }) {
  const picks = charPicks(char).filter((p) => !only || only.has(p.key));
  const spells = useSpells(ed);
  if (!picks.length) return null;
  return html`<div class="pk-list">${picks.map((p) => {
    const n = Number(p.f.n) || 1;
    const chosen = p.chosen || [];
    const opts = pickOptions(p.f, spells);
    const toggle = (v) => {
      if (disabled) return;
      const has = chosen.includes(v);
      const next = has ? chosen.filter((x) => x !== v) : n === 1 ? [v] : chosen.length < n ? [...chosen, v] : chosen;
      onChange(p.key, next);
    };
    const title = p.f.label || `${p.src}: ${n} × ${PICK_DE[p.f.k] || p.f.k}${p.f.v ? ` (+${p.f.v})` : ''}`;
    return html`<div class="pk-row" key=${p.key}>
      <div class="pk-h"><b>${title}</b><span class=${`pk-n${chosen.length >= n ? ' ok' : ''}`}>${chosen.length}/${n}</span></div>
      ${p.f.k === 'option' ? html`<div class="pk-opts">${opts.map((o) => html`<button type="button" key=${o.value} class=${`pk-opt${chosen.includes(o.value) ? ' on' : ''}`} disabled=${disabled} onClick=${() => toggle(o.value)}>
          <b>${o.label}</b>${o.desc ? html`<span class="small"><${FxText} text=${o.desc} name=${o.label} /></span>` : null}
          ${o.fx.length ? html`<span class="tiny muted">${o.fx.map((g) => fxLabel(g, fxNames)).join(' · ')}</span>` : null}</button>`)}
          ${!opts.length ? html`<span class="small faint">Keine Optionen – im Regelwerk ergänzen.</span>` : null}</div>`
      : p.f.k === 'tool' && !opts.length ? html`<input class="input" disabled=${disabled} value=${chosen.join(', ')} placeholder="Werkzeug eintragen" onInput=${(e) => onChange(p.key, e.target.value.split(/\s*,\s*/).filter(Boolean).slice(0, n))} />`
        : html`<div class="pk-chips">${opts.map((o) => html`<button type="button" key=${o.value} class=${`pk-chip${chosen.includes(o.value) ? ' on' : ''}`} disabled=${disabled} onClick=${() => toggle(o.value)}>${o.label}</button>`)}
          ${!opts.length ? html`<span class="small faint">Keine Möglichkeiten – im Regelwerk prüfen.</span>` : null}</div>`}
    </div>`;
  })}</div>`;
}
