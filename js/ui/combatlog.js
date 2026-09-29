// Kampfprotokoll im Stil von Baldur's Gate 3: farbige Namen, eingerückte Folgen („… wird getroffen“),
// Runden als Überschrift. Überfahren (bzw. Antippen) zeigt den Rechenweg – SG/RK, jeden Würfel, alle Boni
// und Effekte; die Taste T hält den Tooltip fest. Einträge ohne Struktur (ältere Kämpfe) bleiben einfache Zeilen.
// Datenformat der Einträge: core/engine.js → log().
import { html, useState, useEffect, useRef } from '../lib/preact.js';
import { DAMAGE_ART } from '../data/artmap.js';
import { CONDITIONS } from '../data/rules5e.js';
import { Icon } from './components.js';

const condText = (n) => CONDITIONS.find((c) => c.name === n)?.desc || '';
const dText = (s) => String(s || '').replace(/(\d*)d(\d|%|F)/gi, '$1W$2');
const AB = { str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' };
// „erleidet 11 gleißenden Schaden“
const DMG_DE = {
  acid: 'Säureschaden', bludgeoning: 'Wuchtschaden', cold: 'Kälteschaden', fire: 'Feuerschaden', force: 'Energieschaden', lightning: 'Blitzschaden',
  necrotic: 'nekrotischen Schaden', piercing: 'Stichschaden', poison: 'Giftschaden', psychic: 'psychischen Schaden', radiant: 'gleißenden Schaden',
  slashing: 'Hiebschaden', thunder: 'Schallschaden',
};
const SUB = new Set(['save', 'dmg', 'heal', 'temp', 'cond', 'end', 'eff', 'death', 'down', 'dsave']);

// Seite eines Kämpfers → Farbe (Gruppe grün, Gegner rot, Teams für Spieler gegen Spieler)
function Name({ v, sideOf }) {
  if (!v) return null;
  const s = sideOf?.(v[0]) || '';
  return html`<b class=${`cl-n ${s}`}>${v[1]}</b>`;
}
// Farben je Schadensart im Protokoll – auf dunklem Grund gut unterscheidbar (die körperlichen hell abgestuft)
const LOG_COLOR = { ...Object.fromEntries(Object.entries(DAMAGE_ART).map(([k, v]) => [k, v.color])), slashing: '#e9e4da', piercing: '#b9c8e6', bludgeoning: '#d8b48a', force: '#d98cff', necrotic: '#7ed49a', poison: '#a6d23c' };
export const dmgColor = (t) => LOG_COLOR[t] || null;
function Dmg({ n, t }) {
  const c = dmgColor(t);
  return html`<b class="cl-dmg" style=${c ? { color: c } : null}>${n} ${DMG_DE[t] || 'Schaden'}</b>`;
}

// Freitext einfärben: bekannte Namen nach Seite, Schadensarten in ihrer Farbe (ältere Zeilen und Hinweise)
const DMG_WORDS = [['Säure', 'acid'], ['Wucht', 'bludgeoning'], ['Kälte', 'cold'], ['Feuer', 'fire'], ['Energie', 'force'], ['Kraft', 'force'], ['Blitz', 'lightning'],
  ['nekrotisch', 'necrotic'], ['Stich', 'piercing'], ['Gift', 'poison'], ['psychisch', 'psychic'], ['gleißend', 'radiant'], ['strahlend', 'radiant'], ['Hieb', 'slashing'], ['Schall', 'thunder'], ['Donner', 'thunder']];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DMG_RE = `(?:\\d+\\s)?(?:${DMG_WORDS.map(([w]) => w).join('|')})(?:schaden|e[nrs]?\\sSchaden|en|er|es|e)?`;
function Colored({ text, names }) {
  const s = String(text ?? '');
  const ns = [...names.keys()].filter((n) => n && n.length > 1).sort((a, b) => b.length - a.length);
  const alts = [...(ns.length ? [`(?<n>${ns.map(reEsc).join('|')})`] : []), `(?<d>${DMG_RE})`];
  const re = new RegExp(`(?<![\\p{L}])(?:${alts.join('|')})(?![\\p{L}])`, 'giu');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m.groups.n) {
      const key = [...names.keys()].find((k) => k.toLowerCase() === m.groups.n.toLowerCase());
      out.push(html`<b class=${`cl-n ${names.get(key) || ''}`}>${m[0]}</b>`);
    } else {
      const word = m.groups.d.replace(/^\d+\s/, '').toLowerCase();
      const hit = DMG_WORDS.find(([w]) => word.startsWith(w.toLowerCase()));
      const c = hit ? dmgColor(hit[1]) : null;
      out.push(c ? html`<b style=${{ color: c }}>${m[0]}</b>` : m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return html`<span>${out}</span>`;
}

// Text einer Zeile aus dem Ereignis
function Line({ l, sideOf }) {
  const e = l.e;
  const N = (v) => html`<${Name} v=${v} sideOf=${sideOf} />`;
  const W = (w) => (w ? html`<b class="cl-w">${w}</b>` : null);
  switch (e.t) {
    case 'round': return e.r === 'start' ? html`<span>Kampf beginnt – Runde 1</span>` : html`<span>Kampfrunde ${e.n}</span>`;
    case 'turn': return html`<span>▶ ${N(e.o)} ist am Zug</span>`;
    case 'init': return html`<span>${N(e.o)} würfelt Initiative: <b class="cl-num">${e.n}</b></span>`;
    case 'use': return html`<span>${N(e.a)} ${e.r === 'spell' ? 'wirkt' : 'nutzt'} ${W(e.w)}${e.o ? html` auf ${N(e.o)}` : e.n > 1 ? ` auf ${e.n} Ziele` : ''}.</span>`;
    case 'atk': {
      const res = {
        hit: html`<span class="cl-sub">${N(e.o)} wird getroffen.</span>`,
        crit: html`<span class="cl-sub cl-crit">Kritischer Treffer gegen ${N(e.o)}!</span>`,
        miss: html`<span class="cl-sub">${N(e.a)} verfehlt ${N(e.o)}.</span>`,
        fumble: html`<span class="cl-sub">${N(e.a)} patzt – natürliche 1.</span>`,
        image: html`<span class="cl-sub">${N(e.a)} trifft nur ein Spiegelbild von ${N(e.o)}.</span>`,
        blocked: html`<span class="cl-sub cl-muted">Angriff nicht möglich.</span>`,
      }[e.r];
      return html`<span>${N(e.a)} nutzt ${W(e.w)} gegen ${N(e.o)}.</span>${res || null}`;
    }
    case 'save': {
      const ab = AB[e.ab] || '';
      const vs = e.a ? html` gegen ${N(e.a)}${e.w ? html` (${W(e.w)})` : null}` : e.w ? html` gegen ${W(e.w)}` : null;
      if (e.r === 'immune') return html`<span>${N(e.o)} ist immun${vs}.</span>`;
      if (e.r === 'auto') return html`<span>${N(e.o)} scheitert automatisch am ${ab}-Rettungswurf${vs}.</span>`;
      return html`<span>${N(e.o)} ${e.r === 'ok' ? 'schafft' : 'scheitert an'} ${e.r === 'ok' ? 'einen' : 'einem'} ${ab}-Rettungswurf${vs}.</span>`;
    }
    case 'dmg': {
      // mehrere Schadensarten: Summe plus farbige Teile (vor Resistenzen)
      const mixed = !e.dt ? (l.tip?.dmg || []).filter((p) => p.t && p.n) : [];
      if (e.n > 0 && mixed.length > 1) {
        return html`<span>${N(e.o)} erleidet <b class="cl-num">${e.n} Schaden</b> (${mixed.map((p, i) => html`${i ? ', ' : ''}<b style=${{ color: dmgColor(p.t) }}>${p.n} ${DAMAGE_ART[p.t]?.name || ''}</b>`)})${e.r === 'crit' ? ' – kritisch' : ''}.</span>`;
      }
    }
    return e.n > 0
      ? html`<span>${N(e.o)} erleidet <${Dmg} n=${e.n} t=${e.dt || (l.tip?.dmg || []).find((p) => p.t)?.t} />${e.r === 'crit' ? ' (kritisch)' : ''}.</span>`
      : html`<span>${N(e.o)} erleidet keinen Schaden.</span>`;
    case 'heal': return html`<span>${N(e.o)} erhält <b class="cl-heal">${e.n} TP</b> zurück${e.w ? html` (${W(e.w)})` : null}.</span>`;
    case 'temp': return html`<span>${N(e.o)} erhält <b class="cl-heal">${e.n} temporäre TP</b>${e.w ? html` (${W(e.w)})` : null}.</span>`;
    case 'cond': return html`<span>${N(e.o)} erhält den Zustand <b class="cl-cond">${e.w}</b>.</span>`;
    case 'end': return html`<span>${N(e.o)} verliert <b class="cl-cond">${e.w}</b>${e.r ? ` (${e.r})` : ''}.</span>`;
    case 'eff': return html`<span>${N(e.o)} erhält <b class="cl-cond">${e.w}</b>.</span>`;
    case 'down': return html`<span class="cl-dead">${N(e.o)} fällt bewusstlos zu Boden.</span>`;
    case 'death': return html`<span class="cl-dead">☠ ${N(e.o)} ${e.r === 'pc' ? 'stirbt' : 'ist besiegt'}.</span>`;
    case 'dsave': return html`<span>${N(e.o)}: Todesrettungswurf – ${e.w}</span>`;
    default: return html`<span>${l.text}</span>`;
  }
}

// ── Rechenweg ──
const sign = (v) => (v < 0 ? '−' : '+');
function Roll({ r }) {
  const two = (r.d || []).length > 1;
  const adv = r.m === 'adv' ? 'Vorteil' : r.m === 'dis' ? 'Nachteil' : '';
  const dice = two ? (r.d || []).map((v, i) => html`${i ? ' · ' : ''}${v === r.k && (r.d.indexOf(v) === i) ? html`<b>${v}</b>` : html`<s>${v}</s>`}`) : null;
  const pro = (r.why || []).filter((w) => w.startsWith('▲')).map((w) => w.slice(2));
  const con = (r.why || []).filter((w) => w.startsWith('▼')).map((w) => w.slice(2));
  return html`<div class="cl-roll">
    <div><span class="cl-lbl">${r.l}:</span> <b class="cl-num">${r.k}</b> <span class="cl-lbl">(W20${adv ? `, ${adv}` : ''}${two ? ': ' : ''}${dice})</span>${(r.p || []).filter(([v]) => v !== 0 || (r.p || []).length === 1).map(([v, why]) => html` ${sign(v)} <b class="cl-num">${Math.abs(v)}</b> <span class="cl-lbl">(${why})</span>`)} = <b class="cl-sum">${r.sum}</b>${r.crit ? html` <span class="cl-crit">· Kritisch!</span>` : r.fumble ? html` <span class="cl-dead">· Patzer</span>` : null}</div>
    ${pro.length ? html`<div class="cl-why up">▲ Vorteil durch ${pro.join(', ')}</div>` : null}
    ${con.length ? html`<div class="cl-why down">▼ Nachteil durch ${con.join(', ')}</div>` : null}
  </div>`;
}
function DmgRoll({ list, heal }) {
  const parts = (list || []).filter((p) => p);
  if (!parts.length) return null;
  const total = parts.reduce((s, p) => s + (Number(p.n) || 0), 0);
  return html`<div class="cl-roll"><span class="cl-lbl">${heal ? 'Heilwurf' : 'Schadenswurf'}:</span> ${parts.map((p, i) => html`${i ? ' + ' : ''}<b class="cl-num" style=${dmgColor(p.t) ? { color: dmgColor(p.t) } : null}>${p.n}</b> <span class="cl-lbl">(${[p.x ? dText(p.x) : '', p.l || ''].filter(Boolean).join(' · ')}${DAMAGE_ART[p.t] ? html` · <b style=${{ color: dmgColor(p.t) }}>${DAMAGE_ART[p.t].name}</b>` : null}${p.d?.length ? html`: ${p.d.map((v, k) => html`${k ? ', ' : ''}${/^~.*~$/.test(v) ? html`<s>${v.slice(1, -1)}</s>` : v}`)}` : null})</span>`)}${parts.length > 1 ? html` = <b class="cl-sum">${total}</b>` : null}</div>`;
}
function hasTip(l, gm) {
  if (!l.e) return false;
  if (l.tip || (gm && l.gtip)) return true;
  return (l.e.t === 'cond' || l.e.t === 'end') && !!condText(l.e.w);
}
export function LogTip({ l, gm, sideOf, fix, onClose, style, names = new Map() }) {
  const e = l.e || {};
  const t = { ...(l.tip || {}), ...(gm ? l.gtip || {} : {}) };
  const rule = (e.t === 'cond' || e.t === 'end') ? condText(e.w) : '';
  const lines = (t.lines || []).filter(Boolean);
  return html`<div class=${`cl-tip${fix ? ' fix' : ''}`} style=${style}>
    ${fix ? html`<button type="button" class="cl-tip-x" title="Loslassen (T)" onClick=${onClose}><${Icon} name="x" size=${14} /></button>` : null}
    ${t.ac != null ? html`<div class="cl-head"><${Icon} name="shield" size=${14} /> Rüstungsklasse von <${Name} v=${e.o} sideOf=${sideOf} />: <b class="cl-num">${t.ac}</b></div>` : null}
    ${t.dc != null ? html`<div class="cl-head"><${Icon} name="target" size=${14} /> Schwierigkeitsgrad: <b class="cl-num">${t.dc}</b></div>` : null}
    ${(t.rolls || []).map((r, i) => html`<${Roll} key=${i} r=${r} />`)}
    ${t.dmg ? html`<${DmgRoll} list=${t.dmg} heal=${e.t === 'heal'} />` : null}
    ${lines.length ? html`<div class="cl-notes">${lines.map((x, i) => html`<div key=${i}><${Colored} text=${x} names=${names} /></div>`)}</div>` : null}
    ${t.hp ? html`<div class="cl-hp"><${Icon} name="heart" size=${13} /> danach ${t.hp}</div>` : null}
    ${rule ? html`<div class="cl-rule"><b>${e.w}:</b> ${rule}</div>` : null}
    ${fix ? null : html`<div class="cl-hint">Taste <b>T</b> hält den Rechenweg fest.</div>`}
  </div>`;
}

// Tooltip neben dem Zeiger, im Fenster gehalten
function place(x, y) {
  const w = Math.min(360, innerWidth - 24);
  const left = x + 16 + w > innerWidth - 8 ? Math.max(8, x - w - 16) : x + 16;
  const below = y < innerHeight * 0.55;
  return below ? { left: `${left}px`, top: `${y + 14}px`, width: `${w}px` } : { left: `${left}px`, bottom: `${innerHeight - y + 14}px`, width: `${w}px` };
}

// Tooltip-Verhalten wie in BG3: Maus darüber = anzeigen, T = festhalten (dann scrollbar), Antippen = festhalten/lösen.
// bind(key, data) → Ereignis-Props für ein Element; node = der Tooltip (render(data, fix, close, style)).
export function useTip(render) {
  const [tip, setTip] = useState(null); // { key, data, x, y }
  const [fix, setFix] = useState(false);
  const ref = useRef(null);
  ref.current = tip;
  useEffect(() => {
    const onKey = (ev) => {
      const el = ev.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (ev.key === 'Escape') { setFix(false); setTip(null); return; }
      if ((ev.key !== 't' && ev.key !== 'T') || !ref.current) return;
      ev.preventDefault();
      setFix((v) => { if (v) setTip(null); return !v; });
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const close = () => { setFix(false); setTip(null); };
  const bind = (key, data) => ({
    onPointerEnter: (ev) => { if (ev.pointerType === 'mouse' && !fix) setTip({ key, data, x: ev.clientX, y: ev.clientY }); },
    onPointerMove: (ev) => { if (ev.pointerType === 'mouse' && !fix && ref.current?.key === key) setTip({ key, data, x: ev.clientX, y: ev.clientY }); },
    onPointerLeave: (ev) => { if (ev.pointerType === 'mouse' && !fix) setTip(null); },
    onClick: (ev) => { if (ref.current?.key === key && fix) close(); else { setTip({ key, data, x: ev.clientX, y: ev.clientY }); setFix(true); } },
  });
  const node = tip ? render(tip.data, fix, close, place(tip.x, tip.y)) : null;
  return { bind, node, active: tip?.key ?? null };
}

// lines: Protokolleinträge · gm: SL-Sicht (gm-Zeilen, gtip) · sideOf(id) → 'pc'|'npc'|'a'|'b'|'c'
export function CombatLogList({ lines, gm = false, sideOf = null, empty = 'Noch keine Einträge.', reverse = false, time = null }) {
  // Namen aller Beteiligten – damit auch einfache Zeilen und Hinweise sie farbig zeigen
  const names = new Map();
  for (const l of lines) for (const v of [l.e?.a, l.e?.o]) if (v?.[1] && !names.has(v[1])) names.set(v[1], sideOf?.(v[0]) || '');
  const t = useTip((l, fix, close, style) => html`<${LogTip} l=${l} gm=${gm} sideOf=${sideOf} fix=${fix} onClose=${close} style=${style} names=${names} />`);
  const list = reverse ? [...lines].reverse() : lines;
  if (!list.length) return html`<div class="tiny faint">${empty}</div>`;
  const stamp = (l) => (time ? html`<span class="cl-time">${time(l.ts)}</span>` : null);
  return html`<div class="cl">
    ${list.map((l, i) => {
      if (!l.e) return html`<div key=${i} class=${`cl-l plain ${l.kind || ''}`}>${stamp(l)}<${Colored} text=${gm ? l.gm || l.text : l.text} names=${names} /></div>`;
      if (l.e.t === 'round') return html`<div key=${i} class="cl-round">${stamp(l)}<${Line} l=${l} sideOf=${sideOf} /></div>`;
      const tipOk = hasTip(l, gm);
      return html`<div key=${i} class=${`cl-l ${SUB.has(l.e.t) ? 'sub' : ''} ${l.e.t === 'turn' ? 'turn' : ''} ${tipOk ? 'has-tip' : ''} ${t.active === i ? 'on' : ''}`} ...${tipOk ? t.bind(i, l) : {}}>
        ${stamp(l)}<${Line} l=${l} sideOf=${sideOf} />
      </div>`;
    })}
    ${t.node}
  </div>`;
}

// ── Würfe aus Verlauf und Chat ──
// Zerlegt den Rechenweg aus lib/dice.js rollDetailed() („2d20kh1 [17, ~4~] + 1d4 [3] (Segen) + 5“) in Bestandteile.
export function rollTerms(text) {
  const out = [];
  const s = String(text || '');
  let depth = 0;
  let cur = '';
  let sign = 1;
  const push = () => { if (cur.trim()) out.push({ sign, raw: cur.trim() }); cur = ''; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '[' || ch === '(') depth++;
    if (ch === ']' || ch === ')') depth--;
    if (!depth && (ch === '+' || ch === '−') && s[i - 1] === ' ' && s[i + 1] === ' ') { push(); sign = ch === '−' ? -1 : 1; i++; continue; }
    cur += ch;
  }
  push();
  if (out[0]?.raw.startsWith('−')) { out[0].sign = -1; out[0].raw = out[0].raw.slice(1); }
  return out.map(({ sign: sg, raw }) => {
    const lbl = /\(([^()]*)\)\s*$/.exec(raw);
    const body = lbl ? raw.slice(0, lbl.index).trim() : raw;
    const m = /^(\d*)d(\d+|F|%)([a-z]*\d*)(!?)\s*\[([^\]]*)\]$/i.exec(body);
    if (!m) return { sign: sg, num: Number(body) || 0, label: lbl?.[1] || '' };
    const faces = m[5].split(',').map((f) => f.trim()).filter(Boolean);
    const value = faces.reduce((t, f) => (/^~.*~$/.test(f) ? t : t + (Number(f.split('→').pop()) || 0)), 0);
    return { sign: sg, count: Number(m[1]) || 1, sides: m[2], mod: m[3], explode: !!m[4], faces, value, label: lbl?.[1] || '' };
  });
}
const MOD_DE = (t) => (t.sides === '20' && t.count >= 2 && /^kh1$/.test(t.mod) ? 'Vorteil' : t.sides === '20' && t.count >= 2 && /^kl1$/.test(t.mod) ? 'Nachteil'
  : /^kh(\d+)$/.test(t.mod) ? `höchste ${t.mod.slice(2)}` : /^kl(\d+)$/.test(t.mod) ? `niedrigste ${t.mod.slice(2)}` : /^dl(\d+)$/.test(t.mod) ? `ohne die niedrigsten ${t.mod.slice(2)}` : /^dh(\d+)$/.test(t.mod) ? `ohne die höchsten ${t.mod.slice(2)}` : t.mod);
const KIND_DE = { attack: 'Angriffswurf', damage: 'Schadenswurf', check: 'Probe', save: 'Rettungswurf', init: 'Initiative', heal: 'Heilwurf', auto: 'Wurf', free: 'Wurf' };

export function RollTip({ r, fix, onClose, style }) {
  const terms = rollTerms(r.text);
  return html`<div class=${`cl-tip${fix ? ' fix' : ''}`} style=${style}>
    ${fix ? html`<button type="button" class="cl-tip-x" title="Loslassen (T)" onClick=${onClose}><${Icon} name="x" size=${14} /></button>` : null}
    <div class="cl-head"><${Icon} name="d20" size=${14} /> ${r.label || dText(r.input)}${r.character ? html` <span class="cl-lbl">· ${r.character}</span>` : null}</div>
    <div class="cl-roll"><span class="cl-lbl">${KIND_DE[r.kind] || 'Wurf'}:</span> ${terms.map((t, i) => {
      const sg = i || t.sign < 0 ? html` ${t.sign < 0 ? '−' : '+'} ` : null;
      if (t.faces) {
        const md = MOD_DE(t);
        return html`${sg}<b class="cl-num">${t.value}</b> <span class="cl-lbl">(${t.count}W${t.sides}${md ? `, ${md}` : ''}${t.explode ? ', explodierend' : ''}${t.label ? ` · ${t.label}` : ''}: ${t.faces.map((f, k) => html`${k ? ' · ' : ''}${/^~.*~$/.test(f) ? html`<s>${f.slice(1, -1)}</s>` : f}`)})</span>`;
      }
      return html`${sg}<b class="cl-num">${t.num}</b>${t.label ? html` <span class="cl-lbl">(${t.label})</span>` : null}`;
    })} = <b class="cl-sum">${r.total}</b>${r.crit ? html` <span class="cl-crit">· Natürliche 20!</span>` : r.fumble ? html` <span class="cl-dead">· Natürliche 1</span>` : null}</div>
    ${r.notes?.length ? html`<div class="cl-notes">${r.notes.map((n, i) => html`<div key=${i}>✦ ${n}</div>`)}</div>` : null}
    <div class="cl-hint">Ausdruck: ${dText(r.input)}${fix ? '' : ' · Taste T hält den Rechenweg fest.'}</div>
  </div>`;
}
