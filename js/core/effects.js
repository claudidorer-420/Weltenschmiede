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
  { t: 'ac', label: 'Rüstungsklasse (+/−)', group: 'Verteidigung', ex: '+1 RK · +1 auf die Rüstungsklasse, solange du eine Rüstung trägst', v: 'n' },
  { t: 'acFormula', label: 'Rüstungsklasse ohne Rüstung (Formel)', group: 'Verteidigung', ex: 'RK = 13 + GES · RK = 10 + GES + KON', v: 'n', k: 'ab' },
  { t: 'resist', label: 'Resistenz', group: 'Verteidigung', ex: 'Resistenz gegen Feuerschaden · Resistenz gegen Hieb-, Stich- und Wuchtschaden', k: 'dmg' },
  { t: 'immune', label: 'Immunität (Schaden)', group: 'Verteidigung', ex: 'Immunität gegen Giftschaden', k: 'dmg' },
  { t: 'vuln', label: 'Anfälligkeit', group: 'Verteidigung', ex: 'Anfälligkeit gegen Gleißend-Schaden', k: 'dmg' },
  { t: 'condImm', label: 'Immun gegen Zustand', group: 'Verteidigung', ex: 'Immun gegen den Zustand Vergiftet · kann nicht bezaubert werden', k: 'cond' },
  { t: 'hpLevel', label: 'Trefferpunkte pro Stufe', group: 'Trefferpunkte', ex: '+1 TP pro Stufe · TP-Maximum +2 je Stufe', v: 'n' },
  { t: 'hp', label: 'Trefferpunkte (einmalig)', group: 'Trefferpunkte', ex: '+5 TP-Maximum', v: 'n' },
  { t: 'abil', label: 'Attributswert (+/−)', group: 'Attribute & Würfe', ex: '+1 Weisheit · STÄ +2', k: 'ab', v: 'n' },
  { t: 'init', label: 'Initiative', group: 'Attribute & Würfe', ex: '+5 Initiative · Übungsbonus auf die Initiative', v: 'n' },
  { t: 'saveProf', label: 'Übung in Rettungswürfen', group: 'Attribute & Würfe', ex: 'Übung in Weisheits-Rettungswürfen', k: 'ab' },
  { t: 'saveBonus', label: 'Bonus auf alle Rettungswürfe', group: 'Attribute & Würfe', ex: '+1 auf alle Rettungswürfe', v: 'n' },
  { t: 'skill', label: 'Fertigkeit (Übung)', group: 'Übungen', ex: 'Übung in Heimlichkeit und Wahrnehmung', k: 'skill' },
  { t: 'expertise', label: 'Expertise', group: 'Übungen', ex: 'Expertise in Athletik · doppelter Übungsbonus auf Geschichte', k: 'skill' },
  { t: 'weapon', label: 'Waffenübung', group: 'Übungen', ex: 'Übung mit Kriegswaffen · Übung mit Langschwert und Langbogen', k: 'weapon' },
  { t: 'armor', label: 'Rüstungsübung', group: 'Übungen', ex: 'Übung mit leichter und mittelschwerer Rüstung sowie Schilden', k: 'armor' },
  { t: 'tool', label: 'Werkzeug', group: 'Übungen', ex: 'Übung mit Diebeswerkzeug', k: 'text' },
  { t: 'lang', label: 'Sprache', group: 'Übungen', ex: 'Du sprichst Elfisch und Zwergisch · eine weitere Sprache deiner Wahl', k: 'lang' },
  { t: 'attack', label: 'Angriffsbonus', group: 'Angriff', ex: '+2 auf Angriffswürfe mit Fernkampfwaffen', v: 'n', k: ['all', 'melee', 'ranged', 'spell'] },
  { t: 'damage', label: 'Schadensbonus', group: 'Angriff', ex: '+2 Schaden mit Nahkampfwaffen', v: 'n', k: ['all', 'melee', 'ranged'] },
  { t: 'attacks', label: 'Angriffe pro Angriffsaktion', group: 'Angriff', ex: 'greifst du zweimal an', v: 'n' },
  { t: 'spell', label: 'Zauber (angeboren)', group: 'Zauber & Ressourcen', ex: 'Du kennst den Zaubertrick Thaumaturgie · St. 3 Höllischer Tadel', k: 'text' },
  { t: 'res', label: 'Begrenzte Nutzung (Ressource)', group: 'Zauber & Ressourcen', ex: '1× pro langer Rast · Übungsbonus-mal pro kurzer Rast', v: 'n' },
  { t: 'action', label: 'Eigene Aktion (Angriff, Odem, Heilung …)', group: 'Aktionen', ex: 'Odemwaffe: Kegel 4,5 m, GES-Rettungswurf, 2W6 Feuer · Klauen: Nahkampfangriff 1W6 Hieb · Heilende Hände: Heilung', k: 'text' },
  { t: 'adv', label: 'Vorteil / Nachteil (Hinweis)', group: 'Hinweise', ex: 'Vorteil bei Rettungswürfen gegen Vergiftet', k: 'text' },
];
export const FX_BY = Object.fromEntries(FX_TYPES.map((x) => [x.t, x]));
export const MOVE_DE = { fly: 'Fliegen', swim: 'Schwimmen', climb: 'Klettern', burrow: 'Graben' };
export const SENSE_DE = { dark: 'Dunkelsicht', blind: 'Blindsicht', tremor: 'Erschütterungssinn', true: 'Wahrer Blick' };

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
      const hint = kind === 'res' ? null : kind || (t === 'adv' ? 'hint' : situational ? 'cond' : null);
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
    each(new RegExp(`([+−–-]\\s*\\d+)\\s*(?:auf\\s+(?:deine\\s+|dein\\s+)?)?${AB_RE}(?![-\\w])`, 'gi'), (m) => add('abil', m, { k: abOf(m[2]), v: num(m[1]), ...(choice ? { choice: true } : {}) }));
    each(new RegExp(`${AB_RE}\\s*([+−–-]\\s*\\d+)(?!\\d|,\\d)`, 'gi'), (m) => add('abil', m, { k: abOf(m[1]), v: num(m[2]), ...(choice ? { choice: true } : {}) }));
    // Angriff und Schaden
    each(/([+−–-]\s*\d+)\s*(?:auf\s+)?(?:alle\s+)?(?:deine\s+)?(?:Angriffswürfe|Angriffe)(?:\s+mit\s+(Fernkampfwaffen|Nahkampfwaffen|Waffen|Zaubern))?/gi, (m) => add('attack', m, { v: num(m[1]), k: /fern/i.test(m[2] || '') ? 'ranged' : /nah/i.test(m[2] || '') ? 'melee' : /zauber/i.test(m[2] || '') ? 'spell' : 'all' }));
    each(/([+−–-]\s*\d+)\s*(?:auf\s+(?:den\s+)?)?(?:Schaden|Schadenswürfe)(?:\s+(?:mit|bei)\s+(Fernkampfwaffen|Nahkampfwaffen|Waffen))?/gi, (m) => add('damage', m, { v: num(m[1]), k: /fern/i.test(m[2] || '') ? 'ranged' : /nah/i.test(m[2] || '') ? 'melee' : 'all' }));
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

// Wirkung in Worten (für Listen und Tooltips)
export function fxLabel(f, { skillName = (k) => k, weaponName = (k) => k, dmgName = (k) => FX_DMG[k] || k } = {}) {
  const m = (ft) => `${String(Math.round(Number(ft) * TAU_FT * 10) / 10).replace('.', ',')} m`;
  const sg = (n) => (typeof n === 'string' && !/^[+-]?\d/.test(n) ? n : Number.parseFloat(String(n).replace(',', '.')) > 0 ? `+${n}` : String(n));
  const list = (a, fn = (x) => x) => (Array.isArray(a) ? a : [a]).filter(Boolean).map(fn).join(', ');
  const tail = `${f.lvl ? ` (ab Stufe ${f.lvl})` : ''}${f.cond === 'noHeavy' ? ' (ohne schwere Rüstung)' : f.cond === 'unarmored' ? ' (ohne Rüstung)' : f.cond === 'armored' ? ' (in Rüstung)' : f.cond === 'shield' ? ' (mit Schild)' : ''}`;
  switch (f.t) {
    case 'speed': return `Bewegung ${sg(m(f.v))}${tail}`;
    case 'speedSet': return `Bewegungsrate ${m(f.v)}${tail}`;
    case 'move': return `${MOVE_DE[f.k] || f.k} ${f.v === 'walk' ? '= Bewegungsrate' : m(f.v)}${tail}`;
    case 'sense': return `${SENSE_DE[f.k] || f.k} ${m(f.v)}${tail}`;
    case 'ac': return `RK ${sg(f.v)}${tail}`;
    case 'acFormula': return `RK ohne Rüstung = ${f.v} + ${list(f.k, (k) => ({ str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' }[k] || k)).replace(/, /g, ' + ')}${tail}`;
    case 'resist': return `Resistenz: ${list(f.k, dmgName)}${tail}`;
    case 'immune': return `Immun: ${list(f.k, dmgName)}${tail}`;
    case 'vuln': return `Anfällig: ${list(f.k, dmgName)}${tail}`;
    case 'condImm': return `Immun gegen ${list(f.k)}${tail}`;
    case 'hpLevel': return `${sg(f.v)} TP pro Stufe${tail}`;
    case 'hp': return `${sg(f.v)} TP-Maximum${tail}`;
    case 'abil': return `${FX_AB[f.k] || f.k} ${sg(f.v)}${tail}`;
    case 'init': return `Initiative ${f.v === 'pb' ? '+ Übungsbonus' : sg(f.v)}${tail}`;
    case 'saveProf': return `Übung: ${list(f.k, (k) => FX_AB[k] || k)}-Rettungswürfe${tail}`;
    case 'saveBonus': return `${sg(f.v)} auf alle Rettungswürfe${tail}`;
    case 'skill': return `Übung: ${list(f.k, skillName)}${tail}`;
    case 'expertise': return `Expertise: ${list(f.k, skillName)}${tail}`;
    case 'weapon': return `Waffenübung: ${list(f.k, (k) => (k === 'simple' ? 'einfache Waffen' : k === 'martial' ? 'Kriegswaffen' : weaponName(k)))}${tail}`;
    case 'armor': return `Rüstungsübung: ${list(f.k, (k) => ({ light: 'leicht', medium: 'mittelschwer', heavy: 'schwer', shield: 'Schilde' }[k] || k))}${tail}`;
    case 'tool': return `Werkzeug: ${f.k}${tail}`;
    case 'lang': return f.n ? `${f.n} Sprache(n) nach Wahl` : `Sprachen: ${list(f.k)}${tail}`;
    case 'attack': return `${sg(f.v)} auf Angriffe${f.k === 'ranged' ? ' (Fernkampf)' : f.k === 'melee' ? ' (Nahkampf)' : f.k === 'spell' ? ' (Zauber)' : ''}${tail}`;
    case 'damage': return `${sg(f.v)} Schaden${f.k === 'ranged' ? ' (Fernkampf)' : f.k === 'melee' ? ' (Nahkampf)' : ''}${tail}`;
    case 'attacks': return `${f.v} Angriffe pro Angriffsaktion${tail}`;
    case 'spell': return `Zauber: ${f.k}${f.lv === 0 ? ' (Zaubertrick)' : ''}${tail}`;
    case 'res': return `${f.k || 'Fähigkeit'}: ${f.v === 'pb' ? 'Übungsbonus' : String(f.v).startsWith('mod:') ? `${FX_AB[String(f.v).slice(4)]}-Mod.` : f.v}× pro ${f.rest === 'short' ? 'kurzer' : 'langer'} Rast${tail}`;
    case 'action': {
      const w = String(f.dice || '').replace(/d/g, 'W');
      const n = f.uses === 'pb' ? 'Übungsbonus-mal' : String(f.uses).startsWith('mod:') ? `${FX_AB[String(f.uses).slice(4)]}-Mod.-mal` : `${f.uses}×`;
      return `Aktion: ${f.k || 'ohne Namen'} (${f.kind === 'heal' ? `Heilung ${w}` : f.kind === 'save' ? `Rettungswurf auf ${FX_AB[f.save] || 'Geschicklichkeit'}, ${w} ${dmgName(f.type)}` : `Angriff ${w} ${dmgName(f.type)}`}${f.uses && f.uses !== 'will' ? `, ${n} pro ${f.rest === 'short' ? 'kurzer' : 'langer'} Rast` : ''})${tail}`;
    }
    case 'adv': return String(f.k || 'Vorteil');
    case 'money': return `${f.v} ${({ gp: 'GM', sp: 'SM', cp: 'KM', ep: 'EM', pp: 'PM' })[f.k] || 'GM'}`;
    default: return f.t;
  }
}

// ───────────────────────── Zusammenfassen ─────────────────────────
// ctx: { level, armor: 'none'|'clothing'|'light'|'medium'|'heavy', shield: bool, pb }
export function condOk(cond, ctx = {}) {
  const a = ctx.armor || 'none';
  if (cond === 'noHeavy') return a !== 'heavy';
  if (cond === 'unarmored') return a === 'none' || a === 'clothing';
  if (cond === 'armored') return a !== 'none' && a !== 'clothing';
  if (cond === 'shield') return !!ctx.shield;
  return true;
}
export function emptySummary() {
  return {
    speed: 0, speedSet: 0, move: {}, sense: {}, ac: 0, acF: [], hpLevel: 0, hp: 0, init: 0, abil: {}, saveProf: new Set(), saveBonus: 0,
    skill: new Set(), exp: new Set(), tools: [], weapons: new Set(), armor: new Set(), lang: new Set(), langChoice: 0,
    resist: new Set(), immune: new Set(), vuln: new Set(), condImm: new Set(), adv: [], atk: { all: 0, melee: 0, ranged: 0, spell: 0 }, dmg: { all: 0, melee: 0, ranged: 0 },
    spells: [], res: [], attacks: 1, actions: [], applied: [],
  };
}
export function fxSummary(list, ctx = {}) {
  const s = emptySummary();
  const lvl = Number(ctx.level) || 1;
  for (const f of list || []) {
    if (!f || f.active === false) continue;
    if (f.lvl && lvl < f.lvl) continue;
    if (f.cond && !condOk(f.cond, ctx)) continue;
    const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
    switch (f.t) {
      case 'speed': s.speed += Number(f.v) || 0; break;
      case 'speedSet': s.speedSet = Math.max(s.speedSet, Number(f.v) || 0); break;
      case 'move': if (f.k) s.move[f.k] = f.v === 'walk' ? 'walk' : Math.max(Number(s.move[f.k]) || 0, Number(f.v) || 0); break;
      case 'sense': if (f.k) s.sense[f.k] = Math.max(s.sense[f.k] || 0, Number(f.v) || 0); break;
      case 'ac': s.ac += Number(f.v) || 0; break;
      case 'acFormula': s.acF.push({ base: Number(f.v) || 10, abs: arr(f.k), shield: f.shield !== false, name: f.src || '' }); break;
      case 'hpLevel': s.hpLevel += Number(f.v) || 0; break;
      case 'hp': s.hp += Number(f.v) || 0; break;
      case 'abil': if (f.k) s.abil[f.k] = (s.abil[f.k] || 0) + (Number(f.v) || 0); break;
      case 'init': s.init += f.v === 'pb' ? Number(ctx.pb) || 2 : Number(f.v) || 0; break;
      case 'saveProf': arr(f.k).forEach((k) => s.saveProf.add(k)); break;
      case 'saveBonus': s.saveBonus += Number(f.v) || 0; break;
      case 'skill': arr(f.k).forEach((k) => s.skill.add(k)); break;
      case 'expertise': arr(f.k).forEach((k) => s.exp.add(k)); break;
      case 'weapon': arr(f.k).forEach((k) => s.weapons.add(k)); break;
      case 'armor': arr(f.k).forEach((k) => s.armor.add(k)); break;
      case 'tool': if (f.k) s.tools.push(String(f.k)); break;
      case 'lang': arr(f.k).forEach((k) => s.lang.add(k)); break;
      case 'resist': arr(f.k).forEach((k) => s.resist.add(k)); break;
      case 'immune': arr(f.k).forEach((k) => s.immune.add(k)); break;
      case 'vuln': arr(f.k).forEach((k) => s.vuln.add(k)); break;
      case 'condImm': arr(f.k).forEach((k) => s.condImm.add(k)); break;
      case 'attack': s.atk[f.k || 'all'] = (s.atk[f.k || 'all'] || 0) + (Number(f.v) || 0); break;
      case 'damage': s.dmg[f.k || 'all'] = (s.dmg[f.k || 'all'] || 0) + (Number(f.v) || 0); break;
      case 'attacks': s.attacks = Math.max(s.attacks, Number(f.v) || 1); break;
      case 'spell': if (f.k) s.spells.push({ name: String(f.k), lv: f.lv ?? 1, src: f.src || '', uses: f.uses || (f.lv === 0 ? 'will' : 1), rest: f.rest || 'long' }); break;
      case 'res': s.res.push({ name: f.k || f.src || 'Fähigkeit', v: f.v, rest: f.rest || 'long', src: f.src || '', info: f.info || '' }); break;
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
  ['Stufe', '„(ab Stufe 5)“ im Namen oder Satz: gilt erst ab dieser Stufe'],
  ['Nur Hinweis', 'Sätze mit „Bonusaktion“, „Reaktion“, „für 10 Minuten“, „wenn …“, „solange …“ oder einer Auswahl („oder“, „deiner Wahl“) wirken nicht automatisch – sie bleiben Regeltext. Prüfbar sind „ohne schwere Rüstung“, „ohne Rüstung“, „solange du eine Rüstung trägst“ und „mit Schild“.'],
];
