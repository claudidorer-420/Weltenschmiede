// Spielwerte für NPC. Drei Stufen:
//   none  – keine Werte; im Kampf greift der „Gemeine“ aus dem SRD (alles 10, RK 10, 4 TP, Knüppel 1W4)
//   short – Kurz-Spielwerte: RK, TP, ein Angriff, Herausforderungsgrad
//   full  – volle Werte aus Klasse und Stufe (wie ein Charakter, nur als Statblock)
// DOM-frei, damit die Werte auch im MCP-Server und in Arbeitern gerechnet werden können.
import { CLASSES } from './chargen.js';

export const NPC_MODES = [
  { value: 'none', label: 'Keine Spielwerte' },
  { value: 'short', label: 'Kurz-Spielwerte' },
  { value: 'full', label: 'Volle Spielwerte' },
];

export const abMod = (s) => Math.floor(((Number(s) || 10) - 10) / 2);
export const profBonus = (lvl) => 2 + Math.floor((Math.max(1, Math.min(20, Number(lvl) || 1)) - 1) / 4);
const sgn = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

// Der Standard-NPC ohne eigene Werte: der „Gemeine“ aus dem SRD 5.1 (Wirte, Bauern, Passanten).
// Hier fest eingetragen, damit dieses Modul DOM- und datenfrei bleibt.
export const NPC_FALLBACK = {
  size: 'Mittelgroß',
  sizeKey: 'medium',
  type: 'Humanoide (jedes Volk)',
  alignment: 'jede Gesinnung',
  ac: 10,
  acNote: '',
  hp: 4,
  hpDice: '1W8',
  speed: '9 m',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  cr: '0',
  xp: 10,
  pb: 2,
  senses: 'Passive Wahrnehmung 10',
  languages: 'Eine beliebige Sprache (normalerweise Gemeinsprache)',
  actions: [{ name: 'Knüppel', desc: 'Nahkampfwaffenangriff: +2 auf Treffer, Reichweite 1,5 m, ein Ziel. Treffer: 2 (1W4) Wuchtschaden.' }],
  traits: [],
  source: 'SRD 5.1 – Gemeiner',
  portraitId: 'gemeiner',
};

export const fallbackStat = (name = 'NPC') => ({
  ...NPC_FALLBACK,
  abilities: { ...NPC_FALLBACK.abilities },
  actions: NPC_FALLBACK.actions.map((a) => ({ ...a })),
  name,
});

// Ausrüstung je Klasse – bestimmt Rüstungsklasse, Waffe und Schadenswürfel
const KIT = {
  barbar: { ac: 13, acNote: 'ungepanzerte Verteidigung', w: 'Großaxt', dice: 'W12', dmg: 'Hieb', fin: false },
  barde: { ac: 14, acNote: 'Lederrüstung', w: 'Rapier', dice: 'W8', dmg: 'Stich', fin: true },
  kleriker: { ac: 18, acNote: 'Kettenpanzer, Schild', w: 'Streitkolben', dice: 'W6', dmg: 'Wucht', fin: false },
  druide: { ac: 15, acNote: 'Lederrüstung, Schild', w: 'Kampfstab', dice: 'W6', dmg: 'Wucht', fin: false },
  kaempfer: { ac: 18, acNote: 'Kettenrüstung, Schild', w: 'Langschwert', dice: 'W8', dmg: 'Hieb', fin: false },
  moench: { ac: 15, acNote: 'ungepanzerte Verteidigung', w: 'Waffenloser Schlag', dice: 'W6', dmg: 'Wucht', fin: true },
  paladin: { ac: 18, acNote: 'Kettenrüstung, Schild', w: 'Kriegshammer', dice: 'W8', dmg: 'Wucht', fin: false },
  waldlaeufer: { ac: 15, acNote: 'Schuppenpanzer', w: 'Langbogen', dice: 'W8', dmg: 'Stich', fin: true, fern: true },
  schurke: { ac: 14, acNote: 'Lederrüstung', w: 'Kurzschwert', dice: 'W6', dmg: 'Stich', fin: true },
  zauberer: { ac: 12, acNote: 'ohne Rüstung', w: 'Dolch', dice: 'W4', dmg: 'Stich', fin: true },
  hexenmeister: { ac: 14, acNote: 'Lederrüstung', w: 'Dolch', dice: 'W4', dmg: 'Stich', fin: true },
  magier: { ac: 12, acNote: 'ohne Rüstung', w: 'Kampfstab', dice: 'W6', dmg: 'Wucht', fin: false },
  magieschmied: { ac: 16, acNote: 'Schuppenpanzer, Schild', w: 'Kurzschwert', dice: 'W6', dmg: 'Stich', fin: true },
};
const KIT_DEF = { ac: 12, acNote: 'Lederrüstung', w: 'Kurzschwert', dice: 'W6', dmg: 'Stich', fin: true };

// Angriffe pro Runde (Kämpfer, Paladin & Co. bekommen den zusätzlichen Angriff)
const extraAttack = (key, lvl) => {
  if (['kaempfer'].includes(key)) return lvl >= 20 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1;
  if (['barbar', 'moench', 'paladin', 'waldlaeufer'].includes(key)) return lvl >= 5 ? 2 : 1;
  return 1;
};

// Herausforderungsgrad grob aus der Stufe – für die Anzeige und die Begegnungsrechnung
const crFor = (lvl) => {
  const v = Math.max(1, Number(lvl) || 1) * 0.6;
  if (v < 0.2) return '1/8';
  if (v < 0.4) return '1/4';
  if (v < 0.8) return '1/2';
  return String(Math.round(v));
};
const XP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100 };
const crXpOf = (cr) => XP[cr] ?? Math.round(200 * Number(cr) * (1 + Number(cr) / 14));

// Attributswerte: Hauptwert steigt mit der Stufe, der Rest bleibt bodenständig
function abilitiesFor(clsKey, lvl) {
  const cls = CLASSES.find((c) => c.key === clsKey);
  const prim = cls?.primary || ['str'];
  const haupt = Math.min(20, 15 + Math.floor(Math.max(1, lvl) / 4) * 2 + 1);
  const a = { str: 10, dex: 11, con: 12, int: 10, wis: 11, cha: 10 };
  a[prim[0]] = haupt;
  if (prim[1]) a[prim[1]] = Math.max(a[prim[1]], 14);
  a.con = Math.max(a.con, Math.min(18, 12 + Math.floor(Math.max(1, lvl) / 6) * 2));
  return a;
}

// Volle Spielwerte aus Klasse und Stufe
export function fullStat({ name = 'NPC', cls = 'kaempfer', level = 1, species = '', role = '', alignment = '', abilities } = {}) {
  const key = CLASSES.find((c) => c.key === cls || c.name === cls)?.key || 'kaempfer';
  const cl = CLASSES.find((c) => c.key === key);
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  const ab = abilities || abilitiesFor(key, lvl);
  const pb = profBonus(lvl);
  const kit = KIT[key] || KIT_DEF;
  const con = abMod(ab.con);
  // Die 1. Stufe bekommt den vollen Trefferwürfel, jede weitere den Durchschnitt
  const hp = Math.max(1, Math.round(cl.hd + con + (lvl - 1) * (cl.hd / 2 + 0.5 + con)));
  const angriffAb = kit.fin && abMod(ab.dex) > abMod(ab.str) ? 'dex' : 'str';
  const atk = abMod(ab[angriffAb]) + pb;
  const n = extraAttack(key, lvl);
  const schaden = `1${kit.dice}${abMod(ab[angriffAb]) ? ` ${sgn(abMod(ab[angriffAb]))}` : ''}`;
  const mult = n > 1 ? `Der NPC greift ${n}-mal an. ` : '';
  const zauber = cl.primary.some((p) => ['int', 'wis', 'cha'].includes(p)) && !['barbar', 'kaempfer', 'schurke', 'moench'].includes(key);
  const sg = 8 + pb + abMod(ab[cl.primary.find((p) => ['int', 'wis', 'cha'].includes(p)) || 'cha']);
  const cr = crFor(lvl);
  return {
    name,
    size: 'Mittelgroß',
    type: species ? `Humanoider (${species})` : 'Humanoider',
    alignment: alignment || 'neutral',
    ac: kit.ac,
    acNote: kit.acNote,
    hp,
    hpDice: `${lvl}W${cl.hd}${con * lvl ? ` ${sgn(con * lvl)}` : ''}`,
    speed: '9 m',
    abilities: ab,
    saves: cl.saves.map((s) => `${({ str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' })[s]} ${sgn(abMod(ab[s]) + pb)}`).join(', '),
    senses: `Passive Wahrnehmung ${10 + abMod(ab.wis)}`,
    languages: 'Gemeinsprache',
    cr,
    xp: crXpOf(cr),
    pb,
    traits: [
      ...(zauber ? [{ name: 'Zauberwirken', desc: `${cl.name} der ${lvl}. Stufe. Rettungswurf-SG gegen Zauber ${sg}, ${sgn(abMod(ab[cl.primary[0]]) + pb)} auf Zauberangriffe. Zauber nach Belieben der Spielleitung aus der Liste der ${cl.name}.` }] : []),
      ...(role ? [{ name: 'Beruf', desc: `${role} – Fertigkeitswürfe zum Beruf gelingen mit Übungsbonus ${sgn(pb)}.` }] : []),
    ],
    actions: [
      { name: kit.w, desc: `${mult}${kit.fern ? 'Fernkampfangriff' : 'Nahkampfangriff'}: ${sgn(atk)} auf Treffer, ${kit.fern ? 'Reichweite 45/180 m' : 'Reichweite 1,50 m'}, ein Ziel. Treffer: ${Math.max(1, Math.round((Number(kit.dice.slice(1)) + 1) / 2) + abMod(ab[angriffAb]))} (${schaden}) ${kit.dmg}schaden.` },
    ],
    source: `NPC – ${cl.name} ${lvl}. Stufe`,
    npcClass: key,
    npcLevel: lvl,
  };
}

// Kurz-Spielwerte: nur das Nötigste, damit der NPC im Kampf mithalten kann
export function shortStat({ name = 'NPC', level = 1, species = '', role = '', alignment = '' } = {}) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  const pb = profBonus(lvl);
  const hp = Math.max(1, 4 + lvl * 5);
  const cr = crFor(lvl);
  const w = Math.min(10, 4 + Math.floor(lvl / 4) * 2);
  return {
    name,
    size: 'Mittelgroß',
    type: species ? `Humanoider (${species})` : 'Humanoider',
    alignment: alignment || 'neutral',
    ac: Math.min(18, 11 + Math.floor(lvl / 4)),
    hp,
    hpDice: `${lvl}W8 +${lvl}`,
    speed: '9 m',
    abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 11, cha: 11 },
    senses: 'Passive Wahrnehmung 10',
    languages: 'Gemeinsprache',
    cr,
    xp: crXpOf(cr),
    pb,
    traits: role ? [{ name: 'Beruf', desc: `${role} – übt den Beruf mit Übungsbonus ${sgn(pb)} aus.` }] : [],
    actions: [{ name: 'Waffe', desc: `Nahkampfangriff: ${sgn(1 + pb)} auf Treffer, Reichweite 1,50 m, ein Ziel. Treffer: ${Math.round((w + 1) / 2) + 1} (1W${w} +1) Hiebschaden.` }],
    source: `NPC – Kurzwerte (Stufe ${lvl})`,
    npcLevel: lvl,
  };
}

// Werte für einen gespeicherten NPC – ohne eigene Werte greift der Standard-NPC
export function npcStat(npc) {
  if (!npc) return fallbackStat();
  if (npc.statMode !== 'none' && npc.stats && (npc.stats.hp || npc.stats.ac)) return { ...npc.stats, name: npc.stats.name || npc.name };
  return fallbackStat(npc.name || 'NPC');
}

// Werte neu rechnen, wenn die SL Modus, Klasse oder Stufe ändert
export function buildStat(npc) {
  if (npc.statMode === 'full') return fullStat(npc);
  if (npc.statMode === 'short') return shortStat(npc);
  return null;
}
