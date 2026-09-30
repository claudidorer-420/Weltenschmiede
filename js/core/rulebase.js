// Vorlagen aus dem Grundbestand (SRD 5.1 / 5.2.1) für den Regelwerk-Editor („Aus Grundbestand“).
// Zauber, magische Gegenstände und Zustände liegen in großen Datendateien – sie werden erst hier bei Bedarf geladen.
// Magische Waffen und Rüstungen werden als fertige Einträge der Kategorie „Waffen“ bzw. „Rüstungen“ angeboten
// (Grundwaffe/-rüstung eingesetzt, Bonus, Wirkungen, Einstimmung, Ladungen, Gewicht).
import * as CG from '../data/chargen.js';
import { baseEntries } from './rulesets.js';
import { MAGIC_FX, WEAPON_BASES } from '../data/magicfx.js';
import { CATALOG, WEAPON_RANGE, magicWeight } from '../data/items.js';
import { CONDITIONS } from '../data/rules5e.js';
import { slugify } from '../lib/util.js';

const RAR = (r) => CG.RARITIES.find((x) => String(r || '').toLowerCase().startsWith(x.toLowerCase())) || (/artefakt/i.test(r) ? 'Artefakt' : 'ungewöhnlich');
const text = (d) => (Array.isArray(d) ? d.join('\n\n') : String(d || ''));
const attuneOf = (a) => /einstimmung/i.test(String(a || ''));
// Platz am Körper aus Art und Name des SRD-Gegenstands
const SLOT_RULES = [
  [/trank|öl der|öl des|elixier/i, 'potion'], [/^ring\b|\bring (der|des)\b/i, 'ring'], [/amulett|talisman|medaillon|brosche|skarabäus|anhänger|halskette/i, 'amulet'],
  [/umhang|mantel/i, 'cloak'], [/robe/i, 'clothing'], [/stiefel|schuhe/i, 'boots'], [/handschuh/i, 'gloves'], [/armschienen/i, 'bracers'], [/helm|diadem|stirnreif|stirnband|hut\b|brille|augen (der|des)/i, 'head'],
  [/gürtel/i, 'belt'], [/zauberstab|^stab\b|\bstab (der|des)\b|zepter/i, 'focus'], [/flöte|horn|harfe|laute|leier|trommel/i, 'instrument'], [/pfeil|geschoss/i, 'ammo'],
];
const slotOf = (mi) => { for (const [re, s] of SLOT_RULES) if (re.test(`${mi.name}`)) return s; return 'wondrous'; };
const firstWeapon = (base) => {
  const keys = String(base || 'any').split('|').flatMap((b) => WEAPON_BASES[b] || [b]);
  // die übliche Wahl zuerst: Langschwert, Streitaxt, Langbogen
  for (const pref of ['langschwert', 'streitaxt', 'langbogen']) if (keys.includes(pref) && CG.findWeapon(pref)) return CG.findWeapon(pref);
  for (const k of keys) { const w = CG.findWeapon(k); if (w) return w; }
  return CG.findWeapon('langschwert') || CG.WEAPONS[0];
};
const firstArmor = (base) => {
  const keys = String(base || 'any').split('|');
  for (const k of keys) { const a = CG.ARMOR.find((x) => x.key === k); if (a) return a; }
  const type = keys.includes('heavy') ? 'heavy' : keys.includes('medium') ? 'medium' : keys.includes('light') ? 'light' : '';
  return CG.ARMOR.find((a) => a.type === (type || 'medium')) || CG.ARMOR.find((a) => a.type !== 'shield');
};
// Varianten (+1/+2/+3, Resistenzart, Drachenfarbe …) werden zu eigenen Einträgen
const variantsOf = (m) => (m.variants?.length ? m.variants : [null]);

let MAGIC = null;
const loadMagic = () => (MAGIC ? Promise.resolve(MAGIC) : import('../data/magicitems-srd.js').then((x) => { MAGIC = x.MAGIC_ITEMS; return MAGIC; }));

async function magicEntries(cat) {
  const list = await loadMagic();
  const out = [];
  for (const mi of list) {
    const m = MAGIC_FX[mi.id] || {};
    const kind = m.kind || (/^Trank/i.test(mi.type) ? 'potion' : 'item');
    const want = cat === 'weapons' ? kind === 'weapon' : cat === 'armor' ? kind === 'armor' || kind === 'shield' : kind === 'item' || kind === 'potion';
    if (!want) continue;
    for (const v of variantsOf(m)) {
      const name = v ? `${mi.name.replace(/,?\s*\+1, \+2 oder \+3/, '')} (${v.label})` : mi.name;
      const fx = [...(m.fx || []), ...(v?.fx || [])];
      const plus = Number(v?.plus ?? m.plus) || 0;
      const common = { key: slugify(name), name, rarity: RAR(mi.rarity), desc: text(mi.desc), ...(attuneOf(mi.attune) ? { attune: true } : {}), ...(fx.length ? { fx } : {}), ...(m.charges || v?.charges ? { charges: v?.charges || m.charges } : {}), weight: magicWeight({ ...mi, mref: mi.id }), _srd: true };
      if (cat === 'weapons') {
        const w = firstWeapon(m.base);
        out.push({ ...common, cat: w.cat, dmg: w.dmg, ...(w.vers ? { vers: w.vers } : {}), type: m.dmgType || w.type, p: `${w.p}${m.addProps || ''}`, m: w.m || '', ...(plus ? { magic: plus } : {}), ...(WEAPON_RANGE[w.key] ? { range: WEAPON_RANGE[w.key] } : {}), ...(m.alwaysProf ? { alwaysProf: true } : {}), special: `Grundwaffe: ${w.name}` });
      } else if (cat === 'armor') {
        if (kind === 'shield') out.push({ ...common, type: 'shield', ac: 2, ...(plus ? { bonus: plus } : {}), weight: 3 });
        else {
          const a = firstArmor(m.base);
          out.push({ ...common, type: a.type, ac: a.ac, ...(plus ? { bonus: plus } : {}), ...(a.str && !m.mithral ? { str: a.str } : {}), ...(a.stealth && !m.mithral ? { stealth: true } : {}), ...(m.alwaysProf ? { alwaysProf: true } : {}), weight: magicWeight({ ...mi, mref: mi.id, base: a.key }), special: `Grundrüstung: ${a.name}` });
        }
      } else {
        out.push({ ...common, slot: kind === 'potion' ? 'potion' : slotOf(mi), ...(kind === 'potion' || m.consumable ? { consumable: true } : {}) });
      }
    }
  }
  return out;
}
// Gewöhnliche Ausrüstung (Abenteuerausrüstung, Werkzeuge, Instrumente, Tränke …) als einfache Gegenstände
function gearEntries() {
  const SLOT = { potion: 'potion', ammo: 'ammo', focus: 'focus', clothes: 'clothing', instrument: 'instrument' };
  return CATALOG.filter((x) => !['weapon', 'armor', 'shield'].includes(x.cat)).map((x) => ({ key: slugify(x.name), name: x.name, slot: SLOT[x.cat] || 'other', rarity: 'gewöhnlich', desc: '', weight: x.weight, cost: x.cost, ...(x.cat === 'potion' ? { consumable: true } : {}), _gear: true }));
}
// Die Standardzustände als Vorlage für eigene Zustände: sie tragen den Grundzustand mit („zählt als …“)
function conditionEntries() {
  return CONDITIONS.map((c) => ({ key: slugify(c.name), name: c.name, desc: c.desc, base: [c.name], fx: [] }));
}

export async function loadBase(cat, ed) {
  const e = ed === '2014' ? '2014' : '2024';
  if (cat === 'spells') {
    const m = await (e === '2024' ? import('../data/spells-2024.js') : import('../data/spells-2014.js'));
    return m.SPELLS.map((s) => ({ ...s }));
  }
  if (cat === 'items') return [...(await magicEntries('items')), ...gearEntries()];
  if (cat === 'weapons') return [...baseEntries('weapons', e), ...(await magicEntries('weapons'))];
  if (cat === 'armor') return [...baseEntries('armor', e), ...(await magicEntries('armor'))];
  if (cat === 'conditions') return conditionEntries();
  return baseEntries(cat, e);
}
// Nur „Als Vorlage“ sinnvoll: eigene Zustände ersetzen keine Grundzustände, magische Gegenstände haben keine Grundfassung im Regelwerk
export const TEMPLATE_ONLY = new Set(['conditions']);
