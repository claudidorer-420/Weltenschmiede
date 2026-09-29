// Wirkungen: aus Regeltexten und strukturierten Angaben werden Spielwerte.
// parseFx() erkennt feste Formulierungen in Beschreibungen („+3 m Bewegung“, „Resistenz gegen Feuerschaden“,
// „Übung in Heimlichkeit“ …) samt ihrer Textstelle (für die Hervorhebung im Editor). Sätze mit Bedingungen
// („Bonusaktion“, „für 10 Minuten“, „wenn …“) werden erkannt, aber nicht angewendet – außer die Bedingung lässt sich
// prüfen („ohne schwere Rüstung“, „solange du eine Rüstung trägst“, „ab Stufe 5“). fxSummary() fasst alle Wirkungen
// eines Charakters zusammen. Kein DOM, keine Abhängigkeit zu data/chargen.js – das Vokabular kommt von außen.

const TAU_FT = 0.3; // 1 Fuß = 0,3 m
const m2ft = (m) => Math.round(Number(String(m).replace(',', '.')) / TAU_FT);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const num = (s) => Number(String(s).replace(/[−–]/g, '-').replace(/\s+/g, '').replace(',', '.'));

export const FX_AB = { str: 'Stärke', dex: 'Geschicklichkeit', con: 'Konstitution', int: 'Intelligenz', wis: 'Weisheit', cha: 'Charisma' };
const AB_STEMS = [['str', /^(stärke|stä|str)/i], ['dex', /^(geschick|ges\b|ges$|ges-)/i], ['con', /^(konstitution|kon\b|kon$|kon-)/i], ['int', /^(intelligenz|int\b|int$|int-)/i], ['wis', /^(weisheit|wei\b|wei$|wei-)/i], ['cha', /^(charisma|cha\b|cha$|cha-)/i]];
const AB_RE = '(Stärke|Geschicklichkeit|Konstitution|Intelligenz|Weisheit|Charisma|STÄ|GES|KON|INT|WEI|CHA)';
export function abOf(word) {
  const w = String(word || '').trim();
  for (const [k, re] of AB_STEMS) if (re.test(w)) return k;
  return null;
}
// Schadensarten: deutsche Wortstämme → Schlüssel
export const FX_DMG = { acid: 'Säure', bludgeoning: 'Wucht', cold: 'Kälte', fire: 'Feuer', force: 'Energie', lightning: 'Blitz', necrotic: 'nekrotisch', piercing: 'Stich', poison: 'Gift', psychic: 'psychisch', radiant: 'gleißend', slashing: 'Hieb', thunder: 'Schall' };
const DMG_STEMS = [['acid', /^säure/i], ['bludgeoning', /^wucht/i], ['cold', /^kälte/i], ['fire', /^feuer/i], ['force', /^(energie|kraft)/i], ['lightning', /^blitz/i], ['necrotic', /^nekrot/i], ['piercing', /^stich/i], ['poison', /^gift/i], ['psychic', /^psych/i], ['radiant', /^(gleißend|strahlend)/i], ['slashing', /^hieb/i], ['thunder', /^(schall|donner)/i]];
export function dmgOf(word) {
  const w = String(word || '').trim();
  for (const [k, re] of DMG_STEMS) if (re.test(w)) return k;
  return null;
}
export const FX_CONDS = ['Blind', 'Bezaubert', 'Taub', 'Erschöpft', 'Verängstigt', 'Gepackt', 'Kampfunfähig', 'Unsichtbar', 'Gelähmt', 'Versteinert', 'Vergiftet', 'Liegend', 'Festgesetzt', 'Betäubt', 'Bewusstlos'];
const COND_STEMS = FX_CONDS.map((n) => [n, new RegExp(`^${esc(n.slice(0, Math.max(5, n.length - 2)))}`, 'i')]).concat([['Bezaubert', /^bezauber/i], ['Verängstigt', /^verängst/i], ['Vergiftet', /^vergift/i], ['Gelähmt', /^gelähm/i], ['Erschöpft', /^erschöpf/i]]);
function condOf(word) {
  const w = String(word || '').trim();
  for (const [n, re] of COND_STEMS) if (re.test(w)) return n;
  return null;
}

// Arten von Wirkungen – für Editor, Hilfe und Anzeige
export const FX_TYPES = [
  { t: 'speed', label: 'Bewegung (+/−)', group: 'Bewegung & Sinne', ex: '+3 m Bewegung', v: 'm' },
  { t: 'speedSet', label: 'Bewegungsrate (fester Wert)', group: 'Bewegung & Sinne', ex: 'Bewegungsrate 10,5 m', v: 'm' },
  { t: 'move', label: 'Weitere Bewegungsart', group: 'Bewegung & Sinne', ex: 'Flugbewegung 9 m · Schwimmbewegung gleich deiner Bewegungsrate', k: ['fly', 'swim', 'climb', 'burrow'], v: 'm' },
  { t: 'sense', label: 'Sinn', group: 'Bewegung & Sinne', ex: 'Dunkelsicht 18 m · Blindsicht 3 m · Erschütterungssinn 9 m · Wahrer Blick 18 m', k: ['dark', 'blind', 'tremor', 'true'], v: 'm' },
  { t: 'speedMul', label: 'Bewegungsrate vervielfachen', group: 'Bewegung & Sinne', ex: 'Bewegungsrate verdoppelt (Stiefel der Geschwindigkeit)', v: 'n' },
  { t: 'reach', label: 'Nahkampfreichweite (+)', group: 'Bewegung & Sinne', ex: 'Reichweite +1,5 m (lange Gliedmaßen)', v: 'm' },
  { t: 'ac', label: 'Rüstungsklasse (+/−)', group: 'Verteidigung', ex: '+1 RK · +1 auf die Rüstungsklasse, solange du eine Rüstung trägst', v: 'n' },
  { t: 'acFormula', label: 'Rüstungsklasse ohne Rüstung (Formel)', group: 'Verteidigung', ex: 'RK = 13 + GES · RK = 10 + GES + KON · RK 17 (Panzer, ohne GES)', v: 'n', k: 'ab' },
  { t: 'acMin', label: 'Rüstungsklasse mindestens', group: 'Verteidigung', ex: 'RK mindestens 16 (wie Rindenhaut)', v: 'n' },
  { t: 'dexCap', label: 'Mittelschwere Rüstung: GES-Grenze höher', group: 'Verteidigung', ex: 'In mittelschwerer Rüstung zählt GES bis +3 statt +2', v: 'n' },
  { t: 'stealthOk', label: 'Kein Nachteil auf Heimlichkeit durch Rüstung', group: 'Verteidigung', ex: 'Rüstung behindert Heimlichkeit nicht' },
  { t: 'resist', label: 'Resistenz', group: 'Verteidigung', ex: 'Resistenz gegen Feuerschaden · Resistenz gegen Hieb-, Stich- und Wuchtschaden', k: 'dmg' },
  { t: 'immune', label: 'Immunität (Schaden)', group: 'Verteidigung', ex: 'Immunität gegen Giftschaden', k: 'dmg' },
  { t: 'vuln', label: 'Anfälligkeit', group: 'Verteidigung', ex: 'Anfälligkeit gegen Gleißend-Schaden', k: 'dmg' },
  { t: 'condImm', label: 'Immun gegen Zustand', group: 'Verteidigung', ex: 'Immun gegen den Zustand Vergiftet · kann nicht bezaubert werden', k: 'cond' },
  { t: 'dmgReduce', label: 'Schaden verringern', group: 'Verteidigung', ex: 'Du erleidest 1 weniger Hiebschaden · Schaden aus nichtmagischen Angriffen um 3 verringert', v: 'n', k: 'dmg' },
  { t: 'critImmune', label: 'Keine kritischen Treffer gegen dich', group: 'Verteidigung', ex: 'Kritische Treffer gegen dich werden zu normalen Treffern (Adamant)' },
  { t: 'disAttackers', label: 'Angriffe gegen dich im Nachteil/Vorteil', group: 'Verteidigung', ex: 'Fernkampfangriffe gegen dich sind im Nachteil · Untote greifen dich mit Nachteil an' },
  { t: 'retaliate', label: 'Vergeltung (Angreifer erleidet Schaden)', group: 'Verteidigung', ex: 'Wer dich im Nahkampf trifft, erleidet 1W4 Säureschaden' },
  { t: 'evasion', label: 'Entrinnen (GES-Rettungswürfe)', group: 'Verteidigung', ex: 'Bei GES-Rettungswürfen für halben Schaden: kein Schaden bei Erfolg, halber bei Misserfolg' },
  { t: 'endure', label: 'Nicht kleinzukriegen (0 TP abwenden)', group: 'Verteidigung', ex: '1× pro langer Rast bei 0 TP stattdessen auf 1 TP bleiben · oder 2W6 TP zurückerhalten' },
  { t: 'aura', label: 'Aura für Verbündete', group: 'Verteidigung', ex: 'Verbündete in 3 m addieren deinen CHA-Modifikator auf Rettungswürfe' },
  { t: 'hpLevel', label: 'Trefferpunkte pro Stufe', group: 'Trefferpunkte & Heilung', ex: '+1 TP pro Stufe · TP-Maximum +2 je Stufe', v: 'n' },
  { t: 'hp', label: 'Trefferpunkte (einmalig)', group: 'Trefferpunkte & Heilung', ex: '+5 TP-Maximum', v: 'n' },
  { t: 'regen', label: 'Regeneration zu Zugbeginn', group: 'Trefferpunkte & Heilung', ex: 'Zu Beginn deines Zuges erhältst du 1W4 TP zurück', v: 'n' },
  { t: 'tempStart', label: 'Temporäre TP zu Zugbeginn', group: 'Trefferpunkte & Heilung', ex: 'Zu Beginn deines Zuges temporäre TP in Höhe deines CHA-Modifikators', v: 'n' },
  { t: 'healBonus', label: 'Heilung verstärken', group: 'Trefferpunkte & Heilung', ex: 'Deine Heilzauber heilen 2 TP mehr · Heilung wird immer maximal gewürfelt', v: 'n' },
  { t: 'abil', label: 'Attributswert (+/−)', group: 'Attribute & Würfe', ex: '+1 Weisheit · STÄ +2 · Charisma +2 (höchstens 22)', k: 'ab', v: 'n' },
  { t: 'abilSet', label: 'Attributswert festsetzen', group: 'Attribute & Würfe', ex: 'Stärke wird auf 19 gesetzt (wirkt nur, wenn der Wert niedriger ist)', k: 'ab', v: 'n' },
  { t: 'init', label: 'Initiative', group: 'Attribute & Würfe', ex: '+5 Initiative · Übungsbonus auf die Initiative', v: 'n' },
  { t: 'saveProf', label: 'Übung in Rettungswürfen', group: 'Attribute & Würfe', ex: 'Übung in Weisheits-Rettungswürfen', k: 'ab' },
  { t: 'saveBonus', label: 'Bonus auf Rettungswürfe', group: 'Attribute & Würfe', ex: '+1 auf alle Rettungswürfe · +1 auf GES-Rettungswürfe · +2 auf Rettungswürfe gegen Zauber', v: 'n' },
  { t: 'saveAdv', label: 'Vorteil/Nachteil bei Rettungswürfen', group: 'Attribute & Würfe', ex: 'Vorteil bei Rettungswürfen gegen Zauber · Vorteil auf KON-Rettungswürfe · gegen Vergiftet' },
  { t: 'checkBonus', label: 'Bonus auf Fertigkeiten/Attributswürfe', group: 'Attribute & Würfe', ex: 'Heimlichkeit +1 · +1 auf GES-Würfe · Überzeugen + INT-Modifikator', v: 'n' },
  { t: 'checkAdv', label: 'Vorteil/Nachteil bei Fertigkeiten', group: 'Attribute & Würfe', ex: 'Vorteil auf Wahrnehmung · Vorteil auf Initiative' },
  { t: 'jack', label: 'Halber Übungsbonus auf ungeübte Würfe', group: 'Attribute & Würfe', ex: 'Alleskönner: halber Übungsbonus auf alle Attributswürfe ohne Übung' },
  { t: 'dice', label: 'Würfelglück', group: 'Attribute & Würfe', ex: 'Eine gewürfelte 1 beim W20 neu würfeln · Schadenswürfel 1–2 neu würfeln · Fertigkeitswurf mindestens 10' },
  { t: 'skill', label: 'Fertigkeit (Übung)', group: 'Übungen & Auswahl', ex: 'Übung in Heimlichkeit und Wahrnehmung', k: 'skill' },
  { t: 'expertise', label: 'Expertise', group: 'Übungen & Auswahl', ex: 'Expertise in Athletik · doppelter Übungsbonus auf Geschichte', k: 'skill' },
  { t: 'weapon', label: 'Waffenübung', group: 'Übungen & Auswahl', ex: 'Übung mit Kriegswaffen · Übung mit Langschwert und Langbogen', k: 'weapon' },
  { t: 'armor', label: 'Rüstungsübung', group: 'Übungen & Auswahl', ex: 'Übung mit leichter und mittelschwerer Rüstung sowie Schilden', k: 'armor' },
  { t: 'tool', label: 'Werkzeug', group: 'Übungen & Auswahl', ex: 'Übung mit Diebeswerkzeug', k: 'text' },
  { t: 'lang', label: 'Sprache', group: 'Übungen & Auswahl', ex: 'Du sprichst Elfisch und Zwergisch · eine weitere Sprache deiner Wahl', k: 'lang' },
  { t: 'pick', label: 'Auswahl für Spieler (Fertigkeit, Attribut, Zauber …)', group: 'Übungen & Auswahl', ex: '3 Fertigkeiten nach Wahl · +1 auf ein Attribut und Übung in dessen Rettungswurf · 2 Zaubertricks der Magierliste' },
  { t: 'attack', label: 'Angriffsbonus', group: 'Angriff', ex: '+2 auf Angriffswürfe mit Fernkampfwaffen · +1W4 gegen Untote', v: 'n', k: ['all', 'melee', 'ranged', 'spell', 'weapon', 'unarmed', 'thrown'] },
  { t: 'damage', label: 'Schadensbonus (fest)', group: 'Angriff', ex: '+2 Schaden mit Nahkampfwaffen · + STÄ-Modifikator zusätzlich', v: 'n', k: ['all', 'melee', 'ranged', 'weapon', 'unarmed', 'thrown'] },
  { t: 'dmgExtra', label: 'Zusatzschaden (Würfel)', group: 'Angriff', ex: 'Zusätzlich 1W6 Feuerschaden · 1W8 gegen Untote · 2W6 bei kritischen Treffern · einmal pro Zug', v: 'n' },
  { t: 'crit', label: 'Kritischer Treffer schon ab 19 (18 …)', group: 'Angriff', ex: 'Kritischer Treffer bei 19 oder 20', v: 'n' },
  { t: 'advAttack', label: 'Vorteil/Nachteil bei Angriffen', group: 'Angriff', ex: 'Vorteil auf Angriffe gegen Monstrositäten · gegen verängstigte Ziele' },
  { t: 'onHit', label: 'Bei Treffer: Zustand, Heilung …', group: 'Angriff', ex: 'Bei einem Treffer KON-Rettungswurf (SG 12) oder Vergiftet für 2 Runden · du heilst 1W6 TP' },
  { t: 'ignoreResist', label: 'Resistenz ignorieren', group: 'Angriff', ex: 'Deine Angriffe ignorieren Resistenz gegen Hiebschaden', k: 'dmg' },
  { t: 'attacks', label: 'Angriffe pro Angriffsaktion', group: 'Angriff', ex: 'greifst du zweimal an', v: 'n' },
  { t: 'unarmed', label: 'Waffenloser Schlag (Würfel)', group: 'Angriff', ex: 'Waffenlose Schläge verursachen 1W6 + GES (wie Kampfkunst)' },
  { t: 'style', label: 'Kampfstil', group: 'Angriff', ex: 'Bogenschießen · Duellieren · Kampf mit zwei Waffen · Verteidigung · Kampf mit großen Waffen' },
  { t: 'spell', label: 'Zauber (angeboren / aus Gegenstand)', group: 'Zauber', ex: 'Du kennst den Zaubertrick Thaumaturgie · St. 3 Höllischer Tadel · Nebelschritt 1× pro kurzer Rast', k: 'text' },
  { t: 'spellDc', label: 'Zauber-SG (+/−)', group: 'Zauber', ex: '+1 auf den SG deiner Zauber', v: 'n' },
  { t: 'spellDmg', label: 'Zauberschaden (+)', group: 'Zauber', ex: 'Zaubertricks verursachen zusätzlich deinen CHA-Modifikator · +1 bei Kälteschaden', v: 'n' },
  { t: 'slots', label: 'Zusätzliche Zauberplätze', group: 'Zauber', ex: '1 zusätzlicher Zauberplatz des 2. Grades' },
  { t: 'res', label: 'Begrenzte Nutzung / Ladungen', group: 'Ressourcen & Aktionen', ex: '1× pro langer Rast · Übungsbonus-mal pro kurzer Rast · 7 Ladungen, 1W6+1 neu im Morgengrauen', v: 'n' },
  { t: 'resMax', label: 'Ressource erhöhen', group: 'Ressourcen & Aktionen', ex: 'Eine zusätzliche Nutzung von Göttliche Macht / Bardische Inspiration', v: 'n' },
  { t: 'bonusAct', label: 'Standardaktion als Bonusaktion', group: 'Ressourcen & Aktionen', ex: 'Spurt, Rückzug oder Verstecken als Bonusaktion (wie Raffinierte Aktion)' },
  { t: 'action', label: 'Eigene Aktion (Angriff, Odem, Heilung, Kampfhaltung …)', group: 'Ressourcen & Aktionen', ex: 'Odemwaffe · Klauen · Heilende Hände · Kampfrausch · Waffenaktion mit Zustand · Zauberplatz zurückholen', k: 'text' },
  { t: 'adv', label: 'Hinweis (wirkt nicht automatisch)', group: 'Hinweise', ex: 'Vorteil beim Aufspüren von Fallen', k: 'text' },
];
export const FX_BY = Object.fromEntries(FX_TYPES.map((x) => [x.t, x]));
export const MOVE_DE = { fly: 'Fliegen', swim: 'Schwimmen', climb: 'Klettern', burrow: 'Graben' };
export const SENSE_DE = { dark: 'Dunkelsicht', blind: 'Blindsicht', tremor: 'Erschütterungssinn', true: 'Wahrer Blick' };
// Worauf sich Angriffswirkungen beziehen
export const FX_ON = { all: 'alle Angriffe', weapon: 'Waffenangriffe', melee: 'Nahkampf', ranged: 'Fernkampf', unarmed: 'waffenlos', thrown: 'Wurfwaffen', spell: 'Zauber', cantrip: 'Zaubertricks', any: 'jeder Schaden', sneak: 'Hinterhältiger Angriff' };
export const FX_HP = { full: 'Ziel mit vollen TP', hurt: 'Ziel bereits verletzt', half: 'Ziel höchstens halbe TP' };
export const FX_SELFHP = { hurt: 'wenn du verletzt bist', half: 'wenn du höchstens halbe TP hast' };
// Wirkungen, die der Kampf als Effekt kennt (für „Bei Treffer“ und Kampfhaltungen)
export const ENGINE_EFFECTS = {
  bane: 'Fluch (−1W4 auf Angriffe und Rettungswürfe)', bless: 'Segen (+1W4 auf Angriffe und Rettungswürfe)', slow: 'Verlangsamt',
  noHeal: 'Kann nicht geheilt werden', advAgainst: 'Angriffe gegen das Ziel im Vorteil', noReactions: 'Keine Reaktionen',
  speedZero: 'Bewegungsrate 0', dodge: 'Ausweichen', disNext: 'Nachteil beim nächsten Angriff', guided: 'Nächster Angriff gegen das Ziel im Vorteil',
};
// Bedingungen, die sich nur im Kampf prüfen lassen
export const DYN_CONDS = ['conc', 'bloodied', 'raging'];
export const COND_DE = {
  noHeavy: 'ohne schwere Rüstung', unarmored: 'ohne Rüstung', unarmoredNoShield: 'ohne Rüstung und ohne Schild', noShield: 'ohne Schild', armored: 'in Rüstung',
  heavy: 'in schwerer Rüstung', shield: 'mit Schild', conc: 'solange du dich konzentrierst', bloodied: 'bei höchstens halben TP', raging: 'im Kampfrausch',
};
// Eigene Zustände aus Regelpaketen: Schlüssel → { name, desc, fx, dot, stack, noHeal, base, save, rounds }
export const CUSTOM_STATUS = {};
// Fähigkeiten zum Würfelglück (lib/dice.js kennt sie)
export const DICE_FX = { lucky: 'Eine gewürfelte 1 beim W20 neu würfeln (Glück)', reliable: 'Fertigkeitswürfe mindestens 10 (Verlässliches Talent)', gwf: 'Schadenswürfel mit 1 oder 2 neu würfeln', elemental: 'Schadenswürfel: 1 zählt als 2', savage: 'Waffenschaden zweimal würfeln, höheren nehmen', elven: 'Bei Vorteil drei W20 (Elfengenauigkeit)' };
export const STYLE_FX = { archery: 'Bogenschießen (+2 Fernkampf)', defense: 'Verteidigung (+1 RK in Rüstung)', dueling: 'Duellieren (+2 Schaden, eine Waffe)', gwf: 'Kampf mit großen Waffen', twf: 'Kampf mit zwei Waffen (Modifikator auf Zweitwaffe)' };
export const BONUS_ACTS = { dash: 'Spurt', disengage: 'Rückzug', hide: 'Verstecken', dodge: 'Ausweichen', help: 'Helfen' };

// ───────────────────────── Text zerlegen ─────────────────────────
// Sätze mit Position (Aufzählungen mit „·“ zählen wie Sätze)
function sentences(text) {
  const out = [];
  const re = /[^.;!?·\n]+[.;!?·\n]?/g;
  let m;
  while ((m = re.exec(text))) if (m[0].trim()) out.push({ s: m.index, t: m[0] });
  return out;
}
// Bedingungen, die sich prüfen lassen – werden aus dem Satz entfernt, bevor die allgemeine Prüfung läuft
const EVAL_CONDS = [
  ['noHeavy', /ohne\s+schwere\s+Rüstung|keine\s+schwere\s+Rüstung\s+trägst|solange\s+du\s+keine\s+schwere\s+Rüstung\s+trägst/i],
  ['unarmored', /ohne\s+Rüstung|keine\s+Rüstung\s+trägst|solange\s+du\s+keine\s+Rüstung\s+trägst|wenn\s+du\s+keine\s+Rüstung\s+trägst/i],
  ['armored', /solange\s+du\s+(?:eine\s+)?Rüstung\s+trägst|wenn\s+du\s+(?:eine\s+)?Rüstung\s+trägst|in\s+Rüstung/i],
  ['shield', /solange\s+du\s+einen\s+Schild\s+(?:trägst|führst)|mit\s+(?:einem\s+)?Schild/i],
];
// Alles, was eine Wirkung an eine Situation bindet (dann nur Hinweis)
const SITUATION = /\b(Bonusaktion|Reaktion|als\s+Aktion|eine\s+Aktion|Aktion\s*:|(?:\d+|eine[rn]?|zehn|zwei)\s+(?:Minuten?|Stunden?|Runden?)|solange|wenn\b|während|sobald|falls|nachdem|bei\s+einem\s+(?:kritischen\s+)?Treffer|nach\s+einem\s+Treffer|Kampfrausch|Tiergestalt|bis\s+zum|statt\b|anstatt|ersetzt|verwandelst|gegen\s+(?:Effekte|Magie|Zauber))\b/i;
const CHOICE = /\b(deiner\s+Wahl|nach\s+Wahl|wählst|zur\s+Wahl|wähle)\b|\soder\s/i;
const LEVEL = /\(?\bab\s+(?:der\s+)?(?:Stufe|St[.․])\s*(\d{1,2})\)?/i;

// Vokabular: { skills: [{key,name}], weapons: [{key,name}], languages: [..], tools?: [..] }
export function parseFx(text, vocab = {}, opts = {}) {
  const src = String(text || '');
  const out = [];
  if (!src.trim()) return out;
  // „St.“, „z. B.“ … sind kein Satzende: Punkt durch ein gleich langes Zeichen ersetzen (Positionen bleiben gleich)
  const work = src.replace(/\b(St|z|B|Nr|ca|bzw|usw|ggf|vgl|u|a)\./g, '$1․');
  const nameLvl = LEVEL.exec(String(opts.name || ''));
  const baseLvl = nameLvl ? Number(nameLvl[1]) : Number(opts.lvl) || 0;
  const taken = [];
  const free = (s, e) => !taken.some(([a, b]) => s < b && e > a);
  for (const sen of sentences(work)) {
    const S = sen.t;
    let rest = S;
    let cond = null;
    for (const [k, re] of EVAL_CONDS) if (re.test(rest)) { cond = k; rest = rest.replace(re, ' '); break; }
    const lvlM = LEVEL.exec(S);
    const lvl = lvlM ? Number(lvlM[1]) : baseLvl;
    rest = rest.replace(LEVEL, ' ');
    const situational = SITUATION.test(rest);
    const choice = CHOICE.test(S);
    const add = (t, m, extra = {}, { at = 0, len = null, kind = null } = {}) => {
      const s = sen.s + m.index + at;
      const e = s + (len ?? m[0].length - at);
      if (!free(s, e)) return;
      taken.push([s, e]);
      const hint = kind === 'res' || kind === 'fx' ? null : kind || (t === 'adv' ? 'hint' : situational ? 'cond' : null);
      out.push({ t, ...extra, ...(lvl ? { lvl } : {}), ...(cond ? { cond } : {}), active: !hint && !extra.choice, why: extra.choice ? 'Auswahl' : hint === 'cond' ? 'bedingt' : hint === 'hint' ? 'Hinweis' : hint === 'money' ? 'Geld' : '', s, e, txt: src.slice(s, e) });
    };
    const each = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(S))) { fn(m); if (!re.global) break; } };
    // Ressourcen: „1× pro langer Rast“, „Übungsbonus-mal pro kurzer Rast“, „einmal pro Tag“
    each(/(\d+|ein|einmal|zweimal|dreimal|Übungsbonus|ÜB|deinen\s+Übungsbonus|(?:deinem?\s+)?(?:Stärke|Geschicklichkeit|Konstitution|Intelligenz|Weisheit|Charisma|STÄ|GES|KON|INT|WEI|CHA)-?(?:Modifikator|Mod)?)\s*(?:×|-?\s*mal)\s*pro\s+(kurzer\s+oder\s+langer|kurzer|langer)\s+Rast|(einmal|zweimal|dreimal|\d+\s*×)\s+(?:pro\s+Tag|täglich)/gi, (m) => {
      const w = String(m[1] || m[3] || '').toLowerCase();
      const v = /übungs|üb\b|^üb$/.test(w) ? 'pb' : abOf(w.replace(/^deinem?\s+/, '')) ? `mod:${abOf(w.replace(/^deinem?\s+/, ''))}` : { ein: 1, einmal: 1, zweimal: 2, dreimal: 3 }[w] ?? (Number(w.replace(/\D/g, '')) || 1);
      const rest2 = /kurz/i.test(m[2] || '') ? 'short' : 'long';
      if (opts.name) add('res', m, { v, rest: rest2, k: String(opts.name).replace(LEVEL, '').trim() }, { kind: 'res' });
    });
    // Bewegung
    each(/([+−–-]\s*\d+(?:[,.]\d+)?)\s*m\s+(?:Bewegung(?:srate)?|Geschwindigkeit|Laufgeschwindigkeit)/gi, (m) => add('speed', m, { v: m2ft(num(m[1])) }));
    each(/(?:Bewegung(?:srate)?|Geschwindigkeit)\s+(?:steigt\s+)?um\s+(\d+(?:[,.]\d+)?)\s*m/gi, (m) => add('speed', m, { v: m2ft(num(m[1])) }));
    each(/(Flug|Kletter|Schwimm|Grab)(?:bewegung|geschwindigkeit|bewegungsrate)\s*[^.;·]{0,20}?(?:gleich|entspricht|in\s+Höhe|=)\s*(?:deiner\s+)?(?:Bewegungsrate|Geschwindigkeit)/gi, (m) => add('move', m, { k: { flug: 'fly', kletter: 'climb', schwimm: 'swim', grab: 'burrow' }[m[1].toLowerCase()], v: 'walk' }));
    each(/(Flug|Kletter|Schwimm|Grab)(?:bewegung|geschwindigkeit|bewegungsrate)\s*(?:von\s*)?(\d+(?:[,.]\d+)?)\s*m/gi, (m) => add('move', m, { k: { flug: 'fly', kletter: 'climb', schwimm: 'swim', grab: 'burrow' }[m[1].toLowerCase()], v: m2ft(m[2]) }));
    each(/(?:^|[^+−–\-\d\s])\s*(?:Bewegungsrate|Geschwindigkeit|Bewegung)\s*(?:beträgt\s*|von\s*|:\s*)?(\d+(?:[,.]\d+)?)\s*m\b/gi, (m) => add('speedSet', m, { v: m2ft(m[1]) }, { at: m[0].search(/[A-ZÄÖÜa-zäöü]/) }));
    // Sinne
    each(/(Dunkelsicht|Blindsicht|Erschütterungssinn|Wahrer\s+Blick|Wahrsicht)\s*(?:von\s*|auf\s*)?(\d+(?:[,.]\d+)?)\s*m/gi, (m) => {
      const k = /dunkel/i.test(m[1]) ? 'dark' : /blind/i.test(m[1]) ? 'blind' : /ersch/i.test(m[1]) ? 'tremor' : 'true';
      add('sense', m, { k, v: m2ft(m[2]) });
    });
    // Rüstungsklasse
    each(/(?:RK|Rüstungsklasse)\s*(?:=|von|beträgt|:)?\s*(\d{1,2})\s*\+\s*(?:dein(?:en?)?\s+)?(STÄ|GES|KON|INT|WEI|CHA|Stärke|Geschicklichkeit|Konstitution|Intelligenz|Weisheit|Charisma)(?:-?Mod(?:ifikator)?)?(?:\s*\+\s*(?:dein(?:en?)?\s+)?(STÄ|GES|KON|INT|WEI|CHA|Stärke|Geschicklichkeit|Konstitution|Intelligenz|Weisheit|Charisma)(?:-?Mod(?:ifikator)?)?)?/gi, (m) => {
      add('acFormula', m, { v: Number(m[1]), k: [abOf(m[2]), m[3] ? abOf(m[3]) : null].filter(Boolean) });
    });
    each(/([+−–-]\s*\d+)\s*(?:auf\s+(?:die\s+|deine\s+)?)?(?:RK|Rüstungsklasse)\b/gi, (m) => add('ac', m, { v: num(m[1]) }));
    each(/(?:RK|Rüstungsklasse)\s*([+−–-]\s*\d+)/gi, (m) => add('ac', m, { v: num(m[1]) }));
    // Trefferpunkte
    each(/([+−–-]?\s*\d+)\s*(?:TP|Trefferpunkte?)(?:-?Maximum)?\s*(?:pro|je)\s*Stufe/gi, (m) => add('hpLevel', m, { v: num(m[1]) }));
    each(/(?:TP|Trefferpunkte?)-?(?:Maximum|maximum)\s*(?:steigt\s+)?(?:um\s*)?\+?\s*(\d+)\s*(?:pro|je)\s*Stufe/gi, (m) => add('hpLevel', m, { v: num(m[1]) }));
    each(/(?<!temporäre\s)([+]\s*\d+)\s*(?:TP|Trefferpunkte?)(?:-?Maximum)?(?!\s*(?:pro|je))/gi, (m) => add('hp', m, { v: num(m[1]) }));
    // Initiative
    each(/Übungsbonus[^.;·]{0,30}?Initiative|Initiative[^.;·]{0,30}?Übungsbonus/gi, (m) => add('init', m, { v: 'pb' }));
    each(/([+−–-]\s*\d+)\s*(?:auf\s+(?:die\s+|deine\s+)?)?Initiative/gi, (m) => add('init', m, { v: num(m[1]) }));
    each(/Initiative\s*([+−–-]\s*\d+)/gi, (m) => add('init', m, { v: num(m[1]) }));
    // Angriffe pro Aktion
    each(/greifst\s+du\s+(zweimal|dreimal|viermal|\d+\s*-?mal)\s+an/gi, (m) => add('attacks', m, { v: { zweimal: 2, dreimal: 3, viermal: 4 }[m[1].toLowerCase()] || Number(m[1].replace(/\D/g, '')) || 2 }));
    // Übung in Rettungswürfen
    each(/Übung\s+(?:in|bei|für)\s+([^.;·]{0,60}?)Rettungsw(?:ü|u)rf\w*/gi, (m) => {
      const k = [...new Set(m[1].split(/[\s,-]+|\bund\b/).map(abOf).filter(Boolean))];
      if (k.length) add('saveProf', m, { k, ...(CHOICE.test(m[0]) ? { choice: true } : {}) });
    });
    each(/([+]\s*\d+)\s*auf\s+(?:alle\s+)?(?:deine\s+)?Rettungswürfe/gi, (m) => add('saveBonus', m, { v: num(m[1]) }));
    // Attributswerte
    const capM = /(?:höchstens|maximal|bis\s+(?:zu\s+)?|max\.)\s*(\d{2})/i.exec(S);
    const cap = capM ? { max: Number(capM[1]) } : {};
    each(new RegExp(`([+−–-]\\s*\\d+)\\s*(?:auf\\s+(?:deine\\s+|dein\\s+)?)?${AB_RE}(?![-\\w])`, 'gi'), (m) => add('abil', m, { k: abOf(m[2]), v: num(m[1]), ...cap, ...(choice ? { choice: true } : {}) }));
    each(new RegExp(`${AB_RE}\\s*([+−–-]\\s*\\d+)(?!\\d|,\\d)`, 'gi'), (m) => add('abil', m, { k: abOf(m[1]), v: num(m[2]), ...cap, ...(choice ? { choice: true } : {}) }));
    // Angriff und Schaden
    each(/([+−–-]\s*\d+)\s*(?:auf\s+)?(?:alle\s+)?(?:deine\s+)?(?:Angriffswürfe|Angriffe)(?:\s+mit\s+(Fernkampfwaffen|Nahkampfwaffen|Waffen|Zaubern))?/gi, (m) => add('attack', m, { v: num(m[1]), k: /fern/i.test(m[2] || '') ? 'ranged' : /nah/i.test(m[2] || '') ? 'melee' : /zauber/i.test(m[2] || '') ? 'spell' : 'all' }));
    each(/([+−–-]\s*\d+)\s*(?:auf\s+(?:den\s+)?)?(?:Schaden|Schadenswürfe)(?:\s+(?:mit|bei)\s+(Fernkampfwaffen|Nahkampfwaffen|Waffen))?/gi, (m) => add('damage', m, { v: num(m[1]), k: /fern/i.test(m[2] || '') ? 'ranged' : /nah/i.test(m[2] || '') ? 'melee' : 'all' }));
    // „ignoriert Resistenz gegen …“ zuerst – sonst hielte die Resistenz-Regel es für eine eigene Resistenz
    each(/ignorier\w*\s+(?:die\s+)?Resistenz(?:en)?\s+gegen\s+((?:[A-Za-zÄÖÜäöüß]+-?(?:schaden)?(?:\s*,\s*|\s+und\s+|\s+sowie\s+)?)+)/gi, (m) => {
      const k = m[1].split(/\s*,\s*|\s+und\s+|\s+sowie\s+/).map((w) => dmgOf(w.replace(/-?schaden$/i, ''))).filter(Boolean);
      if (k.length) add('ignoreResist', m, { k }, { kind: 'fx' });
    });
    // Resistenz, Immunität, Anfälligkeit
    each(/\b(Resistenz(?:en)?|Immunität(?:en)?|immun|Anfälligkeit(?:en)?|anfällig|verwundbar)\s+(?:gegen(?:über)?|für)\s+((?:(?:den\s+Zustand\s+|die\s+Zustände\s+)?[A-Za-zÄÖÜäöüß]+-?(?:schaden)?(?:\s*,\s*|\s+und\s+|\s+sowie\s+)?)+)/gi, (m) => {
      // Liste nur so weit, wie Schadensarten bzw. Zustände folgen („…, Vorteil gegen …“ gehört nicht mehr dazu)
      const dm = [];
      const cn = [];
      let end = m[0].length - m[2].length;
      const tok = /([A-Za-zÄÖÜäöüß]+)-?(?:schaden)?/g;
      let t;
      while ((t = tok.exec(m[2]))) {
        const w = t[1];
        if (/^(und|sowie|den|die|Zustand|Zustände|gegen)$/i.test(w)) continue;
        const d = dmgOf(w);
        const c = d ? null : condOf(w);
        if (!d && !c) break;
        if (d && !dm.includes(d)) dm.push(d);
        if (c && !cn.includes(c)) cn.push(c);
        end = m[0].length - m[2].length + t.index + t[0].length;
      }
      const kind = /^resist/i.test(m[1]) ? 'resist' : /^(anfäll|verwund)/i.test(m[1]) ? 'vuln' : 'immune';
      if (dm.length) add(kind, m, { k: dm }, { len: end });
      else if (cn.length && kind === 'immune') add('condImm', m, { k: cn }, { len: end });
    });
    each(/kannst?\s+(?:nicht|nie)\s+(bezaubert|verängstigt|vergiftet|gelähmt|betäubt|versteinert|festgesetzt|gepackt|überrascht)\s+werden/gi, (m) => { const c = condOf(m[1]); if (c) add('condImm', m, { k: [c] }); });
    // Übungen: Fertigkeiten, Expertise, Waffen, Rüstung, Werkzeuge
    each(/(?:Expertise|doppelte[nr]?\s+Übungsbonus)\s+(?:in|für|auf|bei)\s+([^.;·]+)/gi, (m) => {
      const k = (vocab.skills || []).filter((x) => new RegExp(`\\b${esc(x.name)}\\b`, 'i').test(m[1])).map((x) => x.key);
      if (k.length) add('expertise', m, { k, ...(/\sbei\s/i.test(m[1]) ? {} : {}), ...(CHOICE.test(m[0]) ? { choice: true } : {}) }, { kind: /\sbei\s/i.test(m[1].replace(new RegExp(`^[^,]*?(${(vocab.skills || []).map((x) => esc(x.name)).join('|') || '#'})`, 'i'), '')) ? 'cond' : null });
    });
    each(/(?:Übung|geübt)\s+(?:in|bei|für|mit|im\s+Umgang\s+mit)\s+(?:der\s+Fertigkeit\s+|den\s+Fertigkeiten\s+)?([^.;·]+)|Fertigkeit(?:en)?\s*:\s*([^.;·]+)/gi, (m) => {
      const seg = m[1] || m[2] || '';
      const sk = (vocab.skills || []).filter((x) => new RegExp(`\\b${esc(x.name)}\\b`, 'i').test(seg)).map((x) => x.key);
      if (sk.length && !/Rettungsw/i.test(seg)) { add('skill', m, { k: sk, ...(CHOICE.test(seg) ? { choice: true } : {}) }); return; }
      const low = seg.toLowerCase();
      const armor = [];
      if (/leicht\w*\s+(?:und\s+\w+\s+)?rüstung|leichter?\b/.test(low) && /rüstung/.test(low)) armor.push('light');
      if (/mittelschwer/.test(low)) armor.push('medium');
      if (/\bschwer\w*\s+rüstung|schwere[rn]?\s+(?:und|sowie)|,\s*schwere/.test(low) && /rüstung/.test(low)) armor.push('heavy');
      if (/schild/.test(low)) armor.push('shield');
      if (armor.length) { add('armor', m, { k: armor }); return; }
      const wp = weaponsIn(seg, vocab);
      if (wp.length) { add('weapon', m, { k: wp, ...(CHOICE.test(seg) ? { choice: true } : {}) }); return; }
      if (/(werkzeug|ausrüstung|besteck|utensil|instrument|spielset|set\b|kit\b)/i.test(seg)) add('tool', m, { k: seg.replace(/\s+(und|sowie)\s+.*$/i, '').trim(), ...(CHOICE.test(seg) ? { choice: true } : {}) });
    });
    each(/(?:Waffen|Kampf)(?:ausbildung|übung)\s*[:–-]?\s*([^.;·]+)/gi, (m) => { const wp = weaponsIn(m[1], vocab); if (wp.length) add('weapon', m, { k: wp }); });
    // Merkmal heißt „… Waffenausbildung“ und der Satz zählt nur Waffen auf
    if (/Waffen(?:ausbildung|übung)|Kampfausbildung/i.test(String(opts.name || '')) && !/Übung/i.test(S)) {
      const wp = weaponsIn(S, vocab);
      if (wp.length) add('weapon', { index: S.search(/\S/), 0: S.trim().replace(/[.;·]$/, '') }, { k: wp });
    }
    // Sprachen
    each(/(?:Du\s+sprichst|sprichst\s+du|beherrschst\s+du|Sprachen?\s*:)\s*([^.;·]+)/gi, (m) => {
      const cut = /\s+(?:sowie|und|,)\s+(?:eine|zwei|drei|\d+)\s+(?:weitere|zusätzliche)/i.exec(m[1]);
      const seg = cut ? m[1].slice(0, cut.index) : m[1];
      const k = (vocab.languages || []).filter((l) => new RegExp(`\\b${esc(l)}`, 'i').test(seg));
      if (k.length) add('lang', m, { k }, { len: m[0].length - m[1].length + seg.length });
    });
    each(/(eine|zwei|drei|\d+)\s+(?:weitere|zusätzliche)\s+Sprachen?/gi, (m) => add('lang', m, { k: [], n: { eine: 1, zwei: 2, drei: 3 }[m[1].toLowerCase()] || Number(m[1]) || 1, choice: true }));
    // Angeborene Zauber: „Du kennst den Zaubertrick X“, „St. 3 X“
    each(/(?:kennst|lernst|erhältst|beherrschst)\s+(?:du\s+)?(?:den\s+|die\s+)?(Zaubertricks?|Zauber)\s+([A-ZÄÖÜ][\wÄÖÜäöüß'’ -]{2,40}?)(?=\s*(?:[.,;·(]|und\b|$))/g, (m) => add('spell', m, { k: m[2].trim(), lv: /trick/i.test(m[1]) ? 0 : 1 }));
    each(/\b(?:St[.․]|Stufe)\s*(\d{1,2})\s*[:–-]?\s*([A-ZÄÖÜ][\wÄÖÜäöüß'’ -]{2,40}?)(?=\s*(?:[.,;·(]|$))/g, (m) => {
      if (/^(Stufe|Grad)/i.test(m[2])) return;
      const s = sen.s + m.index;
      if (!free(s, s + m[0].length)) return;
      taken.push([s, s + m[0].length]);
      out.push({ t: 'spell', k: m[2].trim(), lv: 1, lvl: Number(m[1]), active: true, why: '', s, e: s + m[0].length, txt: m[0] });
    });
    // Kritische Treffer, Zusatzschaden, Resistenz ignorieren
    each(/kritische[rn]?\s+Treffer\s+(?:schon\s+|bereits\s+)?(?:bei|ab)\s+(?:einer\s+)?(?:gewürfelten\s+)?(1[5-9])/gi, (m) => add('crit', m, { v: 20 - Number(m[1]) }));
    each(/(?:zusätzlich(?:e[nr]?)?|weitere[nr]?|extra)\s+(\d*\s*W\s*\d+(?:\s*[+]\s*\d+)?|\d+)\s+(?:Punkte?\s+)?(?:([A-Za-zÄÖÜäöüß]+?)-?schaden|([A-Za-zÄÖÜäöüß]+?)(?:e[nrs]?)?\s+Schaden)/gi, (m) => {
      const type = dmgOf(m[2] || m[3]);
      if (!type) return;
      const d = m[1].replace(/\s+/g, '');
      const vs = /gegen\s+((?:Untot|Unhold|Drach|Ries|Monstrosit|Konstrukt|Aberration|Elementar|Fee|Pflanz|Bestie|Humanoid|Riesen|Himmlisch)[\wäöüß]*(?:\s*(?:,|und|oder)\s*[A-ZÄÖÜ][\wäöüß]*)*)/i.exec(S);
      const crit = /kritische/i.test(S);
      const once = /einmal\s+(?:pro|in\s+jedem)\s+Zug/i.test(S);
      // „bei einem Treffer“ gehört bei Zusatzschaden dazu – nur andere Bedingungen machen daraus einen Hinweis
      const other = SITUATION.test(S.replace(/bei\s+einem\s+(?:kritischen\s+)?Treffer|nach\s+einem\s+Treffer|wenn\s+du\s+(?:damit\s+)?triffst|triffst\s+du/gi, ' ').replace(/gegen\s+\S+/gi, ' '));
      add('dmgExtra', m, { ...(/W/i.test(d) ? { dice: d.replace(/W/gi, 'd') } : { v: Number(d) }), type, ...(vs ? { vs: vs[1] } : {}), ...(crit ? { crit: true } : {}), ...(once ? { once: true } : {}) }, { kind: other ? 'cond' : 'fx' });
    });
    each(/ignorier\w*\s+(?:die\s+)?Resistenz(?:en)?\s+gegen\s+((?:[A-Za-zÄÖÜäöüß]+-?(?:schaden)?(?:\s*,\s*|\s+und\s+|\s+sowie\s+)?)+)/gi, (m) => {
      const k = m[1].split(/\s*,\s*|\s+und\s+|\s+sowie\s+/).map((w) => dmgOf(w.replace(/-?schaden$/i, ''))).filter(Boolean);
      if (k.length) add('ignoreResist', m, { k });
    });
    each(/kritische\s+Treffer\s+gegen\s+dich\s+(?:werden|gelten|zählen)\s+(?:zu|als)\s+normale[n]?\s+Treffer|keine\s+kritischen\s+Treffer\s+gegen\s+dich/gi, (m) => add('critImmune', m, {}, { kind: 'fx' }));
    // Zauber-SG und Zauberschaden
    each(/([+−–-]\s*\d+)\s*(?:auf\s+(?:den\s+)?)?(?:(?:deine[ns]?\s+)?Zauber-?(?:rettungswurf)?-?SG|SG\s+(?:deiner\s+)?Zauber|Zauberrettungswurf-?SG)/gi, (m) => add('spellDc', m, { v: num(m[1]) }));
    each(/(?:Zauber-?SG|Zauberrettungswurf-?SG)\s*([+−–-]\s*\d+)/gi, (m) => add('spellDc', m, { v: num(m[1]) }));
    // Rettungswürfe: Vorteil (Attribut, gegen Zauber, gegen Zustand) und Bonus je Attribut
    each(new RegExp(`\\b(Vorteil|Nachteil)\\s+(?:bei|auf)\\s+(?:allen\\s+|deinen\\s+)?(?:${AB_RE}s?[-‑]?\\s*)?(?:und\\s+${AB_RE}s?[-‑]?\\s*)?Rettungsw(?:ü|u)rf\\w*(?:\\s+gegen\\s+([^.;·,]+))?`, 'gi'), (m) => {
      const k = [m[2], m[3]].map(abOf).filter(Boolean);
      const target = (m[4] || '').trim();
      const vs = !target ? '' : /zauber|magi/i.test(target) ? 'spell' : condOf(target.replace(/^(?:den\s+Zustand\s+|die\s+Zustände\s+)/i, '').split(/\s+/)[0]) || (/vergift|gift/i.test(target) ? 'Vergiftet' : /bezauber/i.test(target) ? 'Bezaubert' : /angst|verängst/i.test(target) ? 'Verängstigt' : '');
      if (target && !vs) return; // gegen etwas Unbekanntes → bleibt Hinweis
      add('saveAdv', m, { k, vs, ...(m[1].toLowerCase() === 'nachteil' ? { dis: true } : {}) }, { kind: 'fx' });
    });
    each(new RegExp(`([+−–-]\\s*\\d+)\\s*auf\\s+(?:deine\\s+)?${AB_RE}s?[-‑]?\\s*Rettungsw(?:ü|u)rf\\w*`, 'gi'), (m) => add('saveBonus', m, { v: num(m[1]), k: [abOf(m[2])] }));
    each(new RegExp(`${AB_RE}s?[-‑]?\\s*Rettungsw(?:ü|u)rf\\w*\\s*([+−–-]\\s*\\d+)`, 'gi'), (m) => add('saveBonus', m, { v: num(m[2]), k: [abOf(m[1])] }));
    each(/([+−–-]\s*\d+)\s*auf\s+(?:alle\s+)?Rettungsw(?:ü|u)rf\w*\s+gegen\s+Zauber/gi, (m) => add('saveBonus', m, { v: num(m[1]), vs: 'spell' }));
    // Fertigkeiten: Vorteil und Bonus
    each(/\b(Vorteil|Nachteil)\s+(?:bei|auf)\s+(?:Würfen?\s+(?:für|auf)\s+|Proben\s+(?:für|auf)\s+|Attributswürfen\s+(?:für|auf)\s+)?([^.;·]+)/gi, (m) => {
      const k = (vocab.skills || []).filter((x) => new RegExp(`^\\s*(?:(?:und|,)\\s*)?${esc(x.name)}\\b`, 'i').test(m[2]) || new RegExp(`(?:,|und)\\s*${esc(x.name)}\\b`, 'i').test(m[2])).map((x) => x.key);
      if (/^\s*Initiative/i.test(m[2])) k.push('init');
      if (k.length && !/Rettungsw/i.test(m[2])) add('checkAdv', m, { k, ...(m[1].toLowerCase() === 'nachteil' ? { dis: true } : {}) }, { kind: SITUATION.test(m[0]) ? 'cond' : 'fx' });
    });
    for (const sk of vocab.skills || []) {
      each(new RegExp(`([+−–-]\\s*\\d+)\\s*auf\\s+(?:Würfe\\s+für\\s+)?${esc(sk.name)}\\b|\\b${esc(sk.name)}\\s*([+−–-]\\s*\\d+)(?!\\s*m)`, 'gi'), (m) => add('checkBonus', m, { k: [sk.key], v: num(m[1] || m[2]) }));
    }
    // Attribut festsetzen („Stärke wird auf 19 gesetzt“, „Stärkewert 19“)
    each(new RegExp(`${AB_RE}(?:wert)?\\s+(?:wird\\s+|beträgt\\s+|steigt\\s+)?auf\\s+(\\d{2})(?:\\s+gesetzt|\\s+erhöht)?|${AB_RE}wert\\s+(?:von\\s+)?(\\d{2})`, 'gi'), (m) => add('abilSet', m, { k: abOf(m[1] || m[3]), v: Number(m[2] || m[4]) }));
    // Schaden verringern
    each(/(?:erleidest|nimmst)\s+(?:du\s+)?(\d+)\s+(?:Punkte?\s+)?weniger\s+([A-Za-zÄÖÜäöüß]*?)-?schaden|([A-Za-zÄÖÜäöüß]*?)-?schaden[^.;·]{0,30}?um\s+(\d+)\s+(?:verringert|reduziert)/gi, (m) => {
      const t = dmgOf(m[2] || m[3] || '');
      add('dmgReduce', m, { v: Number(m[1] || m[4]), k: t ? [t] : [], ...(/nichtmagisch/i.test(S) ? { nm: true } : {}) }, { kind: /solange|wenn|während/i.test(S.replace(/solange\s+du\s+(?:eine\s+)?(?:schwere\s+)?Rüstung\s+trägst/i, '')) ? 'cond' : 'fx' });
    });
    // Regeneration zu Zugbeginn
    each(/(?:erhältst|regenerierst|gewinnst|heilst)\s+(?:du\s+)?(\d*\s*W\s*\d+|\d+)\s+(?:TP|Trefferpunkte)(?:\s+zurück)?\s+zu\s+Beginn\s+(?:jedes|deines)\s+Zuges|zu\s+Beginn\s+(?:jedes|deines)\s+Zuges\s+(?:erhältst|regenerierst|gewinnst)\s+(?:du\s+)?(\d*\s*W\s*\d+|\d+)\s+(?:TP|Trefferpunkte)/gi, (m) => {
      const d = (m[1] || m[2]).replace(/\s+/g, '');
      add('regen', m, /W/i.test(d) ? { dice: d.replace(/W/gi, 'd') } : { v: Number(d) }, { kind: 'fx' });
    });
    // Vorteil/Nachteil: nur Hinweis
    each(/\b(Vorteil|Nachteil)\s+(?:bei|auf|gegen|für)\s+([^.;·]+)/gi, (m) => add('adv', m, { k: `${m[1]} ${m[0].slice(m[1].length).trim()}`.replace(/\s+/g, ' ') }, { kind: 'hint' }));
    // Geld (nur Hervorhebung)
    if (opts.money !== false) each(/(\d+)\s*(GM|SM|KM|EM|PM|Goldmünzen|Silbermünzen|Kupfermünzen)\b/g, (m) => add('money', m, { v: Number(m[1]), k: { GM: 'gp', SM: 'sp', KM: 'cp', EM: 'ep', PM: 'pp' }[m[2]] || 'gp' }, { kind: 'money' }));
  }
  // Rohe Sätze ohne Treffer gar nicht erst merken; Ergebnis nach Position
  return out.sort((a, b) => a.s - b.s);
}
function weaponsIn(seg, vocab) {
  const low = ` ${seg.toLowerCase()} `;
  const out = [];
  if (/einfache[nr]?\s+(?:nah-\s*und\s+fernkampf)?waffen|einfachen\s+waffen/.test(low)) out.push('simple');
  if (/kriegswaffen/.test(low)) out.push('martial');
  for (const w of vocab.weapons || []) {
    const n = w.name.toLowerCase();
    if (new RegExp(`\\b${esc(n)}(?:e|en|n|s)?\\b`).test(low)) { out.push(w.key); continue; }
    // „Kurz- und Langbogen“: Wortanfang mit Bindestrich + gemeinsames Grundwort
    const suf = /(bogen|schwert|armbrust|hammer|axt|speer|picke|beil)$/.exec(n);
    if (suf) {
      const pre = n.slice(0, -suf[1].length);
      if (pre && new RegExp(`\\b${esc(pre)}-`).test(low) && low.includes(suf[1])) out.push(w.key);
    }
  }
  return [...new Set(out)];
}

// ───────────────────────── Hervorhebung ─────────────────────────
// Text in Abschnitte zerlegen: { text, fx? } – fx = erkannte Wirkung an dieser Stelle
export function fxSegments(text, list) {
  const src = String(text || '');
  const out = [];
  let at = 0;
  for (const f of list || []) {
    if (f.s == null || f.s < at) continue;
    if (f.s > at) out.push({ text: src.slice(at, f.s) });
    out.push({ text: src.slice(f.s, f.e), fx: f });
    at = f.e;
  }
  if (at < src.length) out.push({ text: src.slice(at) });
  return out;
}

// Wert in Worten: Zahl, Übungsbonus, Modifikator, Würfel
export function fxValText(v, { sign = true } = {}) {
  if (v == null || v === '') return '';
  const t = String(v);
  if (t === 'pb') return `${sign ? '+ ' : ''}Übungsbonus`;
  if (t === 'level') return `${sign ? '+ ' : ''}Stufe`;
  if (t === 'half') return `${sign ? '+ ' : ''}halbe Stufe`;
  if (t.startsWith('mod:')) { const k = t.slice(4); return `${sign ? '+ ' : ''}${k === 'spell' ? 'Zauberattribut' : ({ str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' }[k] || k)}-Mod.`; }
  if (/\d*[dW]\d/.test(t)) return `${sign && !/^[+-]/.test(t) ? '+' : ''}${t.replace(/d/g, 'W')}`;
  const n = Number.parseFloat(t.replace(',', '.'));
  return sign && n > 0 ? `+${t}` : t;
}
// Filter einer Angriffswirkung in Worten
export function fxFilterText(f) {
  const out = [];
  if (f.on && f.on !== 'all' && FX_ON[f.on]) out.push(FX_ON[f.on]);
  if (f.vs) out.push(`gegen ${f.vs}`);
  if (f.vsCond) out.push(`gegen Ziele mit „${condName(f.vsCond)}“`);
  if (f.hp && FX_HP[f.hp]) out.push(FX_HP[f.hp]);
  if (f.selfHp && FX_SELFHP[f.selfHp]) out.push(FX_SELFHP[f.selfHp]);
  if (f.adv) out.push('mit Vorteil');
  if (f.crit) out.push('nur bei kritischen Treffern');
  if (f.notActed) out.push('gegen Ziele, die noch nicht am Zug waren');
  if (f.ifType) out.push(`wenn du ${[].concat(f.ifType).map((k) => FX_DMG[k] || k).join('/')}schaden verursachst`);
  if (f.once) out.push('einmal pro Zug');
  return out.join(', ');
}
// Runden in Worten (10 Runden = 1 Minute)
export const durText = (r) => { const n = Number(r) || 0; if (n >= 600 && n % 600 === 0) return `${n / 600} Stunde${n / 600 > 1 ? 'n' : ''}`; if (n >= 10 && n % 10 === 0) return `${n / 10} Minute${n / 10 > 1 ? 'n' : ''}`; return `${n} Runde${n === 1 ? '' : 'n'}`; };
// Zustand/Effekt/eigener Zustand → Name
export function condName(c) {
  const t = String(c || '');
  if (t.startsWith('eff:')) return (ENGINE_EFFECTS[t.slice(4)] || t.slice(4)).replace(/\s*\(.*$/, '');
  if (t.startsWith('st:')) return CUSTOM_STATUS[t.slice(3)]?.name || t.slice(3);
  return t;
}

// Wirkung in Worten (für Listen und Tooltips)
export function fxLabel(f, { skillName = (k) => k, weaponName = (k) => k, dmgName = (k) => FX_DMG[k] || k } = {}) {
  const m = (ft) => `${String(Math.round(Number(ft) * TAU_FT * 10) / 10).replace('.', ',')} m`;
  const sg = (n) => fxValText(n);
  const list = (a, fn = (x) => x) => (Array.isArray(a) ? a : [a]).filter(Boolean).map(fn).join(', ');
  const ab = (k) => FX_AB[k] || k;
  const abS = (k) => ({ str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' }[k] || k);
  const cond = f.cond ? (COND_DE[f.cond] || (String(f.cond).startsWith('sp:') ? `nur Spezies ${f.cond.slice(3)}` : String(f.cond).startsWith('cls:') ? `nur Klasse ${f.cond.slice(4)}` : '')) : '';
  const tail = `${f.lvl ? ` (ab Stufe ${f.lvl})` : ''}${cond ? ` (${cond})` : ''}`;
  const filt = fxFilterText(f);
  const ft = filt ? ` (${filt})` : '';
  const rest = (r) => (r === 'short' ? 'kurzer' : r === 'dawn' ? 'Morgengrauen –' : 'langer');
  switch (f.t) {
    case 'speed': return `Bewegung ${sg(m(f.v))}${tail}`;
    case 'speedSet': return `Bewegungsrate ${m(f.v)}${tail}`;
    case 'move': return `${MOVE_DE[f.k] || f.k} ${f.v === 'walk' ? '= Bewegungsrate' : m(f.v)}${tail}`;
    case 'sense': return `${SENSE_DE[f.k] || f.k} ${m(f.v)}${tail}`;
    case 'reach': return `Nahkampfreichweite +${m(f.v || 5)}${tail}`;
    case 'speedMul': return `Bewegungsrate ×${f.v || 2}${tail}`;
    case 'ac': return `RK ${sg(f.v)}${tail}`;
    case 'acFormula': return `RK ohne Rüstung = ${f.v}${arr(f.k).length ? ` + ${list(f.k, (k) => ({ str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' }[k] || k)).replace(/, /g, ' + ')}` : ''}${tail}`;
    case 'acMin': return `RK mindestens ${f.v}${tail}`;
    case 'dexCap': return `GES in mittelschwerer Rüstung bis +${2 + (Number(f.v) || 1)}${tail}`;
    case 'stealthOk': return `Rüstung ohne Nachteil auf Heimlichkeit${tail}`;
    case 'resist': return `Resistenz: ${list(f.k, dmgName)}${f.nm ? ' (nur nichtmagisch)' : ''}${tail}`;
    case 'immune': return `Immun: ${list(f.k, dmgName)}${tail}`;
    case 'vuln': return `Anfällig: ${list(f.k, dmgName)}${tail}`;
    case 'condImm': return `Immun gegen ${list(f.k)}${tail}`;
    case 'dmgReduce': return `${arr(f.k).length ? `${list(f.k, dmgName)}schaden` : 'Schaden'} −${fxValText(f.v, { sign: false })}${f.nm ? ' (nur nichtmagisch)' : ''}${tail}`;
    case 'critImmune': return `Keine kritischen Treffer gegen dich${tail}`;
    case 'disAttackers': return `${f.on === 'melee' ? 'Nahkampfangriffe' : f.on === 'ranged' ? 'Fernkampfangriffe' : f.on === 'spell' ? 'Zauberangriffe' : 'Angriffe'} gegen dich im ${f.adv ? 'Vorteil' : 'Nachteil'}${f.vs ? ` (von ${f.vs})` : ''}${tail}`;
    case 'retaliate': return `Vergeltung: ${f.on === 'hit' ? 'wer dich trifft' : f.on === 'miss' ? 'wer dich verfehlt' : 'wer dich im Nahkampf trifft'}${f.dice || f.v ? ` erleidet ${fxValText(f.dice || f.v, { sign: false })} ${dmgName(f.type || 'force')}` : ''}${f.inflict ? ` · ${condName(f.inflict)}` : ''}${f.save ? ` (${abS(f.save)}-Rettungswurf${f.dc ? `, SG ${f.dc}` : ''})` : ''}${tail}`;
    case 'evasion': return `Entrinnen${tail}`;
    case 'endure': return `Bei 0 TP: ${f.dice ? `${fxValText(f.dice, { sign: false })} TP zurück` : 'stattdessen 1 TP'}, ${f.uses === 'pb' ? 'Übungsbonus-mal' : `${f.uses || 1}×`} pro ${rest(f.rest)} Rast${tail}`;
    case 'aura': return f.k === 'saveAdv' ? `Aura ${m(f.r || 10)}: Vorteil bei Rettungswürfen gegen Zauber für Verbündete${tail}` : `Aura ${m(f.r || 10)}: ${f.k === 'ac' ? 'RK' : f.k === 'heal' ? 'Heilung zu Zugbeginn' : 'Rettungswürfe'} ${fxValText(f.v)} für Verbündete${tail}`;
    case 'hpLevel': return `${sg(f.v)} TP pro Stufe${tail}`;
    case 'hp': return `${sg(f.v)} TP-Maximum${tail}`;
    case 'regen': return `Zugbeginn: ${fxValText(f.dice || f.v, { sign: false })} TP zurück${f.only === 'bloodied' ? ' (nur bei höchstens halben TP)' : ''}${tail}`;
    case 'tempStart': return `Zugbeginn: ${fxValText(f.v, { sign: false })} temporäre TP${tail}`;
    case 'healBonus': return f.max ? `Heilung immer maximal${tail}` : `Heilung ${sg(f.v)}${tail}`;
    case 'abil': return `${ab(f.k)} ${sg(f.v)}${f.max ? ` (höchstens ${f.max})` : ''}${tail}`;
    case 'abilSet': return `${ab(f.k)} = ${f.v} (falls niedriger)${tail}`;
    case 'init': return `Initiative ${f.v === 'pb' ? '+ Übungsbonus' : sg(f.v)}${tail}`;
    case 'saveProf': return `Übung: ${list(f.k, abS)}-Rettungswürfe${tail}`;
    case 'saveBonus': return `${sg(f.v)} auf ${arr(f.k).length ? `${list(f.k, (k) => (k === 'death' ? 'Todes' : k === 'conc' ? 'Konzentrations' : abS(k)))}-Rettungswürfe` : 'alle Rettungswürfe'}${f.vs ? ` gegen ${f.vs === 'spell' ? 'Zauber' : condName(f.vs)}` : ''}${tail}`;
    case 'saveAdv': return `${f.dis ? 'Nachteil' : 'Vorteil'} bei ${arr(f.k).length ? `${list(f.k, (k) => (k === 'death' ? 'Todes' : k === 'conc' ? 'Konzentrations' : abS(k)))}-Rettungswürfen` : 'Rettungswürfen'}${f.vs ? ` gegen ${f.vs === 'spell' ? 'Zauber' : f.vs === 'conc' ? 'Konzentrationsverlust' : condName(f.vs)}` : ''}${tail}`;
    case 'checkBonus': return `${list(f.k, (k) => (k === 'all' ? 'alle Attributswürfe' : k === 'init' ? 'Initiative' : FX_AB[k] ? `${ab(k)}-Würfe` : skillName(k)))} ${sg(f.v)}${tail}`;
    case 'checkAdv': return `${f.dis ? 'Nachteil' : 'Vorteil'}: ${list(f.k, (k) => (k === 'all' ? 'alle Attributswürfe' : k === 'init' ? 'Initiative' : FX_AB[k] ? `${ab(k)}-Würfe` : skillName(k)))}${tail}`;
    case 'jack': return `Halber Übungsbonus auf ungeübte Attributswürfe${tail}`;
    case 'dice': return `${list(f.k, (k) => DICE_FX[k] || k)}${tail}`;
    case 'skill': return `Übung: ${list(f.k, skillName)}${tail}`;
    case 'expertise': return `Expertise: ${list(f.k, skillName)}${tail}`;
    case 'weapon': return `Waffenübung: ${list(f.k, (k) => (k === 'simple' ? 'einfache Waffen' : k === 'martial' ? 'Kriegswaffen' : weaponName(k)))}${tail}`;
    case 'armor': return `Rüstungsübung: ${list(f.k, (k) => ({ light: 'leicht', medium: 'mittelschwer', heavy: 'schwer', shield: 'Schilde' }[k] || k))}${tail}`;
    case 'tool': return `Werkzeug: ${f.k}${tail}`;
    case 'lang': return f.n ? `${f.n} Sprache(n) nach Wahl` : `Sprachen: ${list(f.k)}${tail}`;
    case 'pick': return `Auswahl: ${f.n || 1}× ${PICK_DE[f.k] || f.k}${f.v ? ` (${sg(f.v)})` : ''}${arr(f.from).length ? ` aus ${arr(f.from).length} Möglichkeiten` : ''}${tail}`;
    case 'attack': return `${sg(f.v)} auf Angriffe${f.k && f.k !== 'all' ? ` (${FX_ON[f.k] || f.k})` : ''}${ft}${tail}`;
    case 'damage': return `${sg(f.v)} Schaden${f.k && f.k !== 'all' ? ` (${FX_ON[f.k] || f.k})` : ''}${ft}${tail}`;
    case 'dmgExtra': return f.dice === 'weapon' ? `+${f.n || 1} Waffenwürfel${ft}${tail}` : `Zusatzschaden ${fxValText(f.dice || f.v, { sign: false })}${f.dice && f.v ? ` ${fxValText(f.v)}` : ''} ${f.type ? dmgName(f.type) : '(Waffenschaden)'}${ft}${tail}`;
    case 'crit': return `Kritisch ab ${20 - (Number(f.v) || 1)}${f.on && f.on !== 'all' ? ` (${FX_ON[f.on] || f.on})` : ''}${tail}`;
    case 'advAttack': return `${f.dis ? 'Nachteil' : 'Vorteil'} bei Angriffen${ft}${tail}`;
    case 'onHit': return `Bei Treffer: ${[f.inflict ? `${condName(f.inflict)}${f.save ? ` (${abS(f.save)}-Rettungswurf${f.dc && f.dc !== 'auto' ? ` SG ${f.dc}` : ''})` : ''}${f.rounds ? ` für ${f.rounds} Runden` : ''}${f.self ? ' – für dich' : ''}` : '', f.heal ? `du heilst ${fxValText(f.heal, { sign: false })} TP` : '', f.temp ? `${fxValText(f.temp, { sign: false })} temporäre TP` : '', f.push ? `Stoß ${String(f.push).replace('.', ',')} m` : ''].filter(Boolean).join(' · ')}${ft}${tail}`;
    case 'ignoreResist': return `Ignoriert Resistenz: ${arr(f.k).length ? list(f.k, dmgName) : 'alle'}${ft}${tail}`;
    case 'attacks': return `${f.v} Angriffe pro Angriffsaktion${tail}`;
    case 'unarmed': return `Waffenloser Schlag ${String(f.dice || '1d4').replace(/d/g, 'W')}${f.type ? ` ${dmgName(f.type)}` : ''}${f.ab === 'dex' ? ' (GES)' : f.ab === 'str' ? ' (STÄ)' : ' (STÄ oder GES)'}${tail}`;
    case 'style': return `Kampfstil: ${list(f.k, (k) => STYLE_FX[k] || k)}${tail}`;
    case 'spell': return `Zauber: ${f.k}${f.lv === 0 ? ' (Zaubertrick)' : ''}${f.castLv ? ` (als ${f.castLv}. Grad)` : ''}${f.uses && f.uses !== 'will' && f.uses !== 'always' ? ` – ${f.uses === 'pb' ? 'Übungsbonus-mal' : f.uses === 'charges' ? `${f.cost || 1} Ladung(en)` : `${f.uses}×`}${f.uses === 'charges' ? '' : ` pro ${rest(f.rest)} Rast`}` : f.uses === 'always' ? ' (immer vorbereitet)' : ''}${tail}`;
    case 'spellDc': return `Zauber-SG ${sg(f.v)}${tail}`;
    case 'spellDmg': return `Zauberschaden ${sg(f.v)}${f.on === 'cantrip' ? ' (Zaubertricks)' : f.on && f.on !== 'all' ? ` (${f.on})` : ''}${f.ifType ? ` bei ${[].concat(f.ifType).map((k) => FX_DMG[k] || k).join('/')}schaden` : ''}${f.once ? ', einmal pro Zug' : ''}${tail}`;
    case 'slots': return `+${f.n || 1} Zauberplatz ${f.lv || 1}. Grad${tail}`;
    case 'res': return `${f.k || 'Fähigkeit'}: ${f.v === 'pb' ? 'Übungsbonus' : String(f.v).startsWith('mod:') ? `${FX_AB[String(f.v).slice(4)]}-Mod.` : f.v}× ${f.rest === 'dawn' ? `– ${f.regain ? `${String(f.regain).replace(/d/g, 'W')} neu` : 'neu'} im Morgengrauen` : `pro ${rest(f.rest)} Rast`}${tail}`;
    case 'resMax': return `${f.k || 'Ressource'} ${sg(f.v || 1)}${tail}`;
    case 'bonusAct': return `Als Bonusaktion: ${list(f.k, (k) => BONUS_ACTS[k] || k)}${tail}`;
    case 'action': {
      const w = String(f.dice || '').replace(/d/g, 'W');
      const n = f.uses === 'pb' ? 'Übungsbonus-mal' : String(f.uses).startsWith('mod:') ? `${FX_AB[String(f.uses).slice(4)]}-Mod.-mal` : `${f.uses}×`;
      const what = f.kind === 'heal' ? `Heilung ${w}` : f.kind === 'save' ? `Rettungswurf auf ${FX_AB[f.save] || 'Geschicklichkeit'}, ${w} ${dmgName(f.type)}` : f.kind === 'weapon' ? `Waffenangriff${w ? ` +${w} ${f.type ? dmgName(f.type) : ''}` : ''}` : f.kind === 'buff' ? `Wirkung für ${f.dur === 'toggle' ? 'beliebig lange' : f.dur === 'conc' ? 'Konzentration' : durText(f.rounds || 10)}` : f.kind === 'temp' ? `temporäre TP ${w}` : f.kind === 'restore' ? (f.what === 'res' ? `${f.res || 'Ressource'} +${f.n || 1}` : `Zauberplatz bis ${f.lvMax || 9}. Grad zurück`) : f.kind === 'mark' ? `Markieren${w ? ` (+${w})` : ''}` : f.kind === 'react' ? `Reaktion bei Treffer` : `Angriff ${w} ${dmgName(f.type)}`;
      return `Aktion: ${f.k || 'ohne Namen'} (${what}${f.inflict ? `, ${condName(f.inflict)}` : ''}${f.pool ? `, kostet ${f.poolCost || 1} ${f.pool}` : f.uses && f.uses !== 'will' ? `, ${n} pro ${rest(f.rest)} Rast` : ''})${tail}`;
    }
    case 'adv': return String(f.k || 'Vorteil');
    case 'money': return `${f.v} ${({ gp: 'GM', sp: 'SM', cp: 'KM', ep: 'EM', pp: 'PM' })[f.k] || 'GM'}`;
    default: return f.t;
  }
}
export const PICK_DE = { skill: 'Fertigkeit', expertise: 'Expertise', ability: 'Attribut', save: 'Rettungswurf-Übung', weapon: 'Waffenübung', armor: 'Rüstungsübung', tool: 'Werkzeug', lang: 'Sprache', dmg: 'Schadensart', spell: 'Zauber', cantrip: 'Zaubertrick', style: 'Kampfstil' };
function arr(v) { return Array.isArray(v) ? v : v == null || v === '' ? [] : [v]; }

// ───────────────────────── Zusammenfassen ─────────────────────────
// Zahlenwert einer Wirkung: Zahl, 'pb', 'level', 'half', 'mod:str' … 'mod:spell'. Würfel bleiben Text (isDice).
export const isDice = (v) => typeof v === 'string' && /^\s*[+]?\s*\d*\s*[dW]\s*\d+/.test(v);
export function fxVal(v, ctx = {}) {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').trim();
  if (!t) return 0;
  if (t === 'pb') return Number(ctx.pb) || 2;
  if (t === 'level') return Number(ctx.level) || 1;
  if (t === 'half') return Math.floor((Number(ctx.level) || 1) / 2);
  if (t.startsWith('mod:')) { const k = t.slice(4); return k === 'spell' ? Number(ctx.spellMod) || 0 : Number(ctx.mods?.[k]) || 0; }
  const n = Number(t.replace(',', '.').replace(/^\+/, ''));
  return Number.isFinite(n) ? n : 0;
}
// Würfel-Platzhalter: „PBd4“, „LVd6“, „HLd6“ (halbe Stufe, aufgerundet), „2d6+MOD“ → echte Würfel
export function fxDice(d, ctx = {}) {
  return String(d || '').replace(/\s+/g, '').replace(/[Ww](?=\d)/g, 'd')
    .replace(/\bHL/gi, String(Math.ceil((Number(ctx.level) || 1) / 2))).replace(/\bPB|ÜB/gi, String(Number(ctx.pb) || 2)).replace(/\bLV|STUFE/gi, String(Number(ctx.level) || 1))
    .replace(/MOD/gi, String(Number(ctx.mod) || 0)).replace(/\+-/g, '-');
}
// Bedingungen: ctx { armor: 'none'|'clothing'|'light'|'medium'|'heavy', shield, species, classes, dyn: { conc, bloodied, raging } }
export function condOk(cond, ctx = {}) {
  const a = ctx.armor || 'none';
  const unarmored = a === 'none' || a === 'clothing';
  if (cond === 'noHeavy') return a !== 'heavy';
  if (cond === 'unarmored') return unarmored;
  if (cond === 'unarmoredNoShield') return unarmored && !ctx.shield;
  if (cond === 'noShield') return !ctx.shield;
  if (cond === 'armored') return !unarmored;
  if (cond === 'heavy') return a === 'heavy';
  if (cond === 'shield') return !!ctx.shield;
  if (DYN_CONDS.includes(cond)) return !!ctx.dyn?.[cond];
  const s = String(cond || '');
  if (s.startsWith('sp:')) return !ctx.species || ctx.species === s.slice(3);
  if (s.startsWith('cls:')) return !ctx.classes || ctx.classes.includes(s.slice(4));
  return true;
}
// Wirkungen, die nur für Angriffe mit einer bestimmten Waffe gelten, wenn sie an dieser Waffe hängen
export const ATTACK_SCOPED = new Set(['attack', 'damage', 'dmgExtra', 'crit', 'advAttack', 'onHit', 'ignoreResist']);
const FILTERS = ['vs', 'vsCond', 'hp', 'selfHp', 'adv', 'crit', 'once', 'ifType', 'notActed'];
export const hasFilter = (f) => FILTERS.some((k) => f[k]);
export function emptySummary() {
  return {
    speed: 0, speedSet: 0, speedMul: 1, move: {}, sense: {}, reach: 0, resistNm: new Set(), ac: 0, acF: [], acMin: 0, dexCap: 0, stealthOk: false,
    hpLevel: 0, hp: 0, init: 0, abil: {}, abilCapped: [], abilSet: {}, saveProf: new Set(), saveBonus: 0, saveBonusAb: {}, saveCond: [], saveAdv: [],
    checkBonus: {}, checkAdv: new Set(), checkDis: new Set(), jack: false, diceFx: new Set(),
    skill: new Set(), exp: new Set(), tools: [], weapons: new Set(), armor: new Set(), lang: new Set(), langChoice: 0,
    resist: new Set(), immune: new Set(), vuln: new Set(), condImm: new Set(), dmgRed: [], critImmune: false, atkAgainst: [], retaliate: [], evasion: false, endure: [], aura: [],
    adv: [], atk: { all: 0, melee: 0, ranged: 0, spell: 0, weapon: 0, unarmed: 0, thrown: 0 }, dmg: { all: 0, melee: 0, ranged: 0, weapon: 0, unarmed: 0, thrown: 0 },
    atkCond: [], dmgExtra: [], crit: [], advAtk: [], onHit: [], ignoreRes: [], unarmed: null, styles: new Set(),
    spellDc: 0, spellDmg: [], healBonus: 0, healMax: false, slots: {}, regen: [], tempStart: [],
    spells: [], res: [], resMax: [], bonusAct: new Set(), attacks: 1, actions: [], picks: [], byItem: {}, dynamic: [], applied: [],
  };
}
// ctx: { level, pb, mods, spellMod, armor, shield, species, classes, dyn }
export function fxSummary(list, ctx = {}) {
  const s = emptySummary();
  const lvl = Number(ctx.level) || 1;
  const V = (v) => fxVal(v, { ...ctx, level: lvl });
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  for (const f of list || []) {
    if (!f || f.active === false) continue;
    if (f.lvl && lvl < f.lvl) continue;
    if (f.cond) {
      // Kampfbedingungen (Konzentration, halbe TP, Kampfrausch) erst im Kampf – bis dahin nur merken
      if (DYN_CONDS.includes(f.cond) && !ctx.dyn) { s.dynamic.push(f); continue; }
      if (!condOk(f.cond, ctx)) continue;
    }
    // An einer Waffe: gilt nur für Angriffe mit genau dieser Waffe
    if (f.item && ATTACK_SCOPED.has(f.t)) { (s.byItem[f.item] ||= []).push(f); s.applied.push(f); continue; }
    switch (f.t) {
      case 'speed': s.speed += V(f.v); break;
      case 'speedSet': s.speedSet = Math.max(s.speedSet, V(f.v)); break;
      case 'move': if (f.k) s.move[f.k] = f.v === 'walk' ? 'walk' : Math.max(Number(s.move[f.k]) || 0, V(f.v)); break;
      case 'sense': if (f.k) s.sense[f.k] = Math.max(s.sense[f.k] || 0, V(f.v)); break;
      case 'reach': s.reach = Math.max(s.reach, V(f.v || 5)); break;
      case 'speedMul': s.speedMul = Math.max(s.speedMul, Number(f.v) || 2); break;
      case 'ac': s.ac += V(f.v); break;
      case 'acFormula': s.acF.push({ base: Number(f.v) || 10, abs: arr(f.k), shield: f.shield !== false, name: f.src || '' }); break;
      case 'acMin': s.acMin = Math.max(s.acMin, V(f.v)); break;
      case 'dexCap': s.dexCap = Math.max(s.dexCap, V(f.v || 1)); break;
      case 'stealthOk': s.stealthOk = true; break;
      case 'hpLevel': s.hpLevel += V(f.v); break;
      case 'hp': s.hp += V(f.v); break;
      case 'regen': s.regen.push({ ...f, dice: isDice(f.dice || f.v) ? String(f.dice || f.v) : '', v: isDice(f.v) ? 0 : V(f.v) }); break;
      case 'tempStart': s.tempStart.push({ ...f, v: V(f.v) }); break;
      case 'healBonus': if (f.max) s.healMax = true; else s.healBonus += V(f.v); break;
      case 'abil': if (f.k) { if (f.max) s.abilCapped.push({ k: f.k, v: V(f.v), max: Number(f.max) }); else s.abil[f.k] = (s.abil[f.k] || 0) + V(f.v); } break;
      case 'abilSet': if (f.k) s.abilSet[f.k] = Math.max(s.abilSet[f.k] || 0, V(f.v)); break;
      case 'init': s.init += V(f.v); break;
      case 'saveProf': arr(f.k).forEach((k) => s.saveProf.add(k)); break;
      case 'saveBonus':
        if (f.vs || isDice(f.v)) s.saveCond.push({ ...f, v: isDice(f.v) ? f.v : V(f.v) });
        else if (arr(f.k).length) arr(f.k).forEach((k) => { s.saveBonusAb[k] = (s.saveBonusAb[k] || 0) + V(f.v); });
        else s.saveBonus += V(f.v);
        break;
      case 'saveAdv': s.saveAdv.push({ k: arr(f.k), vs: f.vs || '', dis: !!f.dis, src: f.src || '' }); break;
      case 'checkBonus': arr(f.k).forEach((k) => { s.checkBonus[k] = (s.checkBonus[k] || 0) + V(f.v); }); break;
      case 'checkAdv': arr(f.k).forEach((k) => (f.dis ? s.checkDis : s.checkAdv).add(k)); break;
      case 'jack': s.jack = true; break;
      case 'dice': arr(f.k).forEach((k) => s.diceFx.add(k)); break;
      case 'skill': arr(f.k).forEach((k) => s.skill.add(k)); break;
      case 'expertise': arr(f.k).forEach((k) => s.exp.add(k)); break;
      case 'weapon': arr(f.k).forEach((k) => s.weapons.add(k)); break;
      case 'armor': arr(f.k).forEach((k) => s.armor.add(k)); break;
      case 'tool': if (f.k) s.tools.push(String(f.k)); break;
      case 'lang': arr(f.k).forEach((k) => s.lang.add(k)); break;
      case 'pick': s.picks.push(f); break;
      case 'resist': arr(f.k).forEach((k) => (f.nm ? s.resistNm : s.resist).add(k)); break;
      case 'immune': arr(f.k).forEach((k) => s.immune.add(k)); break;
      case 'vuln': arr(f.k).forEach((k) => s.vuln.add(k)); break;
      case 'condImm': arr(f.k).forEach((k) => s.condImm.add(k)); break;
      case 'dmgReduce': s.dmgRed.push({ k: arr(f.k), v: isDice(f.v) ? f.v : V(f.v), nm: !!f.nm, src: f.src || '' }); break;
      case 'critImmune': s.critImmune = true; break;
      case 'disAttackers': s.atkAgainst.push({ on: f.on || 'all', vs: f.vs || '', adv: !!f.adv, src: f.src || '' }); break;
      case 'retaliate': s.retaliate.push({ ...f, v: isDice(f.v) ? f.v : V(f.v) }); break;
      case 'evasion': s.evasion = true; break;
      case 'endure': s.endure.push({ ...f }); break;
      case 'aura': s.aura.push({ k: f.k || 'save', v: isDice(f.v) ? f.v : Math.max(Number(f.min) || -99, V(f.v)), min: Number(f.min) || 0, r: Number(f.r) || 10, src: f.src || '' }); break;
      case 'attack':
        if (hasFilter(f) || isDice(f.v)) s.atkCond.push({ ...f, v: isDice(f.v) ? String(f.v) : V(f.v) });
        else s.atk[f.k || 'all'] = (s.atk[f.k || 'all'] || 0) + V(f.v);
        break;
      case 'damage':
        if (hasFilter(f) || isDice(f.v)) s.dmgExtra.push({ ...f, on: f.on || f.k || 'all', dice: isDice(f.v) ? String(f.v) : '', v: isDice(f.v) ? 0 : V(f.v), type: '' });
        else s.dmg[f.k || 'all'] = (s.dmg[f.k || 'all'] || 0) + V(f.v);
        break;
      case 'dmgExtra': s.dmgExtra.push({ ...f, dice: f.dice || (isDice(f.v) ? String(f.v) : ''), v: isDice(f.v) ? 0 : V(f.v) }); break;
      case 'crit': s.crit.push({ v: Number(f.v) || 1, on: f.on || 'all', item: f.item || null }); break;
      case 'advAttack': s.advAtk.push({ ...f }); break;
      case 'onHit': s.onHit.push({ ...f }); break;
      case 'ignoreResist': s.ignoreRes.push({ k: arr(f.k), on: f.on || 'all' }); break;
      case 'attacks': s.attacks = Math.max(s.attacks, Number(f.v) || 1); break;
      case 'unarmed': if (!s.unarmed || (dieSize(f.dice) > dieSize(s.unarmed.dice))) s.unarmed = { dice: f.dice || '1d4', ab: f.ab || 'best', type: f.type || 'bludgeoning' }; break;
      case 'style': arr(f.k).forEach((k) => s.styles.add(k)); break;
      case 'spell': if (f.k) s.spells.push({ name: String(f.k), lv: f.lv ?? 1, src: f.src || '', uses: f.uses || (f.lv === 0 ? 'will' : 1), rest: f.rest || 'long', castLv: Number(f.castLv) || 0, dc: Number(f.dc) || 0, atk: f.atk ?? null, cost: Number(f.cost) || 1, pool: f.pool || '', item: f.itemId || null }); break;
      case 'spellDc': s.spellDc += V(f.v); break;
      case 'spellDmg': s.spellDmg.push({ ...f, v: V(f.v) }); break;
      case 'slots': s.slots[Number(f.lv) || 1] = (s.slots[Number(f.lv) || 1] || 0) + (Number(f.n) || 1); break;
      case 'res': s.res.push({ name: f.k || f.src || 'Fähigkeit', v: f.v, rest: f.rest || 'long', regain: f.regain || '', src: f.src || '', info: f.info || '', itemId: f.itemId || null }); break;
      case 'resMax': s.resMax.push({ k: f.k || '', v: V(f.v || 1) }); break;
      case 'bonusAct': arr(f.k).forEach((k) => s.bonusAct.add(k)); break;
      case 'action': if (f.k) s.actions.push({ ...f, src: f.src || '' }); break;
      default: break;
    }
    s.applied.push(f);
  }
  // Hinweise (Vorteil/Nachteil) sammeln, auch wenn sie nicht „aktiv“ rechnen
  for (const f of list || []) if (f?.t === 'adv' && (!f.lvl || lvl >= f.lvl)) s.adv.push({ text: f.k, src: f.src || '' });
  for (const f of list || []) if (f?.t === 'lang' && f.n && (!f.lvl || lvl >= f.lvl)) s.langChoice += Number(f.n) || 0;
  return s;
}
const dieSize = (d) => Number((/d(\d+)/.exec(String(d || '')) || [])[1]) || 0;
// Bedingte Angriffswirkung: passt sie zu diesem Angriff? info: { on (melee|ranged|spell|unarmed|thrown), weapon, cantrip, type (Kreaturentyp), size, conds [], hp, maxHp, selfHp, selfMax, adv, crit, dmgTypes [], sneak, notActed }
export function fxMatches(f, info = {}) {
  const on = f.on || f.k || 'all';
  if (on !== 'all' && on !== 'any') {
    if (on === 'weapon' && !info.weapon) return false;
    if (on === 'melee' && info.on !== 'melee') return false;
    if (on === 'ranged' && info.on !== 'ranged') return false;
    if (on === 'unarmed' && info.on !== 'unarmed') return false;
    if (on === 'thrown' && !info.thrown) return false;
    if (on === 'spell' && info.on !== 'spell') return false;
    if (on === 'cantrip' && !info.cantrip) return false;
    if (on === 'sneak' && !info.sneak) return false;
  }
  if (f.vs && !vsMatch(f.vs, info)) return false;
  if (f.vsCond && !(info.conds || []).some((c) => String(c).toLowerCase() === condName(f.vsCond).toLowerCase())) return false;
  if (f.hp === 'full' && !(info.maxHp && info.hp >= info.maxHp)) return false;
  if (f.hp === 'hurt' && !(info.maxHp && info.hp < info.maxHp)) return false;
  if (f.hp === 'half' && !(info.maxHp && info.hp <= info.maxHp / 2)) return false;
  if (f.selfHp === 'hurt' && !(info.selfMax && info.selfHp < info.selfMax)) return false;
  if (f.selfHp === 'half' && !(info.selfMax && info.selfHp <= info.selfMax / 2)) return false;
  if (f.adv && info.adv !== true) return false;
  if (f.crit && !info.crit) return false;
  if (f.notActed && !info.notActed) return false;
  if (f.ifType && ![].concat(f.ifType).some((t) => (info.dmgTypes || []).includes(t))) return false;
  return true;
}
// „gegen Untote, Unholde“, „gegen große Kreaturen“ – Kreaturentyp bzw. Größe des Ziels
const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
export function vsMatch(vs, info = {}) {
  const words = String(vs).toLowerCase().split(/[,;/]|\s+oder\s+|\s+und\s+/).map((w) => w.trim()).filter(Boolean);
  const type = String(info.type || '').toLowerCase();
  const size = info.size || 'medium';
  return words.some((w) => {
    const sz = /^(winzig|klein|mittelgroß|groß|riesig|gigantisch)(\+|\s*oder\s+größer)?/.exec(w);
    if (sz) {
      const i = ['winzig', 'klein', 'mittelgroß', 'groß', 'riesig', 'gigantisch'].indexOf(sz[1]);
      const j = SIZE_ORDER.indexOf(size);
      return sz[2] ? j >= i : j === i;
    }
    const stem = w.replace(/(en|n|e|s)$/, '').slice(0, Math.max(4, w.length - 2));
    return !!stem && (type.includes(stem) || (info.name || '').toLowerCase().includes(stem) || (info.tags || []).some((t) => String(t).toLowerCase().includes(stem)));
  });
}

// Kurzhilfe für den Editor: welche Formulierungen wirken
export const FX_HELP = [
  ['Bewegung', '„+3 m Bewegung“, „Bewegungsrate 10,5 m“, „Flugbewegung 9 m“, „Schwimmbewegung gleich deiner Bewegungsrate“'],
  ['Sinne', '„Dunkelsicht 18 m“, „Blindsicht 3 m“, „Erschütterungssinn 9 m“, „Wahrer Blick 18 m“'],
  ['Rüstungsklasse', '„+1 RK“, „+1 auf die Rüstungsklasse, solange du eine Rüstung trägst“, „RK = 13 + GES“ (ohne Rüstung)'],
  ['Trefferpunkte', '„+1 TP pro Stufe“, „+5 TP-Maximum“'],
  ['Attribute & Würfe', '„+1 Weisheit“, „STÄ +2“, „+5 Initiative“, „Übungsbonus auf die Initiative“, „Übung in Weisheits-Rettungswürfen“, „+1 auf alle Rettungswürfe“'],
  ['Übungen', '„Übung in Heimlichkeit und Wahrnehmung“, „Expertise in Athletik“, „Übung mit Kriegswaffen“, „Übung mit leichter Rüstung und Schilden“, „Übung mit Diebeswerkzeug“'],
  ['Sprachen', '„Du sprichst Elfisch und Zwergisch“, „eine weitere Sprache deiner Wahl“'],
  ['Verteidigung', '„Resistenz gegen Feuerschaden“, „Immunität gegen Gift“, „Immun gegen den Zustand Bezaubert“, „kann nicht verängstigt werden“'],
  ['Angriff', '„+2 auf Angriffswürfe mit Fernkampfwaffen“, „+2 Schaden mit Nahkampfwaffen“, „greifst du zweimal an“'],
  ['Zauber', '„Du kennst den Zaubertrick Thaumaturgie“, „St. 3 Höllischer Tadel“ (ab Stufe 3, 1× pro langer Rast)'],
  ['Ressourcen', '„1× pro langer Rast“, „Übungsbonus-mal pro kurzer Rast“, „Charisma-Modifikator-mal pro langer Rast“ – der Name des Merkmals wird zur Ressource'],
  ['Angriff & Schaden', '„zusätzlich 1W6 Feuerschaden“ (bei Waffen und Gegenständen: gilt für diese Waffe), „zusätzlich 1W8 gleißender Schaden gegen Untote“, „kritischer Treffer bei 19 oder 20“, „ignoriert Resistenz gegen Hiebschaden“'],
  ['Zauber', '„+1 auf den SG deiner Zauber“, „Zauber-SG +1“'],
  ['Rettungswürfe', '„Vorteil bei Rettungswürfen gegen Zauber“, „Vorteil auf Konstitutions-Rettungswürfe“, „Vorteil bei Rettungswürfen gegen Vergiftet“, „+1 auf GES-Rettungswürfe“, „+2 auf Rettungswürfe gegen Zauber“'],
  ['Fertigkeiten', '„Vorteil auf Heimlichkeit“, „Vorteil auf Würfe für Wahrnehmung“, „Heimlichkeit +1“, „+2 auf Überzeugen“'],
  ['Verteidigung (Gegenstände)', '„Du erleidest 1 weniger Hiebschaden“, „kritische Treffer gegen dich werden zu normalen Treffern“, „zu Beginn deines Zuges erhältst du 1W4 TP zurück“'],
  ['Attribute festsetzen', '„Stärke wird auf 19 gesetzt“, „Charisma +2 (höchstens 22)“'],
  ['Stufe', '„(ab Stufe 5)“ im Namen oder Satz: gilt erst ab dieser Stufe'],
  ['Nur Hinweis', 'Sätze mit „Bonusaktion“, „Reaktion“, „für 10 Minuten“, „wenn …“, „solange …“ oder einer Auswahl („oder“, „deiner Wahl“) wirken nicht automatisch – sie bleiben Regeltext. Prüfbar sind „ohne schwere Rüstung“, „ohne Rüstung“, „solange du eine Rüstung trägst“ und „mit Schild“.'],
];
