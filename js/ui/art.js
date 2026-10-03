// Bilder für Zauber, Gegenstände und Kreaturen: Symbol (game-icons.net, CC BY 3.0) auf gestalteter Kachel.
// Die Symbole werden beim ersten Gebrauch nachgeladen (js/data/gameicons.js).
import { html, useState, useEffect } from '../lib/preact.js';
import { SCHOOL_ART, DAMAGE_ART, SPELL_ART, HEAL_ICON, MONSTER_RULES, CREATURE_TYPES, CREATURE_DEFAULT } from '../data/artmap.js';
import { itemLook } from '../data/items.js';
import { esc } from '../lib/util.js';

let GI = null;
let loading = null;
const waiters = new Set();
export function loadIcons() {
  if (GI) return Promise.resolve(GI);
  if (!loading) {
    loading = import('../data/gameicons.js').then((m) => {
      GI = m.GI;
      for (const f of waiters) f();
      waiters.clear();
      return GI;
    });
  }
  return loading;
}
function useIcons() {
  const [, force] = useState(0);
  useEffect(() => {
    if (GI) return undefined;
    const f = () => force((x) => x + 1);
    waiters.add(f);
    loadIcons();
    return () => waiters.delete(f);
  }, []);
  return GI;
}

// SVG-Markup eines Symbols (für Canvas/Karten) – setzt geladene Symbole voraus
export function giMarkup(name, color = '#fff') {
  const ic = GI?.[name];
  if (!ic) return '';
  const [body, w = 512, h = 512] = Array.isArray(ic) ? ic : [ic];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="${color}">${body}</svg>`;
}
const imgCache = new Map();
// Symbol als Bild (für Canvas), wird nach dem Laden über onReady nachgereicht
export function giImage(name, color, onReady) {
  const key = `${name}|${color}`;
  if (imgCache.has(key)) return imgCache.get(key);
  if (!GI) { loadIcons().then(() => onReady?.()); return null; }
  const svg = giMarkup(name, color);
  if (!svg) return null;
  const img = new Image();
  img.onload = () => onReady?.();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  imgCache.set(key, img);
  return img;
}

export function GameIcon({ name, size = 20, color, class: cls = '', title }) {
  const gi = useIcons();
  const ic = gi?.[name];
  const [body, w = 512, h = 512] = Array.isArray(ic) ? ic : [ic];
  return html`<svg class=${`gi ${cls}`} width=${size} height=${size} viewBox=${`0 0 ${w} ${h}`} fill=${color || 'currentColor'} aria-hidden=${title ? null : 'true'}
    dangerouslySetInnerHTML=${{ __html: (title ? `<title>${esc(title)}</title>` : '') + (body || '') }} />`;
}

// ───────────────────────── Zauber ─────────────────────────
export function spellIconName(sp) {
  return SPELL_ART[sp?.id] || (sp?.damage?.type && DAMAGE_ART[sp.damage.type]?.icon) || (sp?.heal ? HEAL_ICON : null) || SCHOOL_ART[sp?.school]?.icon || 'magic-swirl';
}
export function spellColor(sp) {
  return (sp?.damage?.type && DAMAGE_ART[sp.damage.type]?.color) || (sp?.heal ? '#57e39a' : null) || SCHOOL_ART[sp?.school]?.color || '#8a5cf5';
}
export function SpellArt({ sp, size = 44, level = true }) {
  if (!sp) return html`<span class="art spell-art custom" style=${{ width: `${size}px`, height: `${size}px` }}><${GameIcon} name="magic-swirl" size=${Math.round(size * 0.62)} /></span>`;
  const c = spellColor(sp);
  const sc = SCHOOL_ART[sp.school]?.color || c;
  return html`<span class="art spell-art" style=${{ width: `${size}px`, height: `${size}px`, '--c1': c, '--c2': sc }}>
    <${GameIcon} name=${spellIconName(sp)} size=${Math.round(size * 0.64)} />
    ${level && sp.level ? html`<i class="art-lvl">${sp.level}</i>` : null}
  </span>`;
}
export function SchoolDot({ school }) {
  const s = SCHOOL_ART[school];
  return s ? html`<span class="school-dot" style=${{ '--c': s.color }} title=${s.name}></span>` : null;
}
export function DamageTag({ type, children }) {
  const d = DAMAGE_ART[type];
  if (!d) return html`<span class="dmg-tag">${children}</span>`;
  return html`<span class="dmg-tag" style=${{ '--c': d.color }} title=${`${d.name}schaden`}><${GameIcon} name=${d.icon} size=${13} />${children}</span>`;
}

// ───────────────────────── Gegenstände ─────────────────────────
export function ItemArt({ item, size = 40 }) {
  const { icon, color } = itemLook(item || {});
  return html`<span class=${`art item-art${color ? ' magic' : ''}`} style=${{ width: `${size}px`, height: `${size}px`, '--rc': color || '#8b7a5a' }}>
    <${GameIcon} name=${icon} size=${Math.round(size * 0.68)} />
  </span>`;
}

// ───────────────────────── Kreaturen ─────────────────────────
export const creatureType = (t) => CREATURE_TYPES.find((x) => x.re.test(String(t || ''))) || CREATURE_DEFAULT;
export function monsterIconName(m) {
  const n = String(m?.name || '');
  for (const [re, ic] of MONSTER_RULES) if (re.test(n)) return ic;
  return creatureType(m?.type).icon;
}
// Gemalte Porträts der SRD-Monster (assets/portraits) – werden beim ersten Gebrauch nachgeladen
let PORTRAITS = null;
let PORTRAIT_V = {};
export function loadPortraits() {
  if (PORTRAITS) return Promise.resolve(PORTRAITS);
  return import('../data/portraits.js').then((m) => { PORTRAITS = m.PORTRAITS; PORTRAIT_V = m.PORTRAIT_V || {}; return PORTRAITS; }).catch(() => { PORTRAITS = new Set(); return PORTRAITS; });
}
// Porträt-Adresse mit Fingerabdruck (?v=): der Service Worker hält Bilder dauerhaft im Cache – ohne ?v= käme ein
// ausgetauschtes Porträt nie an. Wirkt auch auf alte, an Tokens gespeicherte Pfade (t.pic).
const PORTRAIT_RE = /^(.*assets\/portraits\/(?:q\/)?([^/?]+)\.webp)(?:\?.*)?$/;
export function frischesBild(url) {
  const m = PORTRAIT_RE.exec(String(url || ''));
  if (!m) return url;
  const v = PORTRAIT_V[m[2]];
  return v ? `${m[1]}?v=${v}` : m[1];
}
const refKey = (m) => String(m?.portraitId || m?.srdId || m?.id || '');
// Hochformat für Bögen und Kompendium, quadratischer Ausschnitt für Token und Initiativleiste
export function portraitOf(m, { square = false } = {}) {
  if (m?.image) return m.image;
  const k = refKey(m);
  if (!k || !PORTRAITS?.has(k)) return null;
  return frischesBild(square ? `assets/portraits/q/${k}.webp` : `assets/portraits/${k}.webp`);
}
function usePortraits() {
  const [, force] = useState(0);
  useEffect(() => {
    if (PORTRAITS) return undefined;
    let alive = true;
    loadPortraits().then(() => alive && force((x) => x + 1));
    return () => { alive = false; };
  }, []);
  return PORTRAITS;
}

// Großes Bild im Hochformat (Kompendium, NPC-Bogen) – ohne Porträt bleibt es beim Symbol
export function PortraitArt({ m, w = 132, cr = false }) {
  usePortraits();
  const pic = portraitOf(m);
  const h = Math.round(w * 4 / 3);
  if (pic) {
    return html`<span class="art portrait-art" style=${{ width: `${w}px`, height: `${h}px` }}><img src=${pic} alt="" loading="lazy" />
      ${cr && m?.cr ? html`<i class="ma-cr">HG ${m.cr}</i>` : null}</span>`;
  }
  return html`<${MonsterArt} m=${m} size=${w} cr=${cr} round=${false} />`;
}

export function MonsterArt({ m, size = 56, cr = false, round = true, square = false }) {
  usePortraits();
  const pic = portraitOf(m, { square: square || round });
  if (pic) {
    return html`<span class=${`art monster-art has-img${round ? ' round' : ''}`} style=${{ width: `${size}px`, height: `${size}px` }}><img src=${pic} alt="" loading="lazy" />
      ${cr && m.cr ? html`<i class="ma-cr">HG ${m.cr}</i>` : null}</span>`;
  }
  const t = creatureType(m?.type);
  return html`<span class=${`art monster-art${round ? ' round' : ''}`} style=${{ width: `${size}px`, height: `${size}px`, '--mc': m?.color || t.color }} title=${t.name}>
    <${GameIcon} name=${m?.icon || monsterIconName(m)} size=${Math.round(size * (round ? 0.64 : 0.72))} />
    ${cr && m?.cr ? html`<i class="ma-cr">HG ${m.cr}</i>` : null}
  </span>`;
}
