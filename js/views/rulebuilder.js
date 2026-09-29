// Regelwerk-Editor: eigene Regelpakete bauen, prüfen, importieren/exportieren und in der Kampagne aktivieren.
// Grundlage bleibt immer der frei lizenzierte Grundbestand (SRD 5.1 / 5.2.1). Pakete ergänzen, ersetzen oder blenden
// Einträge aus – angewendet werden sie in core/rulesets.js, sobald die Kampagne geöffnet ist.
// Bearbeitet wird eine veränderliche Kopie des Pakets (ref) – touch() zeichnet neu und merkt „ungespeichert“.
import { html, useState, useEffect, useMemo, useRef } from '../lib/preact.js';
import { useStore } from '../core/store.js';
import { app, myUid, useEdition } from '../core/app.js';
import {
  CATEGORIES, EDITIONS, rulesState, baseEntries, plain, emptyPack, readPack, checkPack, packFromDoc,
  watchLibrary, saveToLibrary, removeFromLibrary, watchCampaignPacks, saveToCampaign, setCampaignPack, removeFromCampaign, exportPack,
} from '../core/rulesets.js';
import * as CG from '../data/chargen.js';
import { SKILLS } from '../data/rules5e.js';
import { DAMAGE_ART, SCHOOL_ART } from '../data/artmap.js';
import { useSpells } from '../data/spells.js';
import { ViewFrame } from '../ui/frame.js';
import { Icon, IconBtn, Btn, Field, Toggle, Check, Segmented, Select, AutoTextarea, Empty, ViewToggle, openModal, confirmDialog, promptDialog, openMenu, toast, pickFiles } from '../ui/components.js';
import { slugify, uid, now } from '../lib/util.js';

const AB = CG.AB;
const AB_SHORT = CG.AB_SHORT;
const DMG = Object.entries(DAMAGE_ART).map(([k, v]) => ({ value: k, label: v.name, color: v.color }));
const SKILL_OPTS = SKILLS.map((s) => ({ value: s.key, label: s.name }));
const AB_OPTS = AB.map((k) => ({ value: k, label: AB_SHORT[k], title: CG.AB_NAME[k] }));
const FEAT_CATS = [{ value: 'origin', label: 'Herkunftstalent' }, { value: 'general', label: 'Allgemeines Talent' }, { value: 'style', label: 'Kampfstil' }, { value: 'epic', label: 'Epische Gabe' }];
const CAT_LABEL = Object.fromEntries(FEAT_CATS.map((c) => [c.value, c.label]));
const SIZES = ['Winzig', 'Klein', 'Mittelgroß', 'Mittelgroß oder Klein', 'Groß'];
const WEAPON_TYPES = ['Hieb', 'Stich', 'Wucht', 'Feuer', 'Kälte', 'Blitz', 'Säure', 'Gift', 'Energie', 'Nekrotisch', 'Gleißend', 'Psychisch', 'Schall'];
const PROPS = [['f', 'Finesse'], ['l', 'leicht'], ['h', 'schwer'], ['2', 'zweihändig'], ['t', 'Wurfwaffe'], ['r', 'Reichweite'], ['v', 'vielseitig'], ['a', 'Munition (Fernkampf)'], ['o', 'Laden']];
const EXTRA_TAB = { overview: 'Überblick', rules: 'Grundregeln', remove: 'Ausblenden' };
const TABS = ['overview', 'species', 'subspecies', 'backgrounds', 'feats', 'classes', 'subclasses', 'spells', 'weapons', 'armor', 'rules', 'remove'];
const catOf = (k) => CATEGORIES.find((c) => c.key === k);
const m2ft = (m) => Math.round((Number(m) || 0) / 0.3);
const ft2m = (ft) => Math.round((Number(ft) || 0) * 0.3 * 10) / 10;
const fmtM = (ft) => `${String(ft2m(ft)).replace('.', ',')} m`;
const toArr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
// Regelstand, für den ein Eintrag gilt: eigener Wert, sonst der des Pakets
const edOf = (obj, pack) => (obj?.ed ? String(obj.ed) : pack.edition === 'beide' ? null : pack.edition);
const has14 = (obj, pack) => edOf(obj, pack) !== '2024';
const has24 = (obj, pack) => edOf(obj, pack) !== '2014';

// ───────────────────────── Eingabefelder ─────────────────────────
function Chips({ options, value, onChange, max = 0 }) {
  const sel = toArr(value);
  return html`<div class="rb-chips">${options.map((o) => {
    const on = sel.includes(o.value);
    return html`<button type="button" key=${o.value} class=${`rb-chip${on ? ' on' : ''}`} title=${o.title || ''} style=${o.color && on ? { borderColor: o.color, color: o.color } : null}
      onClick=${() => { if (on) onChange(sel.filter((x) => x !== o.value)); else if (!max || sel.length < max) onChange([...sel, o.value]); else toast(`Höchstens ${max} auswählbar.`); }}>${o.label}</button>`;
  })}</div>`;
}

function TextIn({ value, onChange, placeholder = '', list = null, mono = false }) {
  return html`<input class=${`input${mono ? ' mono' : ''}`} value=${value ?? ''} placeholder=${placeholder} list=${list} onInput=${(e) => onChange(e.target.value)} />`;
}
function NumIn({ value, onChange, min, max, step = 1, placeholder = '' }) {
  return html`<input class="input rb-num" type="number" value=${value ?? ''} min=${min} max=${max} step=${step} placeholder=${placeholder}
    onInput=${(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />`;
}
function Area({ value, onChange, rows = 3, placeholder = '' }) {
  return html`<${AutoTextarea} value=${value ?? ''} minRows=${rows} placeholder=${placeholder} onInput=${(e) => onChange(e.target.value)} />`;
}

// Merkmale als Name + Text
function PairList({ value, onChange, addLabel = 'Merkmal hinzufügen', names = ['Name', 'Beschreibung'] }) {
  const list = toArr(value);
  const set = (i, j, v) => { const n = list.map((x) => [...x]); n[i][j] = v; onChange(n); };
  return html`<div class="rb-pairs">
    ${list.map((p, i) => html`<div class="rb-pair" key=${i}>
      <div class="grow stack sm"><${TextIn} value=${p[0]} placeholder=${names[0]} onChange=${(v) => set(i, 0, v)} /><${Area} rows=${2} value=${p[1]} placeholder=${names[1]} onChange=${(v) => set(i, 1, v)} /></div>
      <div class="rb-pair-tools">
        <${IconBtn} icon="chevron-up" size=${14} title="Nach oben" disabled=${!i} onClick=${() => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} />
        <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => onChange(list.filter((_, k) => k !== i))} />
      </div>
    </div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => onChange([...list, ['', '']])}>${addLabel}<//>
  </div>`;
}

function AbMap({ value, onChange }) {
  const v = value || {};
  return html`<div class="rb-abmap">${AB.map((k) => html`<label key=${k}><span>${AB_SHORT[k]}</span><${NumIn} value=${v[k]} min=${-4} max=${4} placeholder="0"
    onChange=${(n) => { const o = { ...v }; if (!n) delete o[k]; else o[k] = n; onChange(Object.keys(o).length ? o : undefined); }} /></label>`)}</div>`;
}

// 20 Zahlen (eine je Stufe) mit Vorlagen
function LevelRow({ value, onChange, presets = [] }) {
  const row = Array.from({ length: 20 }, (_, i) => (Array.isArray(value) ? value[i] ?? '' : value ?? ''));
  return html`<div class="stack sm">
    <div class="rb-levelrow">${row.map((n, i) => html`<label key=${i}><span>${i + 1}</span><input class="input" type="number" min="0" value=${n}
      onInput=${(e) => { const r = row.map((x) => (x === '' ? 0 : Number(x))); r[i] = Number(e.target.value) || 0; onChange(r); }} /></label>`)}</div>
    ${presets.length ? html`<div class="row" style="gap:6px">${presets.map(([label, arr]) => html`<${Btn} size="sm" kind="ghost" key=${label} onClick=${() => onChange([...arr])}>${label}<//>`)}</div>` : null}
  </div>`;
}

// Liste verschachtelter Objekte (z. B. Unterarten, Auswahloptionen)
function ObjList({ value, onChange, fields, ctx, addLabel, make, titleOf }) {
  const list = toArr(value);
  const [open, setOpen] = useState(-1);
  return html`<div class="rb-objlist">
    ${list.map((o, i) => html`<div class=${`rb-obj${open === i ? ' open' : ''}`} key=${i}>
      <div class="rb-obj-head" onClick=${() => setOpen(open === i ? -1 : i)}>
        <${Icon} name=${open === i ? 'chevron-down' : 'chevron-right'} size=${14} /><b class="grow">${titleOf(o) || '(ohne Namen)'}</b>
        <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${(e) => { e.stopPropagation(); onChange(list.filter((_, k) => k !== i)); }} />
      </div>
      ${open === i ? html`<div class="rb-obj-body"><${Form} fields=${fields} obj=${o} ctx=${{ ...ctx, touch: () => onChange([...list]) }} /></div>` : null}
    </div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => { onChange([...list, make()]); setOpen(list.length); }}>${addLabel}<//>
  </div>`;
}

// Ein Feld aus einer Beschreibung { k, label, type, hint, show, options, … }
function FieldView({ f, obj, ctx }) {
  if (f.show && !f.show(obj, ctx)) return null;
  const val = f.get ? f.get(obj, ctx) : obj[f.k];
  const set = (v) => {
    if (f.set) f.set(obj, v, ctx);
    else if (v === undefined || v === '' || (Array.isArray(v) && !v.length && !f.keepEmpty)) delete obj[f.k];
    else obj[f.k] = v;
    ctx.touch();
  };
  const opts = typeof f.options === 'function' ? f.options(obj, ctx) : f.options;
  let input;
  switch (f.type) {
    case 'textarea': input = html`<${Area} rows=${f.rows || 4} value=${val} placeholder=${f.placeholder} onChange=${set} />`; break;
    case 'number': input = html`<${NumIn} value=${val} min=${f.min} max=${f.max} step=${f.step} placeholder=${f.placeholder} onChange=${set} />`; break;
    case 'dist': input = html`<div class="rb-unit"><${NumIn} value=${val == null ? '' : ft2m(val)} step=${1.5} min=${0} onChange=${(m) => set(m == null ? undefined : m2ft(m))} /><span>m</span></div>`; break;
    case 'select': input = html`<${Select} value=${val ?? ''} options=${opts} onChange=${(v) => set(v === '' ? undefined : f.num ? Number(v) : v)} />`; break;
    case 'chips': input = html`<${Chips} options=${opts} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'abilities': input = html`<${Chips} options=${AB_OPTS} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'skills': input = html`<${Chips} options=${SKILL_OPTS} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'damage': input = html`<${Chips} options=${DMG} value=${val} onChange=${set} />`; break;
    case 'abmap': input = html`<${AbMap} value=${val} onChange=${set} />`; break;
    case 'pairs': input = html`<${PairList} value=${val} onChange=${set} addLabel=${f.add} />`; break;
    case 'bool': input = html`<${Toggle} checked=${!!val} onChange=${(v) => set(v || undefined)} label=${f.toggle || ''} />`; break;
    case 'levels': input = html`<${LevelRow} value=${val} presets=${f.presets || []} onChange=${set} />`; break;
    case 'custom': input = f.render(obj, ctx, set); break;
    default: input = html`<${TextIn} value=${val} placeholder=${f.placeholder} list=${f.list} mono=${f.mono} onChange=${set} />`;
  }
  return html`<${Field} label=${f.label} hint=${f.hint} class=${f.wide ? 'rb-wide' : ''}>${input}<//>`;
}
function Form({ fields, obj, ctx }) {
  return html`<div class="rb-form">${fields.map((f) => html`<${FieldView} key=${f.k || f.label} f=${f} obj=${obj} ctx=${ctx} />`)}</div>`;
}

// ───────────────────────── Feldbeschreibungen je Kategorie ─────────────────────────
const edField = { k: 'ed', label: 'Regelstand', type: 'select', hint: 'Leer = wie das Paket', options: [{ value: '', label: 'Wie das Paket' }, { value: '2024', label: 'Regeln 2024' }, { value: '2014', label: 'Regeln 2014' }] };
// Name; die Kennung wächst automatisch mit, solange sie niemand von Hand geändert hat
const nameField = (hint, keyProp = 'key') => ({
  k: 'name', label: 'Name', hint,
  set: (o, v) => {
    const auto = !o[keyProp] || o[keyProp] === slugify(o.name || '');
    o.name = v;
    if (auto) o[keyProp] = slugify(v);
  },
});
const keyField = { k: 'key', label: 'Kennung', mono: true, hint: 'Eindeutiger Schlüssel. Gleiche Kennung wie ein Grundeintrag = ersetzt ihn.' };

const SUB_FIELDS = [
  nameField(), { k: 'asi', label: 'Attributsboni', type: 'abmap' }, { k: 'speed', label: 'Bewegungsrate (abweichend)', type: 'dist' }, { k: 'dark', label: 'Dunkelsicht (abweichend)', type: 'dist' },
  { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0 }, { k: 'resist', label: 'Resistenzen', type: 'damage' },
  { k: 'traits', label: 'Merkmale', type: 'pairs', wide: true },
];
const OPTION_FIELDS = [nameField(), { k: 'note', label: 'Kurzbeschreibung', type: 'textarea', rows: 2, wide: true }, { k: 'resist', label: 'Resistenzen', type: 'damage' }, { k: 'dark', label: 'Dunkelsicht (abweichend)', type: 'dist' }, { k: 'speed', label: 'Bewegungsrate (abweichend)', type: 'dist' }];

const FIELDS = {
  species: [
    nameField('So erscheint die Spezies im Charakter-Assistenten.'), edField,
    { k: 'size', label: 'Größe', list: 'rb-sizes', placeholder: 'Mittelgroß' },
    { k: 'speed', label: 'Bewegungsrate', type: 'dist' },
    { k: 'dark', label: 'Dunkelsicht', type: 'dist', hint: '0 = keine' },
    { k: 'asi', label: 'Attributsboni (Regeln 2014)', type: 'abmap', show: (o, c) => has14(o, c.pack), hint: 'Bei Regeln 2024 kommen die Attributsboni vom Hintergrund.' },
    { k: 'asiChoice', label: 'Frei verteilbare Boni (Regeln 2014)', type: 'custom', show: (o, c) => has14(o, c.pack), render: (o, c, set) => html`<div class="row" style="gap:8px">
      <${NumIn} value=${o.asiChoice?.n} min=${0} max=${6} placeholder="Anzahl" onChange=${(n) => set(n ? { ...(o.asiChoice || { amount: 1 }), n } : undefined)} />
      <span class="small muted">Attribute um je</span>
      <${NumIn} value=${o.asiChoice?.amount} min=${1} max=${2} placeholder="1" onChange=${(a) => set(o.asiChoice ? { ...o.asiChoice, amount: a || 1 } : undefined)} />
    </div>` },
    { k: 'skills', label: 'Feste Fertigkeiten', type: 'skills' },
    { k: 'skillAny', label: 'Frei wählbare Fertigkeiten', type: 'number', min: 0, max: 4 },
    { k: 'resist', label: 'Resistenzen', type: 'damage', hint: 'Wirken im Kampf automatisch.' },
    { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0 },
    { k: 'luck', label: 'Glück', type: 'bool', toggle: 'Natürliche 1 bei W20-Würfen neu würfeln' },
    { k: 'originFeat', label: 'Herkunftstalent', type: 'bool', toggle: 'Erhält ein zusätzliches Herkunftstalent', show: (o, c) => has24(o, c.pack) },
    { k: 'feat', label: 'Talent auf Stufe 1', type: 'bool', toggle: 'Erhält auf Stufe 1 ein Talent', show: (o, c) => has14(o, c.pack) },
    { k: 'traits', label: 'Merkmale', type: 'pairs', wide: true, add: 'Merkmal hinzufügen' },
    { k: 'option', label: 'Auswahl (z. B. Abstammung, Erbe, Ahnen)', type: 'custom', wide: true, render: (o, c) => html`<div class="stack sm">
      <${TextIn} value=${o.option?.label} placeholder="Bezeichnung der Auswahl, z. B. „Abstammung“" onChange=${(v) => { o.option = { ...(o.option || { list: [] }), label: v }; if (!v && !o.option.list.length) delete o.option; c.touch(); }} />
      <${ObjList} value=${o.option?.list} ctx=${c} fields=${OPTION_FIELDS} addLabel="Möglichkeit hinzufügen" titleOf=${(x) => x.name}
        make=${() => ({ key: '', name: '' })} onChange=${(list) => { o.option = { label: o.option?.label || 'Auswahl', list }; if (!list.length && !o.option.label) delete o.option; c.touch(); }} />
    </div>` },
    { k: 'subs', label: 'Unterarten (Regeln 2014)', type: 'custom', wide: true, show: (o, c) => has14(o, c.pack), render: (o, c, set) => html`<${ObjList} value=${o.subs} ctx=${c} fields=${SUB_FIELDS}
      addLabel="Unterart hinzufügen" titleOf=${(x) => x.name} make=${() => ({ key: '', name: '', traits: [] })} onChange=${(list) => set(list.length ? list : undefined)} />` },
  ],
  subspecies: [
    { k: 'species', label: 'Gehört zur Spezies', type: 'select', options: (o, c) => [{ value: '', label: '– wählen –' }, ...c.speciesOpts] },
    edField, ...SUB_FIELDS,
  ],
  backgrounds: [
    nameField(), edField,
    { k: 'abilities', label: 'Attributswerte zur Auswahl (Regeln 2024)', type: 'abilities', max: 3, show: (o, c) => has24(o, c.pack), hint: 'Drei Attribute: +2/+1 oder dreimal +1.' },
    { k: 'feat', label: 'Herkunftstalent (Regeln 2024)', type: 'select', show: (o, c) => has24(o, c.pack), options: (o, c) => [{ value: '', label: '– keines –' }, ...c.featOpts('origin')] },
    { k: 'skills', label: 'Fertigkeiten', type: 'skills', max: 4 },
    { k: 'skillAny', label: 'Frei wählbare Fertigkeiten', type: 'number', min: 0, max: 4 },
    { k: 'tool', label: 'Werkzeug', placeholder: 'z. B. Diebeswerkzeug' },
    { k: 'languages', label: 'Zusätzliche Sprachen', type: 'number', min: 0, max: 4, show: (o, c) => has14(o, c.pack) },
    { k: 'feature', label: 'Hintergrundmerkmal (Regeln 2014)', show: (o, c) => has14(o, c.pack) },
    { k: 'desc', label: 'Beschreibung', type: 'textarea', wide: true },
    { k: 'equip', label: 'Ausrüstung', type: 'textarea', rows: 2, wide: true },
  ],
  feats: [
    nameField(), keyField, { k: 'cat', label: 'Art', type: 'select', options: FEAT_CATS }, edField,
    { k: 'desc', label: 'Regeltext', type: 'textarea', rows: 6, wide: true },
    { k: 'a24', label: 'Attribut +1 zur Wahl (Regeln 2024)', type: 'abilities', show: (o, c) => has24(o, c.pack) },
    { k: 'a14', label: 'Attribut +1 zur Wahl (Regeln 2014)', type: 'abilities', show: (o, c) => has14(o, c.pack) },
    { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0 },
    { k: 'grantSkills', label: 'Zusätzliche Fertigkeiten', type: 'number', min: 0, max: 6 },
    { k: 'prereq', label: 'Voraussetzung', placeholder: 'z. B. Stufe 4, Stärke 13' },
  ],
  subclasses: [
    { k: 'cls', label: 'Klasse', type: 'select', options: (o, c) => [{ value: '', label: '– wählen –' }, ...c.classOpts] },
    { k: 'name', label: 'Name' }, edField,
    { k: 'desc', label: 'Beschreibung', type: 'textarea', rows: 5, wide: true, hint: 'Erscheint bei der Auswahl im Assistenten.' },
    { k: 'caster', label: 'Zauberwirken', type: 'custom', render: (o, c) => html`<div class="stack sm">
      <${Toggle} checked=${o.caster === 'third'} label="Wirkt Zauber (Drittelzauberer wie ein arkaner Ritter)" onChange=${(v) => { if (v) { o.caster = 'third'; o.ability = o.ability || 'int'; o.list = o.list || 'magier'; } else { delete o.caster; delete o.ability; delete o.list; } c.touch(); }} />
      ${o.caster === 'third' ? html`<div class="row" style="gap:8px"><span class="small muted">Attribut</span><${Select} value=${o.ability || 'int'} options=${AB_OPTS} onChange=${(v) => { o.ability = v; c.touch(); }} />
        <span class="small muted">Zauberliste</span><${Select} value=${o.list || 'magier'} options=${c.classOpts} onChange=${(v) => { o.list = v; c.touch(); }} /></div>` : null}
    </div>` },
    { k: 'features', label: 'Merkmale je Stufe', type: 'custom', wide: true, render: (o, c) => html`<${SubFeatures} obj=${o} ctx=${c} />` },
  ],
  weapons: [
    nameField(), keyField, { k: 'cat', label: 'Kategorie', type: 'select', options: [{ value: 'simple', label: 'Einfache Waffe' }, { value: 'martial', label: 'Kriegswaffe' }] },
    { k: 'dmg', label: 'Schaden', placeholder: '1d8', mono: true }, { k: 'vers', label: 'Zweihändig (vielseitig)', placeholder: '1d10', mono: true },
    { k: 'type', label: 'Schadensart', type: 'select', options: WEAPON_TYPES },
    { k: 'p', label: 'Eigenschaften', type: 'custom', wide: true, render: (o, c) => html`<div class="rb-chips">${PROPS.map(([p, l]) => html`<button type="button" key=${p} class=${`rb-chip${(o.p || '').includes(p) ? ' on' : ''}`}
      onClick=${() => { o.p = (o.p || '').includes(p) ? o.p.replace(p, '') : `${o.p || ''}${p}`; c.touch(); }}>${l}</button>`)}</div>` },
    { k: 'm', label: 'Meisterschaft (Regeln 2024)', placeholder: 'z. B. Umstoßen' },
  ],
  armor: [
    nameField(), keyField, { k: 'type', label: 'Art', type: 'select', options: [{ value: 'light', label: 'Leichte Rüstung' }, { value: 'medium', label: 'Mittelschwere Rüstung' }, { value: 'heavy', label: 'Schwere Rüstung' }] },
    { k: 'ac', label: 'Rüstungsklasse', type: 'number', min: 10, max: 20 }, { k: 'str', label: 'Stärke-Voraussetzung', type: 'number', min: 0, max: 20 },
    { k: 'stealth', label: 'Heimlichkeit', type: 'bool', toggle: 'Nachteil auf Heimlichkeit' },
  ],
};

// Merkmale einer Unterklasse, geordnet nach Stufe
function SubFeatures({ obj, ctx }) {
  const flat = Object.entries(obj.features || {}).flatMap(([l, list]) => toArr(list).map((f) => ({ l: Number(l), f }))).sort((a, b) => a.l - b.l);
  const write = (items) => {
    const out = {};
    for (const { l, f } of items) (out[l] ||= []).push(f);
    obj.features = out;
    ctx.touch();
  };
  const cls = CG.findClass(obj.cls);
  const subLevels = cls ? Object.entries(cls.feat?.[edOf(obj, ctx.pack) || '2024'] || cls.feat?.[2014] || {}).filter(([, l]) => toArr(l).includes('@sub')).map(([l]) => Number(l)) : [];
  return html`<div class="stack sm">
    ${subLevels.length ? html`<div class="small muted">Die Klasse vergibt Unterklassen-Merkmale auf Stufe ${subLevels.join(', ')}.</div>` : null}
    ${flat.map((x, i) => html`<div class="rb-pair" key=${i}>
      <label class="rb-lvl"><span>Stufe</span><input class="input" type="number" min="1" max="20" value=${x.l} onInput=${(e) => { flat[i].l = Math.max(1, Math.min(20, Number(e.target.value) || 1)); write(flat); }} /></label>
      <div class="grow stack sm"><${TextIn} value=${x.f.name} placeholder="Name des Merkmals" onChange=${(v) => { x.f.name = v; write(flat); }} />
        <${Area} rows=${2} value=${x.f.desc} placeholder="Was das Merkmal bewirkt" onChange=${(v) => { x.f.desc = v; write(flat); }} /></div>
      <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => write(flat.filter((_, k) => k !== i))} />
    </div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => write([...flat, { l: subLevels.find((l) => !flat.some((y) => y.l === l)) || subLevels[0] || 3, f: { name: '', desc: '' } }])}>Merkmal hinzufügen<//>
  </div>`;
}

// ───────────────────────── Klassen ─────────────────────────
const FULL_CAST = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
const PRESET_PREP = [['Vollzauberer', [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]], ['Halbzauberer', [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]], ['Paktmagie', [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]]];
const PRESET_CANTRIPS = [['2 → 4', FULL_CAST], ['3 → 5', FULL_CAST.map((n) => n + 1)], ['4 → 6', FULL_CAST.map((n) => n + 2)], ['keine', Array(20).fill(0)]];
const perEd = (obj, k, ed) => {
  const v = obj[k];
  if (v && typeof v === 'object' && !Array.isArray(v) && ('2014' in v || '2024' in v)) return v[ed] ?? v[2014] ?? v[2024];
  return v;
};
function setPerEd(obj, k, ed, val) {
  const v = obj[k];
  const both = v && typeof v === 'object' && !Array.isArray(v) && ('2014' in v || '2024' in v) ? { ...v } : { 2014: v, 2024: v };
  both[ed] = val;
  obj[k] = both;
}

function ClassEditor({ obj, ctx }) {
  const packEd = ctx.pack.edition;
  const [ed, setEd] = useState(packEd === '2014' ? '2014' : '2024');
  const t = ctx.touch;
  const skills = obj.skills || { n: 2, list: [] };
  const skillList = perEd(skills, 'list', ed);
  const table = perEd(obj, 'feat', ed) || {};
  const cast = obj.cast && obj.cast.type && obj.cast.type !== 'none' ? obj.cast : null;
  const armor = Array.isArray(obj.armor) ? obj.armor : perEd(obj, 'armor', ed) || [];
  const weapons = perEd(obj, 'weapons', ed) || [];
  return html`<div class="stack">
    ${packEd === 'beide' ? html`<div class="row"><span class="small muted">Werte je Regelstand:</span><${Segmented} value=${ed} onChange=${setEd} options=${[{ value: '2024', label: 'Regeln 2024' }, { value: '2014', label: 'Regeln 2014' }]} /></div>` : null}
    <div class="rb-form">
      <${FieldView} f=${nameField()} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${keyField} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'desc', label: 'Kurzbeschreibung', placeholder: 'Erscheint bei der Klassenwahl' }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'hd', label: 'Trefferwürfel', type: 'select', num: true, options: [6, 8, 10, 12].map((n) => ({ value: n, label: `W${n}` })) }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'primary', label: 'Primärattribut', type: 'abilities', max: 2 }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'saves', label: 'Rettungswürfe', type: 'abilities', max: 2 }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'subLabel', label: 'Bezeichnung der Unterklasse', placeholder: 'z. B. Pfad, Schule, Eid' }} obj=${obj} ctx=${ctx} />
      <${Field} label="Unterklasse ab Stufe"><${NumIn} value=${perEd(obj, 'subLevel', ed)} min=${1} max=${20} onChange=${(n) => { setPerEd(obj, 'subLevel', ed, n || 3); t(); }} /><//>
      <${Field} label="Fertigkeiten" class="rb-wide" hint="Anzahl und Auswahl – ohne Auswahl sind alle Fertigkeiten erlaubt.">
        <div class="stack sm"><div class="row" style="gap:8px"><${NumIn} value=${skills.n} min=${0} max=${6} onChange=${(n) => { obj.skills = { ...skills, n: n || 0 }; t(); }} /><span class="small muted">aus</span></div>
          <${Chips} options=${SKILL_OPTS} value=${skillList === 'any' ? [] : skillList} onChange=${(v) => { const s = { ...skills }; setPerEd(s, 'list', ed, v.length ? v : 'any'); obj.skills = s; t(); }} /></div>
      <//>
      <${Field} label="Rüstung"><${Chips} options=${[{ value: 'light', label: 'leicht' }, { value: 'medium', label: 'mittelschwer' }, { value: 'heavy', label: 'schwer' }, { value: 'shield', label: 'Schilde' }]} value=${armor}
        onChange=${(v) => { if (Array.isArray(obj.armor) || !obj.armor) obj.armor = v; else setPerEd(obj, 'armor', ed, v); t(); }} /><//>
      <${Field} label="Waffen" hint="Kategorien und/oder einzelne Waffen"><div class="stack sm">
        <${Chips} options=${[{ value: 'simple', label: 'einfache' }, { value: 'martial', label: 'Kriegswaffen' }]} value=${weapons} onChange=${(v) => { setPerEd(obj, 'weapons', ed, [...v, ...weapons.filter((w) => !['simple', 'martial'].includes(w))]); t(); }} />
        <${Select} value="" options=${[{ value: '', label: '+ einzelne Waffe' }, ...CG.WEAPONS.map((w) => ({ value: w.key, label: w.name }))]} onChange=${(k) => { if (k && !weapons.includes(k)) { setPerEd(obj, 'weapons', ed, [...weapons, k]); t(); } }} />
        ${weapons.filter((w) => !['simple', 'martial'].includes(w)).length ? html`<div class="rb-chips">${weapons.filter((w) => !['simple', 'martial'].includes(w)).map((w) => html`<button type="button" class="rb-chip on" key=${w} title="Entfernen"
          onClick=${() => { setPerEd(obj, 'weapons', ed, weapons.filter((x) => x !== w)); t(); }}>${CG.findWeapon?.(w)?.name || w} ×</button>`)}</div>` : null}
      </div><//>
      <${FieldView} f=${{ k: 'tools', label: 'Werkzeuge' }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'unarmored', label: 'Ungerüstete Verteidigung', type: 'select', options: [{ value: '', label: 'keine' }, { value: 'con', label: '10 + GES + KON' }, { value: 'wis', label: '10 + GES + WEI' }] }} obj=${obj} ctx=${ctx} />
      <${FieldView} f=${{ k: 'style', label: 'Kampfstil ab Stufe', type: 'number', min: 0, max: 20, hint: 'Leer = kein Kampfstil' }} obj=${obj} ctx=${ctx} />
      <${Field} label="Mehrklassen: Voraussetzung"><${Chips} options=${AB_OPTS} value=${obj.mc?.req?.[0] || []} onChange=${(v) => { obj.mc = { ...(obj.mc || { gain: '' }), req: v.length ? [v] : [] }; t(); }} /><//>
      <${Field} label="Mehrklassen: erhält"><${TextIn} value=${obj.mc?.gain} placeholder="z. B. leichte Rüstung, einfache Waffen" onChange=${(v) => { obj.mc = { ...(obj.mc || { req: [] }), gain: v }; t(); }} /><//>
      <${Field} label="Startausrüstung" class="rb-wide"><${Area} rows=${2} value=${perEd(obj, 'equip', ed)} onChange=${(v) => { setPerEd(obj, 'equip', ed, v); t(); }} /><//>
      <${Field} label="Startgold"><${TextIn} value=${perEd(obj, 'gold', ed)} placeholder="z. B. 100 oder 5d4×10" onChange=${(v) => { setPerEd(obj, 'gold', ed, /^\d+$/.test(v) ? Number(v) : v); t(); }} /><//>
    </div>
    <div class="rb-section"><h4><${Icon} name="sparkles" size=${15} />Zauberwirken</h4>
      <div class="row" style="gap:8px">
        <${Select} value=${cast?.type || 'none'} options=${[{ value: 'none', label: 'Wirkt keine Zauber' }, { value: 'full', label: 'Vollzauberer' }, { value: 'half', label: 'Halbzauberer' }, { value: 'third', label: 'Drittelzauberer' }, { value: 'pact', label: 'Paktmagie' }]}
          onChange=${(v) => { if (v === 'none') delete obj.cast; else obj.cast = { mode: 'prepare', ability: 'int', cantrips: [...FULL_CAST], prep: [...PRESET_PREP[v === 'full' ? 0 : v === 'pact' ? 2 : 1][1]], ...(cast || {}), type: v }; t(); }} />
        ${cast ? html`<span class="small muted">Attribut</span><${Select} value=${cast.ability} options=${AB_OPTS} onChange=${(v) => { cast.ability = v; t(); }} />
          <${Select} value=${cast.mode || 'prepare'} options=${[{ value: 'prepare', label: 'bereitet vor' }, { value: 'known', label: 'kennt feste Zauber' }, { value: 'book', label: 'Zauberbuch' }]} onChange=${(v) => { cast.mode = v; t(); }} />` : null}
      </div>
      ${cast ? html`<${Field} label="Zaubertricks je Stufe"><${LevelRow} value=${cast.cantrips} presets=${PRESET_CANTRIPS} onChange=${(v) => { cast.cantrips = v; t(); }} /><//>
        <${Field} label=${cast.mode === 'known' ? 'Bekannte Zauber je Stufe' : 'Vorbereitete Zauber je Stufe'} hint="Die Zauberplätze ergeben sich aus der Art (voll, halb, Drittel, Pakt).">
          <${LevelRow} value=${cast.prep ?? cast.prep24 ?? cast.known14} presets=${PRESET_PREP} onChange=${(v) => { cast.prep = v; delete cast.prep24; delete cast.known14; delete cast.prep14; t(); }} /><//>
        <div class="small muted">Welche Zauber die Klasse nutzen darf, legst du bei den Zaubern fest (Feld „Klassen“) – eigene Klassen stehen dort zur Auswahl.</div>` : null}
    </div>
    <div class="rb-section"><h4><${Icon} name="list-ordered" size=${15} />Merkmale je Stufe</h4>
      <${ClassTable} obj=${obj} ed=${ed} ctx=${ctx} table=${table} />
    </div>
  </div>`;
}

// Tabelle der Klassenmerkmale: je Stufe Merkmale (Name + Text), dazu Attributswerterhöhung, Unterklasse, Epische Gabe
function ClassTable({ obj, ed, ctx, table }) {
  const [editing, setEditing] = useState(null); // Name des Merkmals, dessen Text offen ist
  const rows = Array.from({ length: 20 }, (_, i) => toArr(table[i + 1]));
  const write = (lvl, list) => {
    const t = { ...table, [lvl]: list };
    setPerEd(obj, 'feat', ed, t);
    ctx.touch();
  };
  const special = [['@asi', 'Attributswerterhöhung'], ['@sub', 'Unterklasse'], ['@boon', 'Epische Gabe']];
  const featDesc = (n) => ctx.pack.features?.[n] ?? CG.FEATURE_INFO[n] ?? '';
  return html`<div class="rb-ctable">
    ${rows.map((list, i) => {
      const lvl = i + 1;
      const named = list.filter((x) => !x.startsWith('@'));
      return html`<div class="rb-crow" key=${lvl}>
        <b class="rb-clvl">${lvl}</b>
        <div class="grow stack sm">
          <div class="rb-chips">
            ${special.map(([k, l]) => html`<button type="button" key=${k} class=${`rb-chip small${list.includes(k) ? ' on' : ''}`} onClick=${() => write(lvl, list.includes(k) ? list.filter((x) => x !== k) : [...list, k])}>${l}</button>`)}
            ${named.map((n) => html`<span class=${`rb-feat${editing === n ? ' on' : ''}`} key=${n}>
              <button type="button" title="Text bearbeiten" onClick=${() => setEditing(editing === n ? null : n)}>${n}${featDesc(n) ? '' : ' ·'}</button>
              <button type="button" class="x" title="Entfernen" onClick=${() => write(lvl, list.filter((x) => x !== n))}>×</button></span>`)}
            <input class="input rb-addfeat" placeholder="+ Merkmal" onKeyDown=${(e) => {
              if (e.key !== 'Enter') return;
              const v = e.target.value.trim();
              if (!v) return;
              e.preventDefault();
              if (!list.includes(v)) write(lvl, [...list, v]);
              e.target.value = '';
              if (!featDesc(v)) setEditing(v);
            }} />
          </div>
          ${named.includes(editing) ? html`<div class="rb-featdesc"><b>${editing}</b><${Area} rows=${3} value=${featDesc(editing)} placeholder="Was das Merkmal bewirkt (erscheint im Bogen und beim Stufenaufstieg)"
            onChange=${(v) => { ctx.pack.features = { ...(ctx.pack.features || {}), [editing]: v }; ctx.touch(); }} /></div>` : null}
        </div>
      </div>`;
    })}
    <div class="small muted">Eingabetaste fügt ein Merkmal hinzu; ein Klick auf den Namen öffnet seinen Text. „·“ = noch ohne Text.</div>
  </div>`;
}

// ───────────────────────── Zauber ─────────────────────────
function SpellEditor({ obj, ctx }) {
  const t = ctx.touch;
  const set = (k, v) => { if (v === undefined || v === '' || v === false) delete obj[k]; else obj[k] = v; t(); };
  const dmg = obj.damage || null;
  const baseDice = dmg ? (dmg.slots ? dmg.slots[obj.level] || Object.values(dmg.slots)[0] : dmg.char ? dmg.char[1] || Object.values(dmg.char)[0] : '') : '';
  const setDamage = (dice, type = dmg?.type || 'fire') => {
    if (!dice) { delete obj.damage; t(); return; }
    obj.damage = obj.level ? { type, slots: { [obj.level]: dice } } : { type, char: { 1: dice, 5: scale(dice, 2), 11: scale(dice, 3), 17: scale(dice, 4) } };
    t();
  };
  return html`<div class="rb-form">
    <${FieldView} f=${nameField(null, 'id')} obj=${obj} ctx=${ctx} />
    <${Field} label="Grad"><${Select} value=${obj.level ?? 1} options=${Array.from({ length: 10 }, (_, i) => ({ value: i, label: i ? `${i}. Grad` : 'Zaubertrick' }))} onChange=${(v) => { obj.level = Number(v); if (dmg) setDamage(baseDice, dmg.type); else t(); }} /><//>
    <${Field} label="Schule"><${Select} value=${obj.school || 'evocation'} options=${Object.entries(SCHOOL_ART).map(([k, v]) => ({ value: k, label: v.name }))} onChange=${(v) => set('school', v)} /><//>
    <${FieldView} f=${edField} obj=${obj} ctx=${ctx} />
    <${Field} label="Klassen" class="rb-wide"><${Chips} options=${ctx.classOpts} value=${obj.classes} onChange=${(v) => { obj.classes = v; t(); }} /><//>
    <${Field} label="Zeitaufwand"><div class="row" style="gap:6px"><${Select} value=${obj.action || 'action'} options=${[{ value: 'action', label: 'Aktion' }, { value: 'bonus', label: 'Bonusaktion' }, { value: 'reaction', label: 'Reaktion' }, { value: 'long', label: 'länger' }]}
      onChange=${(v) => { obj.action = v; obj.time = { action: 'Aktion', bonus: 'Bonusaktion', reaction: 'Reaktion' }[v] || obj.time || '1 Minute'; t(); }} />${obj.action === 'long' ? html`<${TextIn} value=${obj.time} placeholder="z. B. 10 Minuten" onChange=${(v) => set('time', v)} />` : null}</div><//>
    <${Field} label="Reichweite"><div class="row" style="gap:6px"><${Select} value=${obj.rangeKind || 'dist'} options=${[{ value: 'dist', label: 'Entfernung' }, { value: 'self', label: 'Selbst' }, { value: 'touch', label: 'Berührung' }, { value: 'sight', label: 'Sicht' }, { value: 'unl', label: 'unbegrenzt' }]}
      onChange=${(v) => { obj.rangeKind = v; delete obj.range; t(); }} />${(obj.rangeKind || 'dist') === 'dist' ? html`<div class="rb-unit"><${NumIn} value=${obj.rangeM} min=${0} step=${1.5} onChange=${(v) => { obj.rangeM = v; delete obj.range; t(); }} /><span>m</span></div>` : null}</div><//>
    <${Field} label="Komponenten"><${TextIn} value=${obj.comps} placeholder="V, G, M" onChange=${(v) => set('comps', v)} /><//>
    <${Field} label="Material"><${TextIn} value=${obj.material} onChange=${(v) => set('material', v)} /><//>
    <${Field} label="Wirkungsdauer"><${TextIn} value=${obj.duration} placeholder="Unmittelbar" onChange=${(v) => set('duration', v)} /><//>
    <${Field} label="Eigenschaften"><div class="row"><${Check} checked=${obj.conc} label="Konzentration" onChange=${(v) => set('conc', v)} /><${Check} checked=${obj.ritual} label="Ritual" onChange=${(v) => set('ritual', v)} /></div><//>
    <${Field} label="Beschreibung" class="rb-wide" hint="Leerzeile = neuer Absatz"><${Area} rows=${5} value=${toArr(obj.desc).join('\n\n')} onChange=${(v) => { obj.desc = v.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean); t(); }} /><//>
    <${Field} label="Auf höheren Graden" class="rb-wide"><${Area} rows=${2} value=${toArr(obj.higher).join('\n\n')} onChange=${(v) => { if (v.trim()) obj.higher = [v.trim()]; else delete obj.higher; t(); }} /><//>
    <div class="rb-section rb-wide"><h4><${Icon} name="swords" size=${15} />Wirkung im Kampf (optional)</h4>
      <div class="rb-form">
        <${Field} label="Art"><${Select} value=${obj.attack ? 'attack' : obj.save ? 'save' : obj.heal ? 'heal' : 'none'} options=${[{ value: 'none', label: 'nur Text' }, { value: 'attack', label: 'Zauberangriff' }, { value: 'save', label: 'Rettungswurf' }, { value: 'heal', label: 'Heilung' }]}
          onChange=${(v) => { delete obj.attack; delete obj.save; delete obj.heal; if (v === 'attack') obj.attack = 'ranged'; if (v === 'save') obj.save = 'dex'; if (v === 'heal') { obj.heal = { dice: '1d8', mod: true }; delete obj.damage; } t(); }} /><//>
        ${obj.attack ? html`<${Field} label="Angriff"><${Select} value=${obj.attack} options=${[{ value: 'ranged', label: 'Fernkampf' }, { value: 'melee', label: 'Nahkampf' }]} onChange=${(v) => set('attack', v)} /><//>` : null}
        ${obj.save ? html`<${Field} label="Rettungswurf"><${Select} value=${obj.save} options=${AB_OPTS} onChange=${(v) => set('save', v)} /><//>` : null}
        ${obj.attack || obj.save ? html`<${Field} label=${obj.level ? `Schaden auf dem ${obj.level}. Grad` : 'Schaden (steigt auf 5/11/17)'}><div class="row" style="gap:6px"><${TextIn} mono value=${baseDice} placeholder="z. B. 3d6" onChange=${(v) => setDamage(v)} />
          <${Select} value=${dmg?.type || 'fire'} options=${DMG} onChange=${(v) => setDamage(baseDice || '1d6', v)} /></div><//>` : null}
        ${obj.heal ? html`<${Field} label="Heilung"><div class="row" style="gap:6px"><${TextIn} mono value=${obj.heal.dice} onChange=${(v) => { obj.heal = { ...obj.heal, dice: v }; t(); }} /><${Check} checked=${obj.heal.mod} label="+ Attributsmodifikator" onChange=${(v) => { obj.heal = { ...obj.heal, mod: v }; t(); }} /></div><//>` : null}
        ${obj.save ? html`<${Field} label="Fläche"><div class="row" style="gap:6px"><${Select} value=${obj.area?.shape || ''} options=${[{ value: '', label: 'ein Ziel' }, { value: 'sphere', label: 'Kugel' }, { value: 'cone', label: 'Kegel' }, { value: 'cube', label: 'Würfel' }, { value: 'line', label: 'Linie' }, { value: 'emanation', label: 'Ausströmung' }]}
          onChange=${(v) => { if (v) obj.area = { shape: v, size: obj.area?.size || 6 }; else delete obj.area; t(); }} />${obj.area ? html`<div class="rb-unit"><${NumIn} value=${obj.area.size} min=${1.5} step=${1.5} onChange=${(v) => { obj.area = { ...obj.area, size: v || 1.5 }; t(); }} /><span>m</span></div>` : null}</div><//>` : null}
      </div>
      <div class="small muted">Damit würfelt die Kampfleiste Angriff, Rettungswurf, Schaden oder Heilung automatisch. Besondere Effekte handelt die Spielleitung von Hand ab.</div>
    </div>
  </div>`;
}
function scale(dice, k) {
  const m = /^(\d+)d(\d+)(.*)$/i.exec(String(dice).trim());
  return m ? `${Number(m[1]) * k}d${m[2]}${m[3] || ''}` : dice;
}

// ───────────────────────── Vorschau ─────────────────────────
function Preview({ cat, e, pack }) {
  if (!e) return null;
  const ed = edOf(e, pack);
  const chips = [];
  let body = '';
  let extra = null;
  if (cat === 'species' || cat === 'subspecies') {
    if (e.size) chips.push(e.size);
    if (e.speed != null) chips.push(`Bewegung ${fmtM(e.speed)}`);
    if (e.dark) chips.push(`Dunkelsicht ${fmtM(e.dark)}`);
    if (e.asi) chips.push(Object.entries(e.asi).map(([k, v]) => `${AB_SHORT[k]} ${v > 0 ? '+' : ''}${v}`).join(', '));
    if (e.resist?.length) chips.push(`Resistenz: ${e.resist.map((k) => DAMAGE_ART[k]?.name || k).join(', ')}`);
    extra = html`${toArr(e.traits).map(([n, d], i) => html`<p key=${i}><b>${n}.</b> ${d}</p>`)}
      ${e.option?.list?.length ? html`<p><b>${e.option.label}:</b> ${e.option.list.map((o) => o.name).join(', ')}</p>` : null}
      ${e.subs?.length ? html`<p><b>Unterarten:</b> ${e.subs.map((o) => o.name).join(', ')}</p>` : null}`;
  } else if (cat === 'backgrounds') {
    if (e.abilities?.length) chips.push(e.abilities.map((k) => AB_SHORT[k]).join(' · '));
    if (e.feat) chips.push(`Talent: ${CG.findFeat(e.feat)?.name || e.feat}`);
    if (e.skills?.length) chips.push(e.skills.map(CG.skillName).join(', '));
    if (e.tool) chips.push(e.tool);
    body = [e.desc, e.feature ? `Merkmal: ${e.feature}` : '', e.equip ? `Ausrüstung: ${e.equip}` : ''].filter(Boolean).join('\n\n');
  } else if (cat === 'feats') {
    chips.push(CAT_LABEL[e.cat] || 'Talent');
    if (e.prereq) chips.push(`Voraussetzung: ${e.prereq}`);
    body = e.desc || '';
  } else if (cat === 'subclasses') {
    chips.push(CG.findClass(e.cls)?.name || e.cls || 'Klasse?');
    body = e.desc || '';
    extra = Object.entries(e.features || {}).sort((a, b) => a[0] - b[0]).flatMap(([l, list]) => toArr(list).map((f, i) => html`<p key=${`${l}-${i}`}><b>Stufe ${l} – ${f.name}.</b> ${f.desc}</p>`));
  } else if (cat === 'classes') {
    chips.push(`W${e.hd || 8}`, `Rettungswürfe: ${toArr(e.saves).map((k) => AB_SHORT[k]).join(', ') || '–'}`);
    if (e.cast?.type && e.cast.type !== 'none') chips.push(`Zauber: ${AB_SHORT[e.cast.ability] || ''}`);
    body = e.desc || '';
    const tb = perEd(e, 'feat', ed || '2024') || {};
    extra = html`<div class="rb-prev-table">${Array.from({ length: 20 }, (_, i) => toArr(tb[i + 1])).map((l, i) => (l.length ? html`<div key=${i}><b>${i + 1}</b><span>${l.map((x) => ({ '@asi': 'Attributswerterhöhung', '@sub': e.subLabel || 'Unterklasse', '@boon': 'Epische Gabe' }[x] || x)).join(', ')}</span></div>` : null))}</div>`;
  } else if (cat === 'spells') {
    chips.push(e.level ? `${e.level}. Grad` : 'Zaubertrick', SCHOOL_ART[e.school]?.name || e.school);
    if (e.conc) chips.push('Konzentration');
    body = toArr(e.desc).join('\n\n');
  } else if (cat === 'weapons') {
    chips.push(e.cat === 'martial' ? 'Kriegswaffe' : 'Einfache Waffe', `${e.dmg || '?'} ${e.type || ''}`);
    body = [...(e.p || '')].map((p) => CG.PROP_NAMES[p]).filter(Boolean).join(', ');
  } else if (cat === 'armor') {
    chips.push(CG.ARMOR_TYPE[e.type] || e.type, `RK ${e.ac}`);
    if (e.stealth) chips.push('Nachteil auf Heimlichkeit');
  }
  return html`<div class="rb-preview">
    <div class="rb-prev-h"><b>${e.name || '(ohne Namen)'}</b>${ed ? html`<span class="badge">Regeln ${ed}</span>` : null}</div>
    ${chips.length ? html`<div class="rb-prev-chips">${chips.map((c, i) => html`<span key=${i}>${c}</span>`)}</div>` : null}
    ${body ? html`<div class="rb-prev-body">${body.split(/\n{2,}/).map((p, i) => html`<p key=${i}>${p}</p>`)}</div>` : null}
    ${extra}
  </div>`;
}

// ───────────────────────── Kategorie-Editor ─────────────────────────
const newEntry = (cat, pack, ctx) => {
  const ed = pack.edition === 'beide' ? undefined : pack.edition;
  switch (cat) {
    case 'species': return { key: '', name: '', size: 'Mittelgroß', speed: 30, dark: 0, traits: [] };
    case 'subspecies': return { species: ctx.speciesOpts[0]?.value || '', key: '', name: '', traits: [] };
    case 'backgrounds': return ed === '2014' ? { key: '', name: '', skills: [], equip: '' } : { key: '', name: '', abilities: [], skills: [], equip: '' };
    case 'feats': return { key: '', name: '', cat: 'general', desc: '' };
    case 'classes': return { key: '', name: '', hd: 8, primary: [], saves: [], subLabel: 'Unterklasse', subLevel: { 2014: 3, 2024: 3 }, skills: { n: 2, list: 'any' }, armor: [], weapons: { 2014: ['simple'], 2024: ['simple'] }, tools: '', mc: { req: [], gain: '' }, equip: { 2014: '', 2024: '' }, gold: { 2014: 0, 2024: 0 }, subclasses: { 2014: [], 2024: [] }, feat: { 2014: { 4: ['@asi'], 8: ['@asi'], 12: ['@asi'], 16: ['@asi'], 19: ['@asi'] }, 2024: { 3: ['@sub'], 4: ['@asi'], 8: ['@asi'], 12: ['@asi'], 16: ['@asi'], 19: ['@boon'] } } };
    case 'subclasses': return { cls: ctx.classOpts[0]?.value || '', name: '', desc: '', features: {} };
    case 'spells': return { id: '', name: '', level: 1, school: 'evocation', classes: [], action: 'action', time: 'Aktion', rangeKind: 'dist', rangeM: 18, comps: 'V, G', duration: 'Unmittelbar', desc: [] };
    case 'weapons': return { key: '', name: '', cat: 'simple', dmg: '1d6', type: 'Hieb', p: '' };
    case 'armor': return { key: '', name: '', type: 'light', ac: 11 };
    default: return {};
  }
};
const entryKey = (cat, e) => (cat === 'subclasses' ? `${e.cls}|${e.name}` : cat === 'spells' ? e.id || slugify(e.name || '') : cat === 'subspecies' ? `${e.species}|${e.key || slugify(e.name || '')}` : e.key || slugify(e.name || ''));
const entryMeta = (cat, e) => ({
  species: () => [e.size, e.speed != null ? fmtM(e.speed) : ''].filter(Boolean).join(' · '),
  subspecies: () => `zu ${e.species || '?'}`,
  backgrounds: () => (e.skills || []).map(CG.skillName).join(', '),
  feats: () => CAT_LABEL[e.cat] || '',
  classes: () => `W${e.hd || 8}`,
  subclasses: () => CG.findClass(e.cls)?.name || e.cls || '',
  spells: () => (e.level ? `${e.level}. Grad` : 'Zaubertrick'),
  weapons: () => `${e.dmg || ''} ${e.type || ''}`,
  armor: () => `RK ${e.ac ?? '?'}`,
}[cat]?.() || '');

function CategoryEditor({ cat, pack, ctx, touch }) {
  const list = (pack.content[cat] ||= []);
  const [sel, setSel] = useState(list.length ? 0 : -1);
  const [q, setQ] = useState('');
  const edBase = pack.edition === '2014' ? '2014' : '2024';
  const baseKeys = useMemo(() => new Set(baseEntries(cat, edBase).map((e) => entryKey(cat, e))), [cat, edBase]);
  const e = list[sel] || null;
  const ql = q.trim().toLowerCase();
  const shown = list.map((x, i) => ({ x, i })).filter(({ x }) => !ql || `${x.name} ${entryMeta(cat, x)}`.toLowerCase().includes(ql));
  const add = (obj) => { list.push(obj); setSel(list.length - 1); touch(); };
  const fromBase = () => openModal(({ close }) => html`<${BasePicker} cat=${cat} ed=${edBase} close=${close}
    onPick=${(obj, mode) => { const o = plain(obj); if (mode === 'copy') { o.name = `${o.name} (eigene Fassung)`; if (cat === 'spells') o.id = ''; else if (cat !== 'subclasses') o.key = ''; } add(o); close(); }} />`, { title: `${catOf(cat).label} aus dem Grundbestand`, icon: 'book', size: 'lg' });
  const fields = FIELDS[cat];
  return html`<div class="rb-cat">
    <div class="rb-cat-list">
      <div class="row nowrap" style="gap:6px"><input class="input grow" placeholder=${`${catOf(cat).label} durchsuchen`} value=${q} onInput=${(ev) => setQ(ev.target.value)} /></div>
      <div class="row" style="gap:6px">
        <${Btn} size="sm" kind="primary" icon="plus" onClick=${() => add(newEntry(cat, pack, ctx))}>Neu<//>
        <${Btn} size="sm" icon="copy" onClick=${fromBase}>Aus Grundbestand<//>
      </div>
      <div class="rb-items">
        ${shown.length ? shown.map(({ x, i }) => html`<button type="button" key=${i} class=${`rb-item${i === sel ? ' on' : ''}`} onClick=${() => setSel(i)}>
          <b>${x.name || '(ohne Namen)'}</b><span class="small muted">${entryMeta(cat, x)}</span>
          ${baseKeys.has(entryKey(cat, x)) ? html`<span class="badge warn" title="Gleiche Kennung wie ein Eintrag des Grundbestands – ersetzt ihn">ersetzt</span>` : null}
        </button>`) : html`<div class="small faint" style="padding:8px">${list.length ? 'Nichts gefunden.' : `Noch keine ${catOf(cat).label}. Lege einen neuen Eintrag an oder kopiere einen aus dem Grundbestand als Vorlage.`}</div>`}
      </div>
    </div>
    <div class="rb-cat-edit">
      ${e ? html`<div class="rb-edit-head">
          <h3 class="grow">${e.name || `Neuer Eintrag (${catOf(cat).one})`}</h3>
          <${IconBtn} icon="copy" title="Duplizieren" onClick=${() => { const o = plain(e); o.name = `${o.name} (Kopie)`; if (cat === 'spells') o.id = ''; else o.key = ''; add(o); }} />
          <${IconBtn} icon="trash" title="Eintrag löschen" onClick=${async () => { if (await confirmDialog(`„${e.name || 'Eintrag'}“ aus dem Paket löschen?`, { danger: true, ok: 'Löschen' })) { list.splice(sel, 1); setSel(Math.min(sel, list.length - 1)); touch(); } }} />
        </div>
        <div class="rb-edit-grid">
          <div>${cat === 'classes' ? html`<${ClassEditor} obj=${e} ctx=${ctx} />` : cat === 'spells' ? html`<${SpellEditor} obj=${e} ctx=${ctx} />` : html`<${Form} fields=${fields} obj=${e} ctx=${ctx} />`}</div>
          <div class="rb-prev-col"><div class="small muted" style="margin-bottom:6px">Vorschau</div><${Preview} cat=${cat} e=${e} pack=${pack} /></div>
        </div>` : html`<${Empty} icon="edit-square" title=${catOf(cat).label}>Wähle links einen Eintrag oder lege einen neuen an.<//>`}
    </div>
  </div>`;
}

function BasePicker({ cat, ed, onPick, close }) {
  const [q, setQ] = useState('');
  const list = baseEntries(cat, ed);
  const ql = q.trim().toLowerCase();
  const shown = list.filter((x) => !ql || `${x.name} ${entryMeta(cat, x)}`.toLowerCase().includes(ql));
  return html`<div class="modal-body stack">
    <div class="small muted">„Ersetzen“ übernimmt den Eintrag mit gleicher Kennung – deine Fassung gilt dann statt des Grundbestands. „Als Vorlage“ legt einen neuen, eigenständigen Eintrag an.</div>
    <input class="input" placeholder="Suchen" value=${q} onInput=${(e) => setQ(e.target.value)} autoFocus />
    <div class="rb-baselist">${shown.map((x, i) => html`<div class="rb-baserow" key=${i}><div class="grow"><b>${x.name}</b> <span class="small muted">${entryMeta(cat, x)}</span></div>
      <${Btn} size="sm" onClick=${() => onPick(x, 'override')}>Ersetzen<//><${Btn} size="sm" kind="ghost" onClick=${() => onPick(x, 'copy')}>Als Vorlage<//></div>`)}
      ${shown.length ? null : html`<div class="small faint">Nichts gefunden.</div>`}</div>
    <div class="modal-foot"><${Btn} onClick=${() => close()}>Schließen<//></div>
  </div>`;
}

// ───────────────────────── Grundregeln & Ausblenden ─────────────────────────
function RulesTab({ pack, touch }) {
  const base = CG.baseRules();
  const r = (pack.rules ||= {});
  const set = (k, v) => { if (v === undefined) delete r[k]; else r[k] = v; touch(); };
  const cost = r.pointCost || base.pointCost;
  const arr = r.standardArray || base.standardArray;
  return html`<div class="stack lg rb-rules">
    <div class="small muted">Leer gelassene Werte bleiben beim Grundbestand. Die Grundregeln gelten für alle neuen Charaktere der Kampagne.</div>
    <div class="rb-form">
      <${Field} label="Punkte beim Punktekauf" hint=${`Grundbestand: ${base.pointBudget}`}><${NumIn} value=${r.pointBudget} placeholder=${base.pointBudget} min=${0} max=${60} onChange=${(v) => set('pointBudget', v)} /><//>
      <${Field} label="Höchster Attributswert bei der Erschaffung" hint=${`Grundbestand: ${base.abilityMax}`}><${NumIn} value=${r.abilityMax} placeholder=${base.abilityMax} min=${10} max=${30} onChange=${(v) => set('abilityMax', v)} /><//>
    </div>
    <${Field} label="Standardwerte (sechs Werte zum Verteilen)"><div class="rb-abmap">${arr.map((n, i) => html`<label key=${i}><span>${i + 1}.</span><input class="input" type="number" value=${n}
      onInput=${(e) => { const a = [...arr]; a[i] = Number(e.target.value) || 0; set('standardArray', a); }} /></label>`)}</div><//>
    <${Field} label="Kosten beim Punktekauf (Wert → Punkte)"><div class="rb-abmap">${Object.entries(cost).map(([k, v]) => html`<label key=${k}><span>${k}</span><input class="input" type="number" value=${v}
      onInput=${(e) => set('pointCost', { ...cost, [k]: Number(e.target.value) || 0 })} /></label>`)}</div>
      <div class="row" style="gap:6px;margin-top:6px">
        <${Btn} size="sm" kind="ghost" icon="plus" onClick=${() => { const ks = Object.keys(cost).map(Number); const hi = Math.max(...ks); set('pointCost', { ...cost, [hi + 1]: (cost[hi] || 0) + 2 }); }}>Höheren Wert erlauben<//>
        <${Btn} size="sm" kind="ghost" onClick=${() => { const ks = Object.keys(cost).map(Number); if (ks.length <= 2) return; const c = { ...cost }; delete c[Math.max(...ks)]; set('pointCost', c); }}>Höchsten Wert entfernen<//>
      </div><//>
    <${Btn} size="sm" icon="refresh" onClick=${() => { pack.rules = {}; touch(); }}>Auf Grundbestand zurücksetzen<//>
  </div>`;
}

function RemoveTab({ pack, touch }) {
  const ed = pack.edition === '2014' ? '2014' : '2024';
  const rm = (pack.remove ||= {});
  const spells = useSpells(ed);
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const groups = [
    ['species', 'Spezies', baseEntries('species', ed).map((e) => [e.key, e.name])],
    ['backgrounds', 'Hintergründe', baseEntries('backgrounds', ed).map((e) => [e.key, e.name])],
    ['feats', 'Talente', baseEntries('feats', ed).map((e) => [e.key, e.name])],
    ['classes', 'Klassen', baseEntries('classes', ed).map((e) => [e.key, e.name])],
    ['subclasses', 'Unterklassen', baseEntries('subclasses', ed).map((e) => [`${e.cls}|${e.name}`, `${CG.findClass(e.cls)?.name}: ${e.name}`])],
    ['spells', 'Zauber', (spells || []).map((s) => [s.id, s.name])],
  ];
  const toggle = (k, id, v) => { const s = new Set(toArr(rm[k])); if (v) s.add(id); else s.delete(id); rm[k] = [...s]; if (!rm[k].length) delete rm[k]; touch(); };
  return html`<div class="stack">
    <div class="small muted">Angehakte Einträge verschwinden in Kampagnen mit diesem Paket – z. B. wenn es in deiner Welt keine Elfen gibt. Bestehende Charaktere behalten ihre Werte.</div>
    <input class="input" placeholder="Filtern" value=${q} onInput=${(e) => setQ(e.target.value)} />
    ${groups.map(([k, label, items]) => {
      const shown = items.filter(([, n]) => !ql || String(n).toLowerCase().includes(ql));
      if (!shown.length) return null;
      const n = toArr(rm[k]).length;
      return html`<details class="rb-remove" key=${k} open=${!!n || !!ql}><summary><b>${label}</b> <span class="small muted">${n ? `${n} ausgeblendet` : ''}</span></summary>
        <div class="rb-remove-grid">${shown.map(([id, name]) => html`<${Check} key=${id} checked=${toArr(rm[k]).includes(id)} label=${name} onChange=${(v) => toggle(k, id, v)} />`)}</div></details>`;
    })}
  </div>`;
}

// ───────────────────────── Überblick ─────────────────────────
function Overview({ pack, touch, setTab, errors }) {
  const chk = checkPack(pack);
  return html`<div class="stack lg">
    <div class="rb-form">
      <${Field} label="Autor"><${TextIn} value=${pack.author} placeholder="Dein Name oder Kürzel" onChange=${(v) => { pack.author = v; touch(); }} /><//>
      <${Field} label="Regelstand"><${Segmented} value=${pack.edition} options=${EDITIONS} onChange=${(v) => { pack.edition = v; touch(); }} /><//>
      <${Field} label="Beschreibung" class="rb-wide"><${Area} rows=${3} value=${pack.description} placeholder="Wofür ist dieses Paket gedacht?" onChange=${(v) => { pack.description = v; touch(); }} /><//>
    </div>
    <div class="rb-counts">${[...CATEGORIES.map((c) => [c.key, c.label, chk.counts[c.key] || 0]), ['rules', 'Grundregeln', Object.keys(pack.rules || {}).length], ['remove', 'Ausgeblendet', Object.values(pack.remove || {}).reduce((t, l) => t + toArr(l).length, 0)]]
      .map(([k, l, n]) => html`<button type="button" key=${k} class="rb-count" onClick=${() => setTab(k)}><b>${n}</b><span>${l}</span></button>`)}</div>
    ${chk.errors.length || chk.warnings.length || errors.length ? html`<div class="card stack sm">
      ${[...chk.errors, ...errors].map((x, i) => html`<div key=${`e${i}`} class="small danger-text">✖ ${x}</div>`)}
      ${chk.warnings.map((x, i) => html`<div key=${`w${i}`} class="small rb-warn">⚠ ${x}</div>`)}
    </div>` : html`<div class="small success-text">✔ Keine Probleme gefunden.</div>`}
    <div class="callout callout-blue"><div class="callout-title"><${Icon} name="info" size=${16} />So wirken Regelpakete</div><div class="callout-content small" style="line-height:1.6">
      Die App bringt nur den frei lizenzierten Grundbestand mit (SRD 5.1 für Regeln 2014, SRD 5.2.1 für Regeln 2024). Ein Paket legt sich darüber: neue Einträge kommen dazu, Einträge mit gleicher Kennung ersetzen den Grundbestand, ausgeblendete verschwinden. Aktive Pakete gelten nur in dieser Kampagne – für dich und deine Mitspieler; spätere Pakete in der Liste überschreiben frühere.<br />
      Über „Exportieren“ teilst du ein Paket als Datei mit anderen Spielleitungen. Für Inhalte, die du selbst einträgst oder importierst, bist du verantwortlich – übernimm nur, was du selbst geschrieben hast oder nutzen darfst.
    </div></div>
  </div>`;
}

// ───────────────────────── Import ─────────────────────────
async function readFiles() {
  const files = await pickFiles({ accept: '.json,application/json', multiple: true });
  const out = [];
  for (const f of files) {
    try { out.push(readPack(await f.text())); } catch (e) { toast(`${f.name}: ${e.message || e}`, 'error'); }
  }
  return out;
}
function ImportDialog({ pack, exists, inCampaign, close }) {
  const chk = checkPack(pack);
  const base = pack.edition === '2014' ? '2014' : '2024';
  const overrides = ['species', 'backgrounds', 'feats', 'classes'].flatMap((c) => {
    const keys = new Set(baseEntries(c, base).map((e) => e.key));
    return (pack.content[c] || []).filter((e) => keys.has(e.key || slugify(e.name || ''))).map((e) => e.name);
  });
  const [mode, setMode] = useState(exists ? 'replace' : 'new');
  return html`<div class="modal-body stack">
    <div><b style="font-size:17px">${pack.name}</b> <span class="badge">${EDITIONS.find((x) => x.value === pack.edition)?.label}</span>${pack.author ? html` <span class="small muted">von ${pack.author}</span>` : null}</div>
    ${pack.description ? html`<div class="small muted">${pack.description}</div>` : null}
    <div class="rb-counts">${CATEGORIES.filter((c) => chk.counts[c.key]).map((c) => html`<div class="rb-count" key=${c.key}><b>${chk.counts[c.key]}</b><span>${c.label}</span></div>`)}</div>
    ${overrides.length ? html`<div class="small rb-warn">Ersetzt Einträge des Grundbestands: ${overrides.slice(0, 12).join(', ')}${overrides.length > 12 ? ' …' : ''}</div>` : null}
    ${chk.errors.map((x, i) => html`<div key=${i} class="small danger-text">✖ ${x}</div>`)}
    ${chk.warnings.slice(0, 8).map((x, i) => html`<div key=${i} class="small rb-warn">⚠ ${x}</div>`)}
    ${exists ? html`<${Segmented} value=${mode} onChange=${setMode} options=${[{ value: 'replace', label: 'Vorhandenes Paket ersetzen' }, { value: 'new', label: 'Als neues Paket' }]} />` : null}
    <div class="small muted">Nur Inhalte importieren, die du nutzen darfst. Das Paket gilt nur dort, wo du es aktivierst.</div>
    <div class="modal-foot">
      <${Btn} onClick=${() => close(null)}>Abbrechen<//>
      <${Btn} icon="archive" disabled=${chk.errors.length > 0} onClick=${() => close({ mode, activate: false })}>In meine Bibliothek<//>
      ${inCampaign ? html`<${Btn} kind="primary" icon="check" disabled=${chk.errors.length > 0} onClick=${() => close({ mode, activate: true })}>Speichern & in dieser Kampagne aktivieren<//>` : null}
    </div>
  </div>`;
}

// ───────────────────────── Ansicht ─────────────────────────
export function RuleBuilderView({ tabId }) {
  const gm = useStore(app, (s) => s.role === 'gm' && !s.viewAsPlayer);
  const cid = useStore(app, (s) => s.cid);
  const campEd = useEdition();
  const rs = useStore(rulesState, (s) => s);
  const me = myUid();
  const [lib, setLib] = useState(null);
  const [camp, setCamp] = useState(null);
  useEffect(() => (me ? watchLibrary(me, setLib) : undefined), [me]);
  useEffect(() => (cid ? watchCampaignPacks(cid, setCamp) : undefined), [cid]);
  const ed = useRef({ pack: null, dirty: false });
  const [, force] = useState(0);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const touch = () => { ed.current.dirty = true; force((n) => n + 1); };
  useEffect(() => {
    const warn = (e) => { if (ed.current.dirty) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  const entries = useMemo(() => {
    const m = new Map();
    for (const d of lib || []) m.set(d.id, { id: d.id, name: d.name, edition: d.edition, counts: d.counts || {}, lib: d, camp: null });
    for (const d of camp || []) {
      const e = m.get(d.id) || { id: d.id, name: d.name, edition: d.edition, counts: d.counts || {}, lib: null };
      e.camp = d;
      m.set(d.id, e);
    }
    return [...m.values()].sort((a, b) => ((a.camp ? Number(a.camp.order) || 0 : 9e15) - (b.camp ? Number(b.camp.order) || 0 : 9e15)) || String(a.name).localeCompare(String(b.name), 'de'));
  }, [lib, camp]);
  const pack = ed.current.pack;
  const cur = pack ? entries.find((x) => x.id === pack.id) : null;

  if (!gm) {
    return html`<${ViewFrame} tabId=${tabId} title="Regelwerk"><div class="page narrow">
      <${Empty} icon="book" title="Regelwerk der Kampagne">Die Spielleitung legt fest, welche Regelpakete gelten.${rs.packs.length ? ` Aktiv: ${rs.packs.map((p) => p.name).join(', ')}.` : ' Es gilt der Grundbestand.'}<//>
    </div><//>`;
  }

  const confirmLeave = async () => !ed.current.dirty || confirmDialog('Ungespeicherte Änderungen verwerfen?', { ok: 'Verwerfen', danger: true });
  const open = async (e) => {
    if (pack?.id === e.id) return;
    if (!(await confirmLeave())) return;
    try {
      ed.current = { pack: packFromDoc(e.lib || e.camp), dirty: false };
      setTab('overview');
      force((n) => n + 1);
    } catch (x) { toast(`Paket lässt sich nicht öffnen: ${x.message || x}`, 'error'); }
  };
  const create = async () => {
    if (!(await confirmLeave())) return;
    const name = await promptDialog('Name des neuen Regelpakets', '', { title: 'Neues Regelpaket', placeholder: 'z. B. Völker von Arkonis', ok: 'Anlegen' });
    if (!name) return;
    const p = emptyPack(name.trim(), campEd);
    await saveToLibrary(me, p);
    ed.current = { pack: p, dirty: false };
    setTab('overview');
    force((n) => n + 1);
  };
  const save = async () => {
    const p = ed.current.pack;
    if (!p) return;
    const chk = checkPack(p);
    if (chk.errors.length && !(await confirmDialog(`Das Paket hat ${chk.errors.length} Fehler (siehe Überblick). Trotzdem speichern? Fehlerhafte Einträge werden beim Anwenden übersprungen.`, { ok: 'Trotzdem speichern' }))) return;
    setBusy(true);
    try {
      p.updated = now();
      if (!cur || cur.lib || !cur.camp) await saveToLibrary(me, p);
      if (cur?.camp && cid) await saveToCampaign(cid, p);
      ed.current.dirty = false;
      toast(cur?.camp ? 'Gespeichert – gilt jetzt in dieser Kampagne' : 'Gespeichert', 'success');
    } catch (x) { toast(`Speichern fehlgeschlagen: ${x.message || x}`, 'error'); }
    setBusy(false);
    force((n) => n + 1);
  };
  const setActive = async (e, v) => {
    if (!cid) return;
    try {
      if (e.camp) await setCampaignPack(cid, e.id, { active: v });
      else if (v) await saveToCampaign(cid, packFromDoc(e.lib), { active: true });
      toast(v ? `„${e.name}“ gilt jetzt in dieser Kampagne` : `„${e.name}“ ist pausiert`, 'success');
    } catch (x) { toast(x.message || String(x), 'error'); }
  };
  const move = async (e, dir) => {
    const list = entries.filter((x) => x.camp);
    const i = list.findIndex((x) => x.id === e.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = Number(list[i].camp.order) || i;
    const b = Number(list[j].camp.order) || j;
    await setCampaignPack(cid, list[i].id, { order: a === b ? b + dir : b });
    await setCampaignPack(cid, list[j].id, { order: a });
  };
  const doImport = async (text = null) => {
    const packs = text ? (() => { try { return [readPack(text)]; } catch (x) { toast(x.message || String(x), 'error'); return []; } })() : await readFiles();
    for (const p of packs) {
      const exists = entries.some((x) => x.id === p.id);
      const res = await openModal(({ close }) => html`<${ImportDialog} pack=${p} exists=${exists} inCampaign=${!!cid} close=${close} />`, { title: 'Regelpaket importieren', icon: 'upload', size: 'lg' });
      if (!res) continue;
      if (res.mode === 'new' && exists) p.id = `rp-${uid(10)}`;
      await saveToLibrary(me, p);
      if (res.activate && cid) await saveToCampaign(cid, p, { active: true });
      toast(`„${p.name}“ importiert${res.activate ? ' und aktiviert' : ''}`, 'success');
    }
  };
  const pasteImport = async () => {
    const t = await promptDialog('Inhalt der Paketdatei (JSON) einfügen', '', { title: 'Regelpaket einfügen', multiline: true, ok: 'Prüfen' });
    if (t) doImport(t);
  };
  const entryMenu = (ev, e) => openMenu(ev, [
    { label: 'Bearbeiten', icon: 'pencil', onClick: () => open(e) },
    { label: 'Exportieren (Datei)', icon: 'download', onClick: () => exportPack(packFromDoc(e.lib || e.camp)) },
    { label: 'Duplizieren', icon: 'copy', onClick: async () => { const p = packFromDoc(e.lib || e.camp); p.id = `rp-${uid(10)}`; p.name = `${p.name} (Kopie)`; await saveToLibrary(me, p); toast('Kopie angelegt', 'success'); } },
    !e.lib ? { label: 'In meine Bibliothek übernehmen', icon: 'archive', onClick: async () => { await saveToLibrary(me, packFromDoc(e.camp)); toast('In deiner Bibliothek gespeichert', 'success'); } } : null,
    e.camp ? { label: 'Aus dieser Kampagne entfernen', icon: 'x', onClick: async () => { if (await confirmDialog(e.lib ? `„${e.name}“ aus dieser Kampagne entfernen? In deiner Bibliothek bleibt es erhalten.` : `„${e.name}“ liegt nur in dieser Kampagne. Entfernen löscht es endgültig – vorher exportieren oder in deine Bibliothek übernehmen?`, { ok: 'Entfernen', danger: true })) await removeFromCampaign(cid, e.id); } } : null,
    e.lib ? { label: 'Aus meiner Bibliothek löschen', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog(`„${e.name}“ aus deiner Bibliothek löschen?${e.camp ? ' In dieser Kampagne bleibt die aktive Kopie bestehen.' : ''}`, { ok: 'Löschen', danger: true })) { await removeFromLibrary(me, e.id); if (pack?.id === e.id && !e.camp) ed.current = { pack: null, dirty: false }; force((n) => n + 1); } } } : null,
  ].filter(Boolean));

  const ctx = pack ? {
    pack, touch,
    classOpts: CG.CLASSES.map((c) => ({ value: c.key, label: c.name })).concat((pack.content.classes || []).filter((c) => c.key && !CG.CLASSES.some((x) => x.key === c.key)).map((c) => ({ value: c.key, label: c.name }))),
    speciesOpts: [...new Map([...CG.SPECIES[pack.edition === '2014' ? 2014 : 2024], ...(pack.content.species || [])].filter((s) => s.key).map((s) => [s.key, { value: s.key, label: s.name }])).values()],
    featOpts: (cat) => [...new Map([...CG.FEATS, ...(pack.content.feats || [])].filter((f) => f.key && (!cat || f.cat === cat)).map((f) => [f.key, { value: f.key, label: f.name }])).values()],
  } : null;
  const counts = pack ? checkPack(pack).counts : {};
  const packErrors = pack ? rs.errors.filter((x) => x.startsWith(`${pack.name}:`)) : [];

  return html`<${ViewFrame} tabId=${tabId} title="Regelwerk-Editor">
    <div class="page wide rb">
      <div class="page-head head-tools"><h1><${Icon} name="layers" size=${24} />Regelwerk-Editor</h1><span class="grow"></span>
        <div class="head-tools-btns"><${ViewToggle} value="rulebuilder" options=${[{ value: 'rules', label: 'Regeln', icon: 'book', view: 'rules' }, { value: 'rulebuilder', label: 'Regelwerk-Editor', icon: 'layers', view: 'rulebuilder' }]} /></div></div>
      <datalist id="rb-sizes">${SIZES.map((s) => html`<option key=${s} value=${s} />`)}</datalist>
      <div class="rb-layout">
        <aside class="rb-side">
          <div class="row" style="gap:6px">
            <${Btn} kind="primary" icon="plus" onClick=${create}>Neues Paket<//>
            <${Btn} icon="upload" onClick=${() => doImport()}>Importieren<//>
            <${IconBtn} icon="more-horizontal" title="Weitere Möglichkeiten" onClick=${(e) => openMenu(e, [{ label: 'JSON einfügen …', icon: 'clipboard', onClick: pasteImport }])} />
          </div>
          <div class="small muted">Regelstand der Kampagne: <b>Regeln ${campEd}</b>. Häkchen = gilt in dieser Kampagne.</div>
          ${lib === null ? html`<div class="empty"><span class="spinner" /></div>` : entries.length ? html`<div class="rb-packs">${entries.map((e) => html`<div key=${e.id} class=${`rb-pack${pack?.id === e.id ? ' on' : ''}${e.camp?.active === false ? ' paused' : ''}`}>
            ${cid ? html`<input type="checkbox" title="Gilt in dieser Kampagne" checked=${!!e.camp && e.camp.active !== false} onChange=${(ev) => setActive(e, ev.target.checked)} />` : null}
            <button type="button" class="rb-pack-main" onClick=${() => open(e)}>
              <b>${e.name}</b>
              <span class="small muted">${EDITIONS.find((x) => x.value === e.edition)?.label || ''}${e.camp ? ' · Kampagne' : ''}${e.lib ? '' : ' · nur Kampagne'}</span>
            </button>
            ${e.camp ? html`<div class="rb-pack-order"><${IconBtn} icon="chevron-up" size=${13} title="Früher anwenden" onClick=${() => move(e, -1)} /><${IconBtn} icon="chevron-down" size=${13} title="Später anwenden (gewinnt)" onClick=${() => move(e, 1)} /></div>` : null}
            <${IconBtn} icon="more-vertical" size=${15} onClick=${(ev) => entryMenu(ev, e)} />
          </div>`)}</div>` : html`<div class="small faint">Noch keine Regelpakete. Lege eins an oder importiere eine Paketdatei.</div>`}
          ${rs.errors.length ? html`<div class="card stack sm"><b class="small">Beim Anwenden übersprungen</b>${rs.errors.slice(0, 8).map((x, i) => html`<div key=${i} class="tiny danger-text">${x}</div>`)}</div>` : null}
        </aside>
        <main class="rb-main">
          ${pack ? html`
            <div class="rb-head">
              <input class="input rb-title" value=${pack.name} onInput=${(e) => { pack.name = e.target.value; touch(); }} />
              <span class="badge">${EDITIONS.find((x) => x.value === pack.edition)?.label}</span>
              <span class="grow"></span>
              <span class=${`small ${ed.current.dirty ? 'rb-warn' : 'muted'}`}>${ed.current.dirty ? 'Ungespeichert' : 'Gespeichert'}</span>
              <${Btn} icon="download" onClick=${() => exportPack(pack)}>Exportieren<//>
              <${Btn} kind="primary" icon="save" loading=${busy} onClick=${save}>Speichern<//>
            </div>
            <div class="rb-tabs">${TABS.map((k) => html`<button type="button" key=${k} class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${EXTRA_TAB[k] || catOf(k).label}${counts[k] ? html`<span>${counts[k]}</span>` : null}</button>`)}</div>
            ${tab === 'overview' ? html`<${Overview} pack=${pack} touch=${touch} setTab=${setTab} errors=${packErrors} />`
              : tab === 'rules' ? html`<${RulesTab} pack=${pack} touch=${touch} />`
              : tab === 'remove' ? html`<${RemoveTab} pack=${pack} touch=${touch} />`
              : html`<${CategoryEditor} key=${`${pack.id}-${tab}`} cat=${tab} pack=${pack} ctx=${ctx} touch=${touch} />`}
          ` : html`<${Empty} icon="layers" title="Eigene Spielregeln">
              Baue Regelpakete mit eigenen Spezies, Hintergründen, Talenten, Klassen, Unterklassen, Zaubern und Ausrüstung – oder ändere die Grundregeln. Aktivierte Pakete gelten für diese Kampagne und alle Mitspieler; über Export und Import tauschst du sie mit anderen Spielleitungen.
            <//>`}
        </main>
      </div>
    </div>
  <//>`;
}
