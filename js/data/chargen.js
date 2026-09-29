// Charaktererschaffung für die fünfte Edition – Grundbestand aus SRD 5.1 (Regeln 2014) und SRD 5.2.1 (Regeln 2024):
// Völker/Spezies, Hintergründe, Klassen, Talente, Rüstungen, Waffen, Zaubertabellen und Rechenhilfen.
// Alles darüber hinaus kommt aus Regelpaketen der Kampagne (core/rulesets.js) – nie hier eintragen.
// Beschreibungen sind kurze Zusammenfassungen in eigenen Worten.
import { SKILLS } from './rules5e.js';

export const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const AB_NAME = { str: 'Stärke', dex: 'Geschicklichkeit', con: 'Konstitution', int: 'Intelligenz', wis: 'Weisheit', cha: 'Charisma' };
export const AB_SHORT = { str: 'STÄ', dex: 'GES', con: 'KON', int: 'INT', wis: 'WEI', cha: 'CHA' };
export const abMod = (s) => Math.floor(((Number(s) || 10) - 10) / 2);
export const profBonus = (level) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
export const skillName = (k) => SKILLS.find((s) => s.key === k)?.name || k;
export const skillAbility = (k) => SKILLS.find((s) => s.key === k)?.ability || 'int';
export const ALL_SKILLS = SKILLS.map((s) => s.key);

// Grundregeln – Regelpakete dürfen sie ändern (setBaseRules, core/rulesets.js); die Bindungen sind live.
const BASE_RULES = { standardArray: [15, 14, 13, 12, 10, 8], pointCost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }, pointBudget: 27, abilityMax: 20 };
export let STANDARD_ARRAY = BASE_RULES.standardArray;
export let POINT_COST = BASE_RULES.pointCost;
export let POINT_BUDGET = BASE_RULES.pointBudget;
export let ABILITY_MAX = BASE_RULES.abilityMax;
export const baseRules = () => structuredClone(BASE_RULES);
export function setBaseRules(r) {
  const x = { ...BASE_RULES, ...(r || {}) };
  STANDARD_ARRAY = Array.isArray(x.standardArray) && x.standardArray.length === 6 ? x.standardArray.map(Number) : BASE_RULES.standardArray;
  POINT_COST = x.pointCost && Object.keys(x.pointCost).length ? Object.fromEntries(Object.entries(x.pointCost).map(([k, v]) => [Number(k), Number(v)])) : BASE_RULES.pointCost;
  POINT_BUDGET = Number(x.pointBudget) || BASE_RULES.pointBudget;
  ABILITY_MAX = Number(x.abilityMax) || BASE_RULES.abilityMax;
}

export function fmtDist(ft, units = 'm') {
  if (units === 'ft') return `${ft} ft`;
  return `${(ft * 0.3).toLocaleString('de-DE', { maximumFractionDigits: 1 })} m`;
}

// ───────────────────────── Völker / Spezies ─────────────────────────
const DRAGONS = [['Schwarz', 'Säure'], ['Blau', 'Blitz'], ['Messing', 'Feuer'], ['Bronze', 'Blitz'], ['Kupfer', 'Säure'], ['Gold', 'Feuer'], ['Grün', 'Gift'], ['Rot', 'Feuer'], ['Silber', 'Kälte'], ['Weiß', 'Kälte']]
  .map(([c, d]) => ({ key: c.toLowerCase(), name: `${c} (${d})`, note: `Resistenz und Odemwaffe: ${d}` }));

export const SPECIES = {
  2024: [
    { key: 'dragonborn', name: 'Drachenblütige', size: 'Mittelgroß', speed: 30, dark: 60, option: { label: 'Drachenahne', list: DRAGONS }, traits: [
      ['Odemwaffe', 'Ersetzt einen Angriff: Kegel 4,5 m oder Linie 9 m, GES-Rettungswurf (SG 8 + KON + ÜB), 1W10 Schaden (2W10 ab 5, 3W10 ab 11, 4W10 ab 17); Übungsbonus-mal pro langer Rast.'],
      ['Schadensresistenz', 'Resistenz gegen die Schadensart deiner Drachenahnen.'],
      ['Drachenflug (ab Stufe 5)', 'Bonusaktion, 1× pro langer Rast: 10 Minuten Flügel, Fluggeschwindigkeit = Bewegungsrate.'],
    ] },
    { key: 'elf', name: 'Elf', size: 'Mittelgroß', speed: 30, dark: 60, skillChoice: { n: 1, list: ['insight', 'perception', 'survival'], label: 'Scharfe Sinne' },
      option: { label: 'Elfische Abstammung', list: [
        { key: 'drow', name: 'Drow', dark: 120, note: 'Dunkelsicht 36 m · Tanzende Lichter · St. 3 Feenfeuer · St. 5 Dunkelheit' },
        { key: 'hochelf', name: 'Hochelf', note: 'Taschenspielerei (nach langer Rast tauschbar) · St. 3 Magie entdecken · St. 5 Nebelschritt' },
        { key: 'waldelf', name: 'Waldelf', speed: 35, note: 'Bewegung 10,5 m · Druidenkunst · St. 3 Lange Schritte · St. 5 Spurloses Gehen' },
      ] },
      traits: [
        ['Feenblut', 'Vorteil bei Rettungswürfen gegen den Zustand Bezaubert.'],
        ['Scharfe Sinne', 'Übung in Motiv erkennen, Wahrnehmung oder Überlebenskunst.'],
        ['Trance', 'Eine lange Rast dauert für dich nur 4 Stunden (meditativ, bei Bewusstsein).'],
      ] },
    { key: 'gnome', name: 'Gnom', size: 'Klein', speed: 30, dark: 60,
      option: { label: 'Gnomische Abstammung', list: [
        { key: 'waldgnom', name: 'Waldgnom', note: 'Zaubertrick Kleine Illusion · Mit Tieren sprechen (ÜB-mal pro langer Rast ohne Zauberplatz)' },
        { key: 'felsgnom', name: 'Felsgnom', note: 'Ausbessern und Taschenspielerei · baut kleine Uhrwerkgeräte' },
      ] },
      traits: [['Gnomische Gerissenheit', 'Vorteil bei INT-, WEI- und CHA-Rettungswürfen.']] },
    { key: 'goliath', name: 'Goliath', size: 'Mittelgroß', speed: 35, dark: 0,
      option: { label: 'Riesenabstammung', list: [
        { key: 'wolken', name: 'Wolkenriese', note: 'Bonusaktion: bis 9 m teleportieren' },
        { key: 'feuer', name: 'Feuerriese', note: 'Bei Treffer +1W10 Feuerschaden' },
        { key: 'frost', name: 'Frostriese', note: 'Bei Treffer +1W6 Kälte und −3 m Bewegung' },
        { key: 'huegel', name: 'Hügelriese', note: 'Bei Treffer Ziel (bis Groß) umstoßen' },
        { key: 'stein', name: 'Steinriese', note: 'Reaktion: Schaden um 1W12 + KON verringern' },
        { key: 'sturm', name: 'Sturmriese', note: 'Reaktion: Angreifer erleidet 1W8 Donnerschaden' },
      ] },
      traits: [
        ['Riesenabstammung', 'Übungsbonus-mal pro langer Rast die Kraft deiner Riesenahnen.'],
        ['Große Gestalt (ab Stufe 5)', 'Bonusaktion, 1× pro langer Rast: 10 Minuten Größe Groß, Vorteil auf STÄ-Proben, +3 m Bewegung.'],
        ['Kräftiger Körperbau', 'Vorteil beim Befreien aus Gepackt; zählt beim Tragen als eine Größe größer.'],
      ] },
    { key: 'halfling', name: 'Halbling', size: 'Klein', speed: 30, dark: 0, luck: true, traits: [
      ['Tapfer', 'Vorteil bei Rettungswürfen gegen Verängstigt.'],
      ['Halblingsgewandtheit', 'Du kannst dich durch den Bereich größerer Kreaturen bewegen.'],
      ['Glück', 'Eine natürliche 1 bei einem W20-Test würfelst du neu und nimmst das neue Ergebnis.'],
      ['Natürlich verstohlen', 'Verstecken ist möglich, wenn dich eine größere Kreatur verdeckt.'],
    ] },
    { key: 'human', name: 'Mensch', size: 'Mittelgroß oder Klein', speed: 30, dark: 0, skillAny: 1, originFeat: true, traits: [
      ['Einfallsreich', 'Nach jeder langen Rast erhältst du Heroische Inspiration.'],
      ['Geschickt', 'Übung in einer Fertigkeit deiner Wahl.'],
      ['Vielseitig', 'Ein zusätzliches Herkunftstalent deiner Wahl.'],
    ] },
    { key: 'orc', name: 'Ork', size: 'Mittelgroß', speed: 30, dark: 120, traits: [
      ['Adrenalinschub', 'Spurt als Bonusaktion, dazu temporäre TP = Übungsbonus; ÜB-mal pro kurzer Rast.'],
      ['Unerbittliche Ausdauer', 'Fällst du auf 0 TP, bleibst du stattdessen bei 1 TP – 1× pro langer Rast.'],
    ] },
    { key: 'tiefling', name: 'Tiefling', size: 'Mittelgroß oder Klein', speed: 30, dark: 60,
      option: { label: 'Unholdisches Erbe', list: [
        { key: 'abyssisch', name: 'Abyssisch', note: 'Resistenz Gift · Giftspritzer · St. 3 Strahl der Übelkeit · St. 5 Person festhalten' },
        { key: 'chthonisch', name: 'Chthonisch', note: 'Resistenz nekrotisch · Kalte Hand · St. 3 Falsches Leben · St. 5 Strahl der Schwächung' },
        { key: 'infernalisch', name: 'Infernalisch', note: 'Resistenz Feuer · Feuerpfeil · St. 3 Höllischer Tadel · St. 5 Dunkelheit' },
      ] },
      traits: [['Überweltliche Präsenz', 'Du kennst den Zaubertrick Thaumaturgie.']] },
    { key: 'dwarf', name: 'Zwerg', size: 'Mittelgroß', speed: 30, dark: 120, hpPerLevel: 1, traits: [
      ['Zwergische Widerstandskraft', 'Resistenz gegen Giftschaden, Vorteil gegen Vergiftet.'],
      ['Zwergische Zähigkeit', '+1 TP-Maximum pro Stufe.'],
      ['Steingespür', 'Bonusaktion: 10 Minuten Erschütterungssinn 18 m auf Stein; ÜB-mal pro langer Rast.'],
    ] },
    { key: 'custom', name: 'Eigenes Volk (Hausregel)', size: 'Mittelgroß oder Klein', speed: 30, dark: 60, skillAny: 1, traits: [['Frei gestaltbar', 'Für Völker aus deiner Welt: Merkmale unter „Merkmale“ ergänzen.']] },
  ],
  2014: [
    { key: 'dragonborn', name: 'Drachenblütiger', asi: { str: 2, cha: 1 }, size: 'Mittelgroß', speed: 30, dark: 0, option: { label: 'Drachenahne', list: DRAGONS }, traits: [
      ['Odemwaffe', 'Aktion: Kegel oder Linie, Rettungswurf SG 8 + KON + ÜB, 2W6 Schaden (3W6 ab 6, 4W6 ab 11, 5W6 ab 16); 1× pro kurzer Rast.'],
      ['Schadensresistenz', 'Resistenz gegen die Schadensart deiner Drachenahnen.'],
    ] },
    { key: 'elf', name: 'Elf', asi: { dex: 2 }, size: 'Mittelgroß', speed: 30, dark: 60, skills: ['perception'],
      subs: [
        { key: 'hochelf', name: 'Hochelf', asi: { int: 1 }, traits: [['Elfische Waffenausbildung', 'Langschwert, Kurzschwert, Kurz- und Langbogen.'], ['Zaubertrick', 'Ein Magier-Zaubertrick (INT).'], ['Zusätzliche Sprache', 'Eine weitere Sprache.']] },
      ],
      traits: [['Scharfe Sinne', 'Übung in Wahrnehmung.'], ['Feenblut', 'Vorteil gegen Bezauberung, magischer Schlaf wirkt nicht.'], ['Trance', '4 Stunden Meditation ersetzen 8 Stunden Schlaf.']] },
    { key: 'gnome', name: 'Gnom', asi: { int: 2 }, size: 'Klein', speed: 25, dark: 60,
      subs: [
        { key: 'felsgnom', name: 'Felsgnom', asi: { con: 1 }, traits: [['Wissen des Handwerkers', 'Doppelter Übungsbonus auf Geschichte bei magischen/technischen Gegenständen.'], ['Tüftler', 'Baut kleine Uhrwerkgeräte.']] },
      ],
      traits: [['Gnomische Gerissenheit', 'Vorteil auf INT-, WEI- und CHA-Rettungswürfe gegen Magie.']] },
    { key: 'halfelf', name: 'Halbelf', asi: { cha: 2 }, asiChoice: { n: 2, amount: 1, exclude: ['cha'] }, size: 'Mittelgroß', speed: 30, dark: 60, skillAny: 2, traits: [
      ['Feenblut', 'Vorteil gegen Bezauberung, magischer Schlaf wirkt nicht.'],
      ['Vielseitigkeit', 'Übung in zwei Fertigkeiten deiner Wahl.'],
    ] },
    { key: 'halfling', name: 'Halbling', asi: { dex: 2 }, size: 'Klein', speed: 25, dark: 0, luck: true,
      subs: [
        { key: 'leichtfuss', name: 'Leichtfuß', asi: { cha: 1 }, traits: [['Natürlich verstohlen', 'Verstecken hinter größeren Kreaturen.']] },
      ],
      traits: [['Glück', 'Eine natürliche 1 bei Angriff, Attributs- oder Rettungswurf würfelst du neu.'], ['Tapfer', 'Vorteil gegen Verängstigt.'], ['Halblingsgewandtheit', 'Bewegung durch den Bereich größerer Kreaturen.']] },
    { key: 'halforc', name: 'Halbork', asi: { str: 2, con: 1 }, size: 'Mittelgroß', speed: 30, dark: 60, skills: ['intimidation'], traits: [
      ['Bedrohlich', 'Übung in Einschüchtern.'],
      ['Unerbittliche Ausdauer', 'Bei 0 TP stattdessen 1 TP – 1× pro langer Rast.'],
      ['Wilde Angriffe', 'Bei einem kritischen Nahkampftreffer einen Schadenswürfel zusätzlich.'],
    ] },
    { key: 'human', name: 'Mensch', size: 'Mittelgroß', speed: 30, dark: 0,
      subs: [
        { key: 'standard', name: 'Mensch (Standard)', asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, traits: [] },
      ],
      traits: [] },
    { key: 'tiefling', name: 'Tiefling', asi: { cha: 2, int: 1 }, size: 'Mittelgroß', speed: 30, dark: 60, traits: [
      ['Höllische Resistenz', 'Resistenz gegen Feuerschaden.'],
      ['Infernales Erbe', 'Thaumaturgie; St. 3 Höllischer Tadel; St. 5 Dunkelheit (CHA).'],
    ] },
    { key: 'dwarf', name: 'Zwerg', asi: { con: 2 }, size: 'Mittelgroß', speed: 25, dark: 60,
      subs: [
        { key: 'huegelzwerg', name: 'Hügelzwerg', asi: { wis: 1 }, hpPerLevel: 1, traits: [['Zwergische Zähigkeit', '+1 TP-Maximum pro Stufe.']] },
      ],
      traits: [['Zwergische Widerstandskraft', 'Vorteil gegen Gift, Resistenz gegen Giftschaden.'], ['Zwergische Kampfausbildung', 'Streitaxt, Handbeil, leichter Hammer, Kriegshammer.'], ['Steingespür', 'Doppelter Übungsbonus auf Geschichte bei Steinmetzarbeiten.'], ['Robust', 'Schwere Rüstung verringert deine Bewegung nicht.']] },
    { key: 'custom', name: 'Eigenes Volk (Hausregel)', asiChoice: { n: 1, amount: 2 }, size: 'Mittelgroß oder Klein', speed: 30, dark: 60, skillAny: 1, feat: true, traits: [['Eigene Abstammung', '+2 auf ein Attribut, ein Talent, eine Fertigkeit, Dunkelsicht 18 m.']] },
  ],
};

// ───────────────────────── Hintergründe ─────────────────────────
export const BACKGROUNDS = {
  2024: [
    { key: 'acolyte', name: 'Tempeldiener', abilities: ['int', 'wis', 'cha'], feat: 'magic-initiate-cleric', skills: ['insight', 'religion'], tool: 'Kalligrafiewerkzeug', equip: 'Kalligrafiewerkzeug, Buch (Gebete), Heiliges Symbol, Pergament (10 Blatt), Robe, 8 GM' },
    { key: 'criminal', name: 'Krimineller', abilities: ['dex', 'con', 'int'], feat: 'alert', skills: ['sleight', 'stealth'], tool: 'Diebeswerkzeug', equip: '2 Dolche, Diebeswerkzeug, Brecheisen, 2 Beutel, Reisekleidung, 16 GM' },
    { key: 'sage', name: 'Weiser', abilities: ['con', 'int', 'wis'], feat: 'magic-initiate-wizard', skills: ['arcana', 'history'], tool: 'Kalligrafiewerkzeug', equip: 'Kampfstab, Kalligrafiewerkzeug, Buch (Geschichte), Pergament (8 Blatt), Robe, 8 GM' },
    { key: 'soldier', name: 'Soldat', abilities: ['str', 'dex', 'con'], feat: 'savage-attacker', skills: ['athletics', 'intimidation'], tool: 'Spielset nach Wahl', equip: 'Speer, Kurzbogen, 20 Pfeile, Spielset, Heilerausrüstung, Köcher, Reisekleidung, 14 GM' },
  ],
  2014: [
    { key: 'acolyte', name: 'Tempeldiener', skills: ['insight', 'religion'], languages: 2, feature: 'Zuflucht der Gläubigen', equip: 'Heiliges Symbol, Gebetbuch, 5 Räucherstäbchen, Gewänder, gewöhnliche Kleidung, 15 GM' },
    { key: 'custom', name: 'Eigener Hintergrund', skillAny: 2, feature: 'Frei nach Absprache', equip: '' },
  ],
};

// ───────────────────────── Talente ─────────────────────────
const ANY = AB;
const MENTAL = ['int', 'wis', 'cha'];
// a14 / a24: Attribute, von denen eines um 1 steigt (Halbtalente), je Regelstand
export const FEATS = [
  // Herkunft (2024) – in 2014 normale Talente
  { key: 'alert', name: 'Aufmerksam', cat: 'origin', ed: '2024', desc: 'Du bist auf alles gefasst: Auf deine Initiative addierst du deinen Übungsbonus (2014: +5). Außerdem darfst du deine Initiative mit einem einverstandenen Verbündeten tauschen, dessen Wert niedriger ist. 2014 stattdessen: Du kannst nicht überrascht werden, solange du bei Bewusstsein bist, und versteckte oder unsichtbare Gegner haben keinen Vorteil auf Angriffe gegen dich.' },
  { key: 'magic-initiate-cleric', name: 'Magieeingeweihter (Kleriker)', cat: 'origin', ed: '2024', desc: 'Du lernst zwei Zaubertricks und einen Zauber 1. Grades aus der Klerikerliste. Den Zauber 1. Grades wirkst du einmal pro langer Rast ohne Zauberplatz – oder ganz normal, wenn du passende Zauberplätze hast. Zauberattribut ist Weisheit. Das Talent kann mehrfach genommen werden (2024, jedes Mal eine andere Liste).' },
  { key: 'magic-initiate-druid', name: 'Magieeingeweihter (Druide)', cat: 'origin', ed: '2024', desc: 'Du lernst zwei Zaubertricks und einen Zauber 1. Grades aus der Druidenliste. Den Zauber 1. Grades wirkst du einmal pro langer Rast ohne Zauberplatz – oder ganz normal, wenn du passende Zauberplätze hast. Zauberattribut ist Weisheit. Das Talent kann mehrfach genommen werden (2024, jedes Mal eine andere Liste).' },
  { key: 'magic-initiate-wizard', name: 'Magieeingeweihter (Magier)', cat: 'origin', ed: '2024', desc: 'Du lernst zwei Zaubertricks und einen Zauber 1. Grades aus der Magierliste. Den Zauber 1. Grades wirkst du einmal pro langer Rast ohne Zauberplatz – oder ganz normal, wenn du passende Zauberplätze hast. Zauberattribut ist Intelligenz. Das Talent kann mehrfach genommen werden (2024, jedes Mal eine andere Liste).' },
  { key: 'savage-attacker', name: 'Wilder Angreifer', cat: 'origin', ed: '2024', fx: { savage: true }, desc: 'Einmal in jedem deiner Züge würfelst du die Schadenswürfel eines Waffenangriffs zweimal und nimmst das bessere Ergebnis.' },
  { key: 'skilled', name: 'Begabt', cat: 'origin', ed: '2024', grantSkills: 3, desc: 'Du wirst in drei Fertigkeiten oder Werkzeugen deiner Wahl geübt, beliebig gemischt. Das Talent kann mehrfach genommen werden.' },
  // Allgemein
  { key: 'grappler', name: 'Ringer', cat: 'general', a24: ['str', 'dex'], desc: 'Stärke oder Geschicklichkeit +1. Du hast Vorteil auf Angriffe gegen Kreaturen, die du gepackt hast, und triffst du mit einem waffenlosen Schlag, darfst du das Ziel im selben Zug packen (2024: einmal pro Zug). Eine gepackte Kreatur bewegst du mit, ohne dass deine Geschwindigkeit sinkt.' },
  // Kampfstile
  { key: 'style-archery', name: 'Kampfstil: Bogenschießen', cat: 'style', desc: '+2 auf alle Angriffswürfe mit Fernkampfwaffen.' },
  { key: 'style-defense', name: 'Kampfstil: Verteidigung', cat: 'style', desc: '+1 auf die Rüstungsklasse, solange du eine Rüstung trägst.' },
  { key: 'style-dueling', name: 'Kampfstil: Duellieren', cat: 'style', ed: '2014', desc: '+2 Schaden, wenn du eine einhändige Nahkampfwaffe führst und keine zweite Waffe in der anderen Hand hast.' },
  { key: 'style-gwf', name: 'Kampfstil: Kampf mit Großwaffen', cat: 'style', fx: { gwf: true }, desc: '2014: Eine 1 oder 2 auf einem Schadenswürfel einer zweihändig oder vielseitig geführten Nahkampfwaffe darfst du einmal neu würfeln; das neue Ergebnis zählt. 2024: 1 und 2 zählen stattdessen immer als 3.' },
  { key: 'style-protection', name: 'Kampfstil: Schutz', cat: 'style', ed: '2014', desc: 'Trägst du einen Schild und greift eine sichtbare Kreatur einen Verbündeten in 1,5 m Entfernung an, gibst du diesem Angriffswurf als Reaktion Nachteil.' },
  { key: 'style-twf', name: 'Kampfstil: Kampf mit zwei Waffen', cat: 'style', desc: 'Beim Zusatzangriff mit der zweiten Waffe addierst du deinen Attributsmodifikator auf den Schaden – sonst zählt dort nur der Würfel.' },
  // Epische Gaben (2024, Stufe 19)
  { key: 'boon-combat', name: 'Gabe der Kampfkunst', cat: 'epic', ed: '2024', a24: ANY, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Einmal in jedem deiner Züge verwandelst du einen verfehlten Angriffswurf in einen Treffer.' },
  { key: 'boon-dimension', name: 'Gabe der Dimensionsreise', cat: 'epic', ed: '2024', a24: ANY, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Unmittelbar nach einem Angriff oder der Aktion Magie teleportierst du dich bis zu 9 m weit an einen freien Platz, den du sehen kannst.' },
  { key: 'boon-fate', name: 'Gabe des Schicksals', cat: 'epic', ed: '2024', a24: ANY, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Würfelt eine Kreatur in 18 m einen W20-Test, addierst du 2W4 oder ziehst sie ab – so oft pro langer Rast, wie dein Charismamodifikator beträgt (mindestens einmal).' },
  { key: 'boon-offense', name: 'Gabe des unwiderstehlichen Angriffs', cat: 'epic', ed: '2024', a24: ['str', 'dex'], desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Deine Waffen- und waffenlosen Angriffe ignorieren Resistenz gegen Hieb-, Stich- und Wuchtschaden, und bei einer natürlichen 20 auf dem Angriffswurf richtest du zusätzlich Kraftschaden in Höhe deiner Stufe an.' },
  { key: 'boon-recall', name: 'Gabe des Zauberrückrufs', cat: 'epic', ed: '2024', a24: MENTAL, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Wirkst du einen Zauber bis zum 4. Grad mit einem Zauberplatz, würfle einen W4: Bei einer 4 bleibt der Zauberplatz erhalten.' },
  { key: 'boon-night', name: 'Gabe des Nachtgeists', cat: 'epic', ed: '2024', a24: ANY, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). In Dunkelheit wirst du als Bonusaktion unsichtbar, bis du angreifst, einen Zauber wirkst oder ins Licht trittst. Im Dämmerlicht hast du Resistenz gegen alle Schadensarten außer strahlend.' },
  { key: 'boon-truesight', name: 'Gabe des Wahren Blicks', cat: 'epic', ed: '2024', a24: ANY, desc: 'Epische Gabe ab Stufe 19. Ein Attribut deiner Wahl +1 (bis 30). Du hast Wahren Blick auf 18 m: Du durchschaust Illusionen, erkennst Gestaltwandler, siehst Unsichtbares und blickst in die Ätherebene.' },
];

// ───────────────────────── Rüstungen & Waffen ─────────────────────────
export const ARMOR = [
  { key: 'gepolstert', name: 'Gepolsterte Rüstung', type: 'light', ac: 11, stealth: true },
  { key: 'leder', name: 'Lederrüstung', type: 'light', ac: 11 },
  { key: 'beschlagen', name: 'Beschlagene Lederrüstung', type: 'light', ac: 12 },
  { key: 'fell', name: 'Fellrüstung', type: 'medium', ac: 12 },
  { key: 'kettenhemd', name: 'Kettenhemd', type: 'medium', ac: 13 },
  { key: 'schuppen', name: 'Schuppenpanzer', type: 'medium', ac: 14, stealth: true },
  { key: 'brustplatte', name: 'Brustplatte', type: 'medium', ac: 14 },
  { key: 'halbplatte', name: 'Halbplattenrüstung', type: 'medium', ac: 15, stealth: true },
  { key: 'ringpanzer', name: 'Ringpanzer', type: 'heavy', ac: 14, stealth: true },
  { key: 'kettenpanzer', name: 'Kettenpanzer', type: 'heavy', ac: 16, str: 13, stealth: true },
  { key: 'schienen', name: 'Schienenpanzer', type: 'heavy', ac: 17, str: 15, stealth: true },
  { key: 'platte', name: 'Plattenpanzer', type: 'heavy', ac: 18, str: 15, stealth: true },
];
export const ARMOR_TYPE = { light: 'leicht', medium: 'mittelschwer', heavy: 'schwer' };

// p: f=Finesse, l=leicht, h=schwer, 2=zweihändig, t=Wurf, r=Reichweite, v=vielseitig, a=Munition/Fernkampf, o=Laden
export const WEAPONS = [
  { key: 'knueppel', name: 'Knüppel', cat: 'simple', dmg: '1d4', type: 'Wucht', p: 'l', m: 'Verlangsamen' },
  { key: 'dolch', name: 'Dolch', cat: 'simple', dmg: '1d4', type: 'Stich', p: 'flt', m: 'Kerbe' },
  { key: 'zweihandknueppel', name: 'Zweihandknüppel', cat: 'simple', dmg: '1d8', type: 'Wucht', p: '2', m: 'Stoßen' },
  { key: 'handbeil', name: 'Handbeil', cat: 'simple', dmg: '1d6', type: 'Hieb', p: 'lt', m: 'Plagen' },
  { key: 'wurfspeer', name: 'Wurfspeer', cat: 'simple', dmg: '1d6', type: 'Stich', p: 't', m: 'Verlangsamen' },
  { key: 'leichterhammer', name: 'Leichter Hammer', cat: 'simple', dmg: '1d4', type: 'Wucht', p: 'lt', m: 'Kerbe' },
  { key: 'streitkolben', name: 'Streitkolben', cat: 'simple', dmg: '1d6', type: 'Wucht', p: '', m: 'Schwächen' },
  { key: 'kampfstab', name: 'Kampfstab', cat: 'simple', dmg: '1d6', vers: '1d8', type: 'Wucht', p: 'v', m: 'Umstoßen' },
  { key: 'sichel', name: 'Sichel', cat: 'simple', dmg: '1d4', type: 'Hieb', p: 'l', m: 'Kerbe' },
  { key: 'speer', name: 'Speer', cat: 'simple', dmg: '1d6', vers: '1d8', type: 'Stich', p: 'tv', m: 'Schwächen' },
  { key: 'leichtearmbrust', name: 'Leichte Armbrust', cat: 'simple', dmg: '1d8', type: 'Stich', p: 'a2o', m: 'Verlangsamen' },
  { key: 'wurfpfeil', name: 'Wurfpfeil', cat: 'simple', dmg: '1d4', type: 'Stich', p: 'ftA', m: 'Plagen' },
  { key: 'kurzbogen', name: 'Kurzbogen', cat: 'simple', dmg: '1d6', type: 'Stich', p: 'a2', m: 'Plagen' },
  { key: 'schleuder', name: 'Schleuder', cat: 'simple', dmg: '1d4', type: 'Wucht', p: 'a', m: 'Verlangsamen' },
  { key: 'streitaxt', name: 'Streitaxt', cat: 'martial', dmg: '1d8', vers: '1d10', type: 'Hieb', p: 'v', m: 'Umstoßen' },
  { key: 'flegel', name: 'Flegel', cat: 'martial', dmg: '1d8', type: 'Wucht', p: '', m: 'Schwächen' },
  { key: 'glefe', name: 'Glefe', cat: 'martial', dmg: '1d10', type: 'Hieb', p: 'h2r', m: 'Streifen' },
  { key: 'zweihandaxt', name: 'Zweihandaxt', cat: 'martial', dmg: '1d12', type: 'Hieb', p: 'h2', m: 'Spalten' },
  { key: 'zweihandschwert', name: 'Zweihandschwert', cat: 'martial', dmg: '2d6', type: 'Hieb', p: 'h2', m: 'Streifen' },
  { key: 'hellebarde', name: 'Hellebarde', cat: 'martial', dmg: '1d10', type: 'Hieb', p: 'h2r', m: 'Spalten' },
  { key: 'lanze', name: 'Lanze', cat: 'martial', dmg: '1d10', type: 'Stich', p: 'hr', m: 'Umstoßen' },
  { key: 'langschwert', name: 'Langschwert', cat: 'martial', dmg: '1d8', vers: '1d10', type: 'Hieb', p: 'v', m: 'Schwächen' },
  { key: 'zweihandhammer', name: 'Zweihandhammer', cat: 'martial', dmg: '2d6', type: 'Wucht', p: 'h2', m: 'Umstoßen' },
  { key: 'morgenstern', name: 'Morgenstern', cat: 'martial', dmg: '1d8', type: 'Stich', p: '', m: 'Schwächen' },
  { key: 'pike', name: 'Pike', cat: 'martial', dmg: '1d10', type: 'Stich', p: 'h2r', m: 'Stoßen' },
  { key: 'rapier', name: 'Rapier', cat: 'martial', dmg: '1d8', type: 'Stich', p: 'f', m: 'Plagen' },
  { key: 'krummsaebel', name: 'Krummsäbel', cat: 'martial', dmg: '1d6', type: 'Hieb', p: 'fl', m: 'Kerbe' },
  { key: 'kurzschwert', name: 'Kurzschwert', cat: 'martial', dmg: '1d6', type: 'Stich', p: 'fl', m: 'Plagen' },
  { key: 'dreizack', name: 'Dreizack', cat: 'martial', dmg: '1d8', vers: '1d10', type: 'Stich', p: 'tv', m: 'Umstoßen' },
  { key: 'kriegshammer', name: 'Kriegshammer', cat: 'martial', dmg: '1d8', vers: '1d10', type: 'Wucht', p: 'v', m: 'Stoßen' },
  { key: 'kriegspicke', name: 'Kriegspicke', cat: 'martial', dmg: '1d8', vers: '1d10', type: 'Stich', p: 'v', m: 'Schwächen' },
  { key: 'peitsche', name: 'Peitsche', cat: 'martial', dmg: '1d4', type: 'Hieb', p: 'fr', m: 'Verlangsamen' },
  { key: 'blasrohr', name: 'Blasrohr', cat: 'martial', dmg: '1', type: 'Stich', p: 'ao', m: 'Plagen' },
  { key: 'handarmbrust', name: 'Handarmbrust', cat: 'martial', dmg: '1d6', type: 'Stich', p: 'alo', m: 'Plagen' },
  { key: 'schwerearmbrust', name: 'Schwere Armbrust', cat: 'martial', dmg: '1d10', type: 'Stich', p: 'ah2o', m: 'Stoßen' },
  { key: 'langbogen', name: 'Langbogen', cat: 'martial', dmg: '1d8', type: 'Stich', p: 'ah2', m: 'Verlangsamen' },
];
export const PROP_NAMES = { f: 'Finesse', l: 'leicht', h: 'schwer', 2: 'zweihändig', t: 'Wurfwaffe', r: 'Reichweite', v: 'vielseitig', a: 'Fernkampf', o: 'Laden', A: 'Fernkampf' };
export const findWeapon = (k) => WEAPONS.find((w) => w.key === k);
export const findArmor = (k) => ARMOR.find((a) => a.key === k);

// ───────────────────────── Klassen ─────────────────────────
// Merkmale je Stufe: '@asi' = Attributswerterhöhung/Talent, '@sub' = Unterklassenmerkmal, '@boon' = Epische Gabe
const F = (s) => Object.fromEntries(s.split('|').map((part) => {
  const i = part.indexOf(':');
  return [Number(part.slice(0, i)), part.slice(i + 1).split(',').map((x) => x.trim()).filter(Boolean)];
}));

const CANTRIPS = (b) => (lvl) => b + (lvl >= 4 ? 1 : 0) + (lvl >= 10 ? 1 : 0);
const PREP_FULL_24 = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const PREP_HALF_24 = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];

export const CLASSES = [
  {
    key: 'barbar', name: 'Barbar', hd: 12, primary: ['str'], saves: ['str', 'con'], subLabel: 'Pfad', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 2, list: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    armor: ['light', 'medium', 'shield'], weapons: { 2014: ['simple', 'martial'], 2024: ['simple', 'martial'] }, tools: '',
    unarmored: 'con', mc: { req: [['str']], gain: 'Schilde, einfache und Kriegswaffen' },
    equip: { 2024: 'Zweihandaxt, 4 Handbeile, Entdeckerausrüstung, 15 GM', 2014: 'Zweihandaxt, 2 Handbeile, Entdeckerausrüstung, 4 Wurfspeere' }, gold: { 2024: 75, 2014: '2d4×10' },
    subclasses: { 2014: ['Pfad des Berserkers'], 2024: ['Pfad des Berserkers'] },
    feat: {
      2024: F('1:Kampfrausch,Ungerüstete Verteidigung,Waffenmeisterschaft|2:Gefahrengespür,Tollkühner Angriff|3:@sub,Urwissen|4:@asi|5:Extra-Angriff,Schnelle Bewegung|6:@sub|7:Wilder Instinkt,Instinktives Anspringen|8:@asi|9:Brutaler Schlag|10:@sub|11:Unerbittlicher Kampfrausch|12:@asi|13:Verbesserter brutaler Schlag|14:@sub|15:Anhaltender Kampfrausch|16:@asi|17:Verbesserter brutaler Schlag|18:Unbezwingbare Macht|19:@boon|20:Urchampion'),
      2014: F('1:Kampfrausch,Ungerüstete Verteidigung|2:Tollkühner Angriff,Gefahrengespür|3:@sub|4:@asi|5:Extra-Angriff,Schnelle Bewegung|6:@sub|7:Wilder Instinkt|8:@asi|9:Brutaler kritischer Treffer|10:@sub|11:Unerbittlicher Kampfrausch|12:@asi|13:Brutaler kritischer Treffer|14:@sub|15:Anhaltender Kampfrausch|16:@asi|17:Brutaler kritischer Treffer|18:Unbezwingbare Macht|19:@asi|20:Urchampion'),
    },
  },
  {
    key: 'barde', name: 'Barde', hd: 8, primary: ['cha'], saves: ['dex', 'cha'], subLabel: 'Kolleg', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 3, list: 'any' }, armor: ['light'], weapons: { 2014: ['simple', 'handarmbrust', 'langschwert', 'rapier', 'kurzschwert'], 2024: ['simple'] }, tools: 'Drei Musikinstrumente',
    mc: { req: [['cha']], gain: 'Leichte Rüstung, eine Fertigkeit, ein Musikinstrument' },
    cast: { type: 'full', ability: 'cha', cantrips: CANTRIPS(2), known14: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22], prep24: PREP_FULL_24 },
    expertise: { 2014: { 3: 2, 10: 2 }, 2024: { 2: 2, 9: 2 } },
    equip: { 2024: 'Lederrüstung, 2 Dolche, Musikinstrument, Unterhaltungsausrüstung, 19 GM', 2014: 'Rapier, Diplomatenausrüstung, Laute, Lederrüstung, Dolch' }, gold: { 2024: 90, 2014: '5d4×10' },
    subclasses: { 2014: ['Kolleg des Wissens'], 2024: ['Kolleg des Wissens'] },
    feat: {
      2024: F('1:Bardische Inspiration,Zauberwirken|2:Expertise,Alleskönner|3:@sub|4:@asi|5:Quelle der Inspiration|6:@sub|7:Gegenbezauberung|8:@asi|9:Expertise|10:Magische Geheimnisse|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:|18:Überlegene Inspiration|19:@boon|20:Worte der Schöpfung'),
      2014: F('1:Zauberwirken,Bardische Inspiration|2:Alleskönner,Lied der Erholung|3:@sub,Expertise|4:@asi|5:Quelle der Inspiration|6:Gegenbezauberung,@sub|7:|8:@asi|9:|10:Expertise,Magische Geheimnisse|11:|12:@asi|13:|14:Magische Geheimnisse,@sub|15:|16:@asi|17:|18:Magische Geheimnisse|19:@asi|20:Überlegene Inspiration'),
    },
  },
  {
    key: 'kleriker', name: 'Kleriker', hd: 8, primary: ['wis'], saves: ['wis', 'cha'], subLabel: 'Domäne', subLevel: { 2014: 1, 2024: 3 },
    skills: { n: 2, list: ['history', 'insight', 'medicine', 'persuasion', 'religion'] }, armor: ['light', 'medium', 'shield'], weapons: { 2014: ['simple'], 2024: ['simple'] }, tools: '',
    mc: { req: [['wis']], gain: 'Leichte und mittelschwere Rüstung, Schilde' },
    cast: { type: 'full', ability: 'wis', cantrips: CANTRIPS(3), prep14: 'level', prep24: PREP_FULL_24 },
    equip: { 2024: 'Kettenhemd, Schild, Streitkolben, Heiliges Symbol, Priesterausrüstung, 7 GM', 2014: 'Streitkolben, Schuppenpanzer, leichte Armbrust mit 20 Bolzen, Priesterausrüstung, Schild, Heiliges Symbol' }, gold: { 2024: 110, 2014: '5d4×10' },
    subclasses: { 2014: ['Domäne des Lebens'], 2024: ['Domäne des Lebens'] },
    feat: {
      2024: F('1:Zauberwirken,Göttliche Ordnung|2:Göttliche Macht fokussieren|3:@sub|4:@asi|5:Untote versengen|6:@sub|7:Gesegnete Schläge|8:@asi|9:|10:Göttliches Eingreifen|11:|12:@asi|13:|14:Verbesserte gesegnete Schläge|15:|16:@asi|17:@sub|18:|19:@boon|20:Größeres göttliches Eingreifen'),
      2014: F('1:Zauberwirken,@sub|2:Göttliche Macht fokussieren,@sub|3:|4:@asi|5:Untote zerstören|6:@sub|7:|8:@asi,@sub|9:|10:Göttliches Eingreifen|11:|12:@asi|13:|14:|15:|16:@asi|17:@sub|18:|19:@asi|20:Verbessertes göttliches Eingreifen'),
    },
  },
  {
    key: 'druide', name: 'Druide', hd: 8, primary: ['wis'], saves: ['int', 'wis'], subLabel: 'Zirkel', subLevel: { 2014: 2, 2024: 3 },
    skills: { n: 2, list: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armor: { 2014: ['light', 'medium', 'shield'], 2024: ['light', 'shield'] }, weapons: { 2014: ['knueppel', 'dolch', 'wurfpfeil', 'wurfspeer', 'streitkolben', 'kampfstab', 'krummsaebel', 'sichel', 'schleuder', 'speer'], 2024: ['simple'] }, tools: 'Kräuterkundeausrüstung',
    mc: { req: [['wis']], gain: 'Leichte Rüstung, Schilde' },
    cast: { type: 'full', ability: 'wis', cantrips: CANTRIPS(2), prep14: 'level', prep24: PREP_FULL_24 },
    equip: { 2024: 'Lederrüstung, Schild, Sichel, Druidenfokus (Stab), Entdeckerausrüstung, Kräuterkundeausrüstung, 9 GM', 2014: 'Holzschild, Krummsäbel, Lederrüstung, Entdeckerausrüstung, Druidenfokus' }, gold: { 2024: 50, 2014: '2d4×10' },
    subclasses: { 2014: ['Zirkel des Landes'], 2024: ['Zirkel des Landes'] },
    feat: {
      2024: F('1:Zauberwirken,Druidisch,Ursprüngliche Ordnung|2:Tiergestalt,Wilder Begleiter|3:@sub|4:@asi|5:Wildes Wiedererstarken|6:@sub|7:Elementarer Zorn|8:@asi|9:|10:@sub|11:|12:@asi|13:|14:@sub|15:Verbesserter elementarer Zorn|16:@asi|17:|18:Tierzauber|19:@boon|20:Erzdruide'),
      2014: F('1:Druidisch,Zauberwirken|2:Tiergestalt,@sub|3:|4:Verbesserte Tiergestalt,@asi|5:|6:@sub|7:|8:Verbesserte Tiergestalt,@asi|9:|10:@sub|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:|18:Zeitloser Körper,Tierzauber|19:@asi|20:Erzdruide'),
    },
  },
  {
    key: 'kaempfer', name: 'Kämpfer', hd: 10, primary: ['str', 'dex'], saves: ['str', 'con'], subLabel: 'Archetyp', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 2, list: { 2014: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'], 2024: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'] } },
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: { 2014: ['simple', 'martial'], 2024: ['simple', 'martial'] }, tools: '', style: 1,
    mc: { req: [['str'], ['dex']], any: true, gain: 'Leichte und mittelschwere Rüstung, Schilde, einfache und Kriegswaffen' },
    equip: { 2024: 'A: Kettenpanzer, Zweihandschwert, Flegel, 8 Wurfspeere, Gewölbeforscherausrüstung, 4 GM · B: Beschlagene Lederrüstung, Krummsäbel, Kurzschwert, Langbogen, 20 Pfeile, Köcher, Gewölbeforscherausrüstung, 11 GM', 2014: 'Kettenpanzer, Langschwert, Schild, leichte Armbrust mit 20 Bolzen, Gewölbeforscherausrüstung' }, gold: { 2024: 155, 2014: '5d4×10' },
    subclasses: { 2014: ['Champion'], 2024: ['Champion'] },
    feat: {
      2024: F('1:Kampfstil,Zweiter Wind,Waffenmeisterschaft|2:Tatendrang,Taktisches Gespür|3:@sub|4:@asi|5:Extra-Angriff,Taktische Verlagerung|6:@asi|7:@sub|8:@asi|9:Unbeugsam,Taktischer Meister|10:@sub|11:Zwei Extra-Angriffe|12:@asi|13:Unbeugsam,Gezielte Angriffe|14:@asi|15:@sub|16:@asi|17:Tatendrang,Unbeugsam|18:@sub|19:@boon|20:Drei Extra-Angriffe'),
      2014: F('1:Kampfstil,Zweiter Wind|2:Tatendrang|3:@sub|4:@asi|5:Extra-Angriff|6:@asi|7:@sub|8:@asi|9:Unbeugsam|10:@sub|11:Zwei Extra-Angriffe|12:@asi|13:Unbeugsam|14:@asi|15:@sub|16:@asi|17:Tatendrang,Unbeugsam|18:@sub|19:@asi|20:Drei Extra-Angriffe'),
    },
  },
  {
    key: 'moench', name: 'Mönch', hd: 8, primary: ['dex', 'wis'], saves: ['str', 'dex'], subLabel: 'Tradition', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 2, list: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] }, armor: [], weapons: { 2014: ['simple', 'kurzschwert'], 2024: ['simple', 'martial-light'] }, tools: 'Ein Handwerkerwerkzeug oder Musikinstrument',
    unarmored: 'wis', mc: { req: [['dex', 'wis']], gain: 'Einfache Waffen, Kurzschwerter' },
    equip: { 2024: 'Speer, 5 Dolche, Handwerkerwerkzeug oder Musikinstrument, Entdeckerausrüstung, 11 GM', 2014: 'Kurzschwert, Gewölbeforscherausrüstung, 10 Wurfpfeile' }, gold: { 2024: 50, 2014: '5d4' },
    subclasses: { 2014: ['Weg der offenen Hand'], 2024: ['Krieger der offenen Hand'] },
    feat: {
      2024: F('1:Kampfkunst,Ungerüstete Verteidigung|2:Fokus des Mönchs,Ungerüstete Bewegung,Unheimlicher Stoffwechsel|3:Angriffe ablenken,@sub|4:@asi,Langsamer Fall|5:Extra-Angriff,Betäubender Schlag|6:Gestärkte Schläge,@sub|7:Entrinnen|8:@asi|9:Akrobatische Bewegung|10:Erhöhter Fokus,Selbstheilung|11:@sub|12:@asi|13:Energie ablenken|14:Disziplinierte Überlebenskunst|15:Perfekter Fokus|16:@asi|17:@sub|18:Überlegene Verteidigung|19:@boon|20:Körper und Geist'),
      2014: F('1:Ungerüstete Verteidigung,Kampfkunst|2:Ki,Ungerüstete Bewegung|3:@sub,Geschosse abwehren|4:@asi,Langsamer Fall|5:Extra-Angriff,Betäubender Schlag|6:Ki-gestärkte Schläge,@sub|7:Entrinnen,Stille des Geistes|8:@asi|9:Verbesserte ungerüstete Bewegung|10:Reinheit des Körpers|11:@sub|12:@asi|13:Zunge von Sonne und Mond|14:Diamantseele|15:Zeitloser Körper|16:@asi|17:@sub|18:Leerer Körper|19:@asi|20:Perfektes Selbst'),
    },
  },
  {
    key: 'paladin', name: 'Paladin', hd: 10, primary: ['str', 'cha'], saves: ['wis', 'cha'], subLabel: 'Eid', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 2, list: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] }, armor: ['light', 'medium', 'heavy', 'shield'], weapons: { 2014: ['simple', 'martial'], 2024: ['simple', 'martial'] }, tools: '', style: 2,
    mc: { req: [['str', 'cha']], gain: 'Leichte und mittelschwere Rüstung, Schilde, einfache und Kriegswaffen' },
    cast: { type: 'half', ability: 'cha', prep14: 'half', prep24: PREP_HALF_24 },
    equip: { 2024: 'Kettenpanzer, Schild, Langschwert, 6 Wurfspeere, Heiliges Symbol, Priesterausrüstung, 9 GM', 2014: 'Langschwert, Schild, 5 Wurfspeere, Priesterausrüstung, Kettenpanzer, Heiliges Symbol' }, gold: { 2024: 150, 2014: '5d4×10' },
    subclasses: { 2014: ['Eid der Hingabe'], 2024: ['Eid der Hingabe'] },
    feat: {
      2024: F('1:Handauflegen,Zauberwirken,Waffenmeisterschaft|2:Kampfstil,Göttliches Niederstrecken|3:Göttliche Macht fokussieren,@sub|4:@asi|5:Extra-Angriff,Treues Ross|6:Aura des Schutzes|7:@sub|8:@asi|9:Feinde abschwören|10:Aura des Mutes|11:Strahlende Schläge|12:@asi|13:|14:Wiederherstellende Berührung|15:@sub|16:@asi|17:|18:Aura-Ausdehnung|19:@boon|20:@sub'),
      2014: F('1:Göttliches Gespür,Handauflegen|2:Kampfstil,Zauberwirken,Göttliches Niederstrecken|3:Göttliche Gesundheit,@sub|4:@asi|5:Extra-Angriff|6:Aura des Schutzes|7:@sub|8:@asi|9:|10:Aura des Mutes|11:Verbessertes göttliches Niederstrecken|12:@asi|13:|14:Reinigende Berührung|15:@sub|16:@asi|17:|18:Aura-Ausdehnung|19:@asi|20:@sub'),
    },
  },
  {
    key: 'waldlaeufer', name: 'Waldläufer', hd: 10, primary: ['dex', 'wis'], saves: ['str', 'dex'], subLabel: 'Archetyp', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 3, list: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] }, armor: ['light', 'medium', 'shield'], weapons: { 2014: ['simple', 'martial'], 2024: ['simple', 'martial'] }, tools: '', style: 2,
    mc: { req: [['dex', 'wis']], gain: 'Leichte und mittelschwere Rüstung, Schilde, einfache und Kriegswaffen, eine Fertigkeit' },
    cast: { type: 'half', ability: 'wis', known14: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11], prep24: PREP_HALF_24 },
    expertise: { 2024: { 9: 2 } },
    equip: { 2024: 'Beschlagene Lederrüstung, Krummsäbel, Kurzschwert, Langbogen, 20 Pfeile, Köcher, Druidenfokus (Mistelzweig), Entdeckerausrüstung, 7 GM', 2014: 'Schuppenpanzer, 2 Kurzschwerter, Entdeckerausrüstung, Langbogen mit 20 Pfeilen' }, gold: { 2024: 150, 2014: '5d4×10' },
    subclasses: { 2014: ['Jäger'], 2024: ['Jäger'] },
    feat: {
      2024: F('1:Zauberwirken,Bevorzugter Feind,Waffenmeisterschaft|2:Geschickter Entdecker,Kampfstil|3:@sub|4:@asi|5:Extra-Angriff|6:Umherstreifen|7:@sub|8:@asi|9:Expertise|10:Unermüdlich|11:@sub|12:@asi|13:Unerbittlicher Jäger|14:Schleier der Natur|15:@sub|16:@asi|17:Präziser Jäger|18:Wilde Sinne|19:@boon|20:Feindtöter'),
      2014: F('1:Bevorzugter Feind,Natürlicher Entdecker|2:Kampfstil,Zauberwirken|3:@sub,Urtümliches Bewusstsein|4:@asi|5:Extra-Angriff|6:Bevorzugter Feind,Natürlicher Entdecker|7:@sub|8:@asi,Geländegänger|9:|10:Natürlicher Entdecker,Tarnung in der Wildnis|11:@sub|12:@asi|13:|14:Bevorzugter Feind,Verschwinden|15:@sub|16:@asi|17:|18:Wilde Sinne|19:@asi|20:Feindtöter'),
    },
  },
  {
    key: 'schurke', name: 'Schurke', hd: 8, primary: ['dex'], saves: ['dex', 'int'], subLabel: 'Archetyp', subLevel: { 2014: 3, 2024: 3 },
    skills: { n: 4, list: { 2014: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight', 'stealth'], 2024: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight', 'stealth'] } },
    armor: ['light'], weapons: { 2014: ['simple', 'handarmbrust', 'langschwert', 'rapier', 'kurzschwert'], 2024: ['simple', 'martial-finesse'] }, tools: 'Diebeswerkzeug',
    mc: { req: [['dex']], gain: 'Leichte Rüstung, eine Fertigkeit, Diebeswerkzeug' },
    expertise: { 2014: { 1: 2, 6: 2 }, 2024: { 1: 2, 6: 2 } },
    equip: { 2024: 'Lederrüstung, 2 Dolche, Kurzschwert, Kurzbogen, 20 Pfeile, Köcher, Diebeswerkzeug, Einbrecherausrüstung, 8 GM', 2014: 'Rapier, Kurzbogen mit 20 Pfeilen, Einbrecherausrüstung, Lederrüstung, 2 Dolche, Diebeswerkzeug' }, gold: { 2024: 100, 2014: '4d4×10' },
    subclasses: { 2014: ['Dieb'], 2024: ['Dieb'] },
    feat: {
      2024: F('1:Expertise,Hinterhältiger Angriff,Diebessprache,Waffenmeisterschaft|2:Raffinierte Aktion|3:@sub,Ruhiges Zielen|4:@asi|5:Gerissener Schlag,Unglaubliches Ausweichen|6:Expertise|7:Entrinnen,Verlässliches Talent|8:@asi|9:@sub|10:@asi|11:Verbesserter gerissener Schlag|12:@asi|13:@sub|14:Hinterlistige Schläge|15:Schlüpfriger Geist|16:@asi|17:@sub|18:Schwer fassbar|19:@boon|20:Glückstreffer'),
      2014: F('1:Expertise,Hinterhältiger Angriff,Diebessprache|2:Raffinierte Aktion|3:@sub|4:@asi|5:Unglaubliches Ausweichen|6:Expertise|7:Entrinnen|8:@asi|9:@sub|10:@asi|11:Verlässliches Talent|12:@asi|13:@sub|14:Blindgespür|15:Schlüpfriger Geist|16:@asi|17:@sub|18:Schwer fassbar|19:@asi|20:Glückstreffer'),
    },
  },
  {
    key: 'zauberer', name: 'Zauberer', hd: 6, primary: ['cha'], saves: ['con', 'cha'], subLabel: 'Ursprung', subLevel: { 2014: 1, 2024: 3 },
    skills: { n: 2, list: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] }, armor: [], weapons: { 2014: ['dolch', 'wurfpfeil', 'schleuder', 'kampfstab', 'leichtearmbrust'], 2024: ['simple'] }, tools: '',
    mc: { req: [['cha']], gain: '–' },
    cast: { type: 'full', ability: 'cha', cantrips: CANTRIPS(4), known14: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15], prep24: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22] },
    equip: { 2024: 'Speer, 2 Dolche, Arkaner Fokus (Kristall), Gewölbeforscherausrüstung, 28 GM', 2014: 'Leichte Armbrust mit 20 Bolzen, Komponentenbeutel, Gewölbeforscherausrüstung, 2 Dolche' }, gold: { 2024: 50, 2014: '3d4×10' },
    subclasses: { 2014: ['Drachenblutlinie'], 2024: ['Drakonische Zauberei'] },
    feat: {
      2024: F('1:Zauberwirken,Angeborene Zauberei|2:Quelle der Magie,Metamagie|3:@sub|4:@asi|5:Zauberische Wiederherstellung|6:@sub|7:Zauberische Verkörperung|8:@asi|9:|10:Metamagie|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:Metamagie|18:@sub|19:@boon|20:Arkane Apotheose'),
      2014: F('1:Zauberwirken,@sub|2:Quelle der Magie|3:Metamagie|4:@asi|5:|6:@sub|7:|8:@asi|9:|10:Metamagie|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:Metamagie|18:@sub|19:@asi|20:Zauberische Wiederherstellung'),
    },
  },
  {
    key: 'hexenmeister', name: 'Hexenmeister', hd: 8, primary: ['cha'], saves: ['wis', 'cha'], subLabel: 'Schutzherr', subLevel: { 2014: 1, 2024: 3 },
    skills: { n: 2, list: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] }, armor: ['light'], weapons: { 2014: ['simple'], 2024: ['simple'] }, tools: '',
    mc: { req: [['cha']], gain: 'Leichte Rüstung, einfache Waffen' },
    cast: { type: 'pact', ability: 'cha', cantrips: CANTRIPS(2), known14: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15], prep24: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    equip: { 2024: 'Lederrüstung, Sichel, 2 Dolche, Arkaner Fokus (Kugel), Buch (okkultes Wissen), Gelehrtenausrüstung, 15 GM', 2014: 'Leichte Armbrust mit 20 Bolzen, Komponentenbeutel, Gelehrtenausrüstung, Lederrüstung, einfache Waffe, 2 Dolche' }, gold: { 2024: 100, 2014: '4d4×10' },
    subclasses: { 2014: ['Der Unhold'], 2024: ['Unhold-Schutzherr'] },
    feat: {
      2024: F('1:Schauerliche Anrufungen,Paktmagie|2:Magische Gerissenheit|3:@sub|4:@asi|5:|6:@sub|7:|8:@asi|9:Kontakt zum Schutzherrn|10:@sub|11:Mystisches Arkanum (6. Grad)|12:@asi|13:Mystisches Arkanum (7. Grad)|14:@sub|15:Mystisches Arkanum (8. Grad)|16:@asi|17:Mystisches Arkanum (9. Grad)|18:|19:@boon|20:Schauerlicher Meister'),
      2014: F('1:@sub,Paktmagie|2:Schauerliche Anrufungen|3:Paktgabe|4:@asi|5:|6:@sub|7:|8:@asi|9:|10:@sub|11:Mystisches Arkanum (6. Grad)|12:@asi|13:Mystisches Arkanum (7. Grad)|14:@sub|15:Mystisches Arkanum (8. Grad)|16:@asi|17:Mystisches Arkanum (9. Grad)|18:|19:@asi|20:Schauerlicher Meister'),
    },
  },
  {
    key: 'magier', name: 'Magier', hd: 6, primary: ['int'], saves: ['int', 'wis'], subLabel: 'Schule', subLevel: { 2014: 2, 2024: 3 },
    skills: { n: 2, list: { 2014: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'], 2024: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'] } },
    armor: [], weapons: { 2014: ['dolch', 'wurfpfeil', 'schleuder', 'kampfstab', 'leichtearmbrust'], 2024: ['simple'] }, tools: '',
    mc: { req: [['int']], gain: '–' },
    cast: { type: 'full', ability: 'int', cantrips: CANTRIPS(3), prep14: 'level', prep24: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25] },
    equip: { 2024: '2 Dolche, Arkaner Fokus (Stab), Robe, Zauberbuch, Gelehrtenausrüstung, 5 GM', 2014: 'Kampfstab, Komponentenbeutel, Gelehrtenausrüstung, Zauberbuch' }, gold: { 2024: 55, 2014: '4d4×10' },
    subclasses: { 2014: ['Schule der Hervorrufung'], 2024: ['Hervorrufer'] },
    feat: {
      2024: F('1:Zauberwirken,Ritualkundiger,Arkane Erholung|2:Gelehrter|3:@sub|4:@asi|5:Auswendig gelernter Zauber|6:@sub|7:|8:@asi|9:|10:@sub|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:|18:Zaubermeisterschaft|19:@boon|20:Signaturzauber'),
      2014: F('1:Zauberwirken,Arkane Erholung|2:@sub|3:|4:@asi|5:|6:@sub|7:|8:@asi|9:|10:@sub|11:|12:@asi|13:|14:@sub|15:|16:@asi|17:|18:Zaubermeisterschaft|19:@asi|20:Signaturzauber'),
    },
  },
];

export const FEATURE_INFO = {
  Kampfrausch: 'Bonusaktion: Vorteil auf STÄ-Proben und -Rettungswürfe, Schadensbonus auf STÄ-Angriffe, Resistenz gegen Hieb-, Stich- und Wuchtschaden. Keine Zauber, keine Konzentration.',
  'Ungerüstete Verteidigung': 'Ohne Rüstung: RK = 10 + GES + KON (Barbar, Schild erlaubt) bzw. 10 + GES + WEI (Mönch).',
  Waffenmeisterschaft: 'Du nutzt die Meisterschafts-Eigenschaft ausgewählter Waffen (z. B. Spalten, Umstoßen, Verlangsamen).',
  Gefahrengespür: 'Vorteil auf GES-Rettungswürfe gegen Effekte, die du sehen kannst.',
  'Tollkühner Angriff': 'Vorteil auf STÄ-Nahkampfangriffe in diesem Zug – dafür haben Angriffe gegen dich Vorteil.',
  'Extra-Angriff': 'Mit der Angriffsaktion greifst du zweimal an.',
  'Zwei Extra-Angriffe': 'Mit der Angriffsaktion greifst du dreimal an.',
  'Drei Extra-Angriffe': 'Mit der Angriffsaktion greifst du viermal an.',
  'Schnelle Bewegung': '+3 m Bewegung ohne schwere Rüstung.',
  'Brutaler Schlag': 'Statt Vorteil beim tollkühnen Angriff: +1W10 Schaden und ein Zusatzeffekt.',
  'Unerbittlicher Kampfrausch': 'Im Kampfrausch bei 0 TP: KON-Rettungswurf (SG 10, steigt) – bei Erfolg stattdessen TP.',
  'Bardische Inspiration': 'Bonusaktion: Ein Verbündeter erhält einen Inspirationswürfel für einen W20-Wurf. Anzahl = CHA-Mod (mind. 1).',
  Alleskönner: 'Halber Übungsbonus auf Attributswürfe ohne Übung (auch Initiative).',
  Expertise: 'Doppelter Übungsbonus auf zwei gewählte, geübte Fertigkeiten.',
  'Quelle der Inspiration': 'Bardische Inspiration kehrt auch nach einer kurzen Rast zurück.',
  Zauberwirken: 'Du wirkst Zauber deiner Klasse: Zaubertricks, vorbereitete bzw. bekannte Zauber und Zauberplätze.',
  Paktmagie: 'Wenige, dafür immer höchstgradige Zauberplätze, die nach einer kurzen Rast zurückkehren.',
  'Göttliche Macht fokussieren': 'Göttliche Energie für besondere Effekte der Domäne bzw. des Eides.',
  'Göttliche Ordnung': 'Beschützer (Kriegswaffen & schwere Rüstung) oder Thaumaturg (Zaubertrick + WEI auf Arkane Kunde/Religion).',
  'Ursprüngliche Ordnung': 'Magier (Zaubertrick + WEI auf Arkane Kunde/Naturkunde) oder Wächter (Kriegswaffen & mittelschwere Rüstung).',
  Tiergestalt: 'Verwandlung in ein Tier, das du gesehen hast.',
  'Zweiter Wind': 'Bonusaktion: TP in Höhe von W10 + Kämpferstufe zurück.',
  Tatendrang: 'Einmal pro Rast eine zusätzliche Aktion.',
  Unbeugsam: 'Einen misslungenen Rettungswurf wiederholen.',
  Kampfstil: 'Eine Kampfspezialisierung, z. B. Bogenschießen (+2 auf Fernkampfangriffe) oder Verteidigung (+1 RK in Rüstung).',
  Kampfkunst: 'GES für waffenlose Schläge und Mönchswaffen, Kampfkunstwürfel als Schaden, waffenloser Schlag als Bonusaktion.',
  'Fokus des Mönchs': 'Fokuspunkte (= Stufe) für Schlaghagel, Geduldige Verteidigung und Schritt des Windes.',
  Ki: 'Ki-Punkte (= Stufe) für Schlaghagel, Geduldige Verteidigung und Schritt des Windes.',
  'Betäubender Schlag': 'Bei einem Treffer 1 Punkt ausgeben: KON-Rettungswurf oder betäubt.',
  Handauflegen: 'Heilvorrat von 5 × Paladinstufe TP; auch gegen Gift.',
  'Göttliches Niederstrecken': 'Nach einem Treffer einen Zauberplatz für zusätzlichen gleißenden Schaden (2W8, +1W8 pro Grad) verbrauchen.',
  'Aura des Schutzes': 'Du und Verbündete in der Nähe addieren deinen CHA-Mod zu Rettungswürfen.',
  'Bevorzugter Feind': '2024: Jagdmal einige Male ohne Zauberplatz. 2014: Vorteile beim Aufspüren und Erinnern an einen Feindtyp.',
  'Hinterhältiger Angriff': 'Einmal pro Zug Zusatzschaden (1W6 je zwei Stufen) mit Finesse- oder Fernkampfwaffe bei Vorteil oder Verbündetem neben dem Ziel.',
  'Raffinierte Aktion': 'Spurt, Rückzug oder Verstecken als Bonusaktion.',
  'Unglaubliches Ausweichen': 'Reaktion: den Schaden eines Angriffs halbieren.',
  Entrinnen: 'GES-Rettungswurf gegen Flächen: bei Erfolg kein, bei Misserfolg halber Schaden.',
  'Verlässliches Talent': 'Bei geübten Attributswürfen zählt ein W20-Ergebnis unter 10 als 10.',
  'Gerissener Schlag': 'Hinterhältige Würfel gegen Effekte tauschen (Gift, Stolpern, Rückzug).',
  'Quelle der Magie': 'Zaubereipunkte (= Stufe) – tauschbar gegen Zauberplätze und für Metamagie.',
  Metamagie: 'Zauber verändern: z. B. beschleunigt, weitreichend, verstärkt, lautlos.',
  'Schauerliche Anrufungen': 'Dauerhafte magische Kräfte nach Wahl (z. B. Schauerlicher Stoß verstärken).',
  'Arkane Erholung': 'Einmal pro Tag nach einer kurzen Rast Zauberplätze bis zur halben Magierstufe zurückgewinnen.',
  'Epische Gabe': 'Ein Epische-Gabe-Talent (Attribut +1, max. 30) oder ein anderes Talent.',
  'Attributswerterhöhung': '+2 auf ein Attribut oder +1 auf zwei (max. 20) – oder stattdessen ein Talent.',
};

// ───────────────────────── Sprachen ─────────────────────────
export const LANGUAGES = ['Gemeinsprache', 'Gebärdensprache', 'Zwergisch', 'Elfisch', 'Riesisch', 'Gnomisch', 'Koboldisch', 'Halblingisch', 'Orkisch', 'Drakonisch', 'Abyssisch', 'Celestisch', 'Tiefensprache', 'Infernalisch', 'Urtümlich', 'Sylvanisch', 'Gemeinsprache der Unterreiche', 'Druidisch', 'Diebessprache'];

// ───────────────────────── Nachschlagen ─────────────────────────
export const edOf = (c) => (c?.edition === '2024' ? '2024' : '2014');
export const classesFor = (ed) => CLASSES.filter((c) => !c.ed || c.ed === ed);
export const findClass = (k) => CLASSES.find((c) => c.key === k || c.name === k) || null;
export const findSpecies = (ed, k) => SPECIES[ed].find((s) => s.key === k || s.name === k) || null;
export const findBackground = (ed, k) => BACKGROUNDS[ed].find((b) => b.key === k || b.name === k) || null;
export const findFeat = (k) => FEATS.find((f) => f.key === k) || null;
export const featsFor = (ed, cats) => FEATS.filter((f) => (!f.ed || f.ed === ed) && (!cats || cats.includes(f.cat)));
export const featAsi = (f, ed) => (f ? (ed === '2024' ? f.a24 : f.a14) || null : null);
export const perEd = (v, ed) => (v && !Array.isArray(v) && typeof v === 'object' && (v[2014] || v[2024]) ? v[ed] || v[2014] || v[2024] : v);
export const classSkills = (cls, ed) => {
  const list = perEd(cls.skills.list, ed);
  return { n: cls.skills.n, list: list === 'any' ? ALL_SKILLS : list };
};

export const totalLevel = (c) => (c?.classes?.length ? c.classes.reduce((a, x) => a + (Number(x.level) || 0), 0) : Number(c?.level) || 1);
export const classLevel = (c, key) => c?.classes?.find((x) => x.cls === key)?.level || 0;
export const classLabel = (c) => (c?.classes?.length
  ? c.classes.map((x) => `${findClass(x.cls)?.name || x.cls} ${x.level}${x.subclass ? ` (${x.subclass})` : ''}`).join(' / ')
  : c?.cls || '');

export const subclassFeatures = (clsKey, sub) => (sub ? SUBCLASS_FEATURES[`${clsKey}|${sub}`] || null : null);
// Beschreibung einer Unterklasse für die Auswahl – mit ihren Merkmalen je Stufe, falls ein Regelpaket sie angibt
export function subclassText(clsKey, name) {
  const base = SUBCLASS_DESC[name] || '';
  const f = subclassFeatures(clsKey, name);
  if (!f) return base;
  const lines = Object.entries(f).sort((a, b) => a[0] - b[0]).flatMap(([l, list]) => list.map((x) => `Stufe ${l} – ${x.name}${x.desc ? `: ${x.desc}` : ''}`));
  return [base, ...lines].filter(Boolean).join('\n\n');
}
// Merkmale einer Klasse von Stufe from bis to (sub: gewählte Unterklasse – deren Merkmale aus Regelpaketen erscheinen einzeln)
export function classFeatures(clsKey, ed, to, from = 1, sub = '') {
  const cls = findClass(clsKey);
  if (!cls) return [];
  const table = (cls.feat && (cls.feat[ed] || cls.feat[2014] || cls.feat[2024])) || {};
  const subLvl = cls.subLevel?.[ed] || cls.subLevel?.[2014] || 3;
  const subF = subclassFeatures(clsKey, sub);
  const out = [];
  for (let l = from; l <= to; l++) {
    const own = subF?.[l] || [];
    for (const f of table[l] || []) {
      if (f === '@asi') out.push({ level: l, kind: 'asi', name: 'Attributswerterhöhung', desc: FEATURE_INFO['Attributswerterhöhung'] });
      else if (f === '@boon') out.push({ level: l, kind: 'boon', name: 'Epische Gabe', desc: FEATURE_INFO['Epische Gabe'] });
      else if (f === '@sub') {
        if (l === subLvl || !own.length) out.push({ level: l, kind: 'sub', name: l === subLvl ? `${cls.subLabel} wählen` : `${cls.subLabel}: Merkmal`, desc: l === subLvl ? `Du wählst deine Unterklasse (${cls.subLabel}).` : `Neues Merkmal deiner Unterklasse (${cls.subLabel}).` });
      } else out.push({ level: l, kind: 'feature', name: f, desc: FEATURE_INFO[f] || '' });
    }
    for (const f of own) out.push({ level: l, kind: 'subfeature', name: f.name, desc: f.desc || FEATURE_INFO[f.name] || '', sub });
  }
  return out;
}

export const isAsiLevel = (clsKey, ed, l) => classFeatures(clsKey, ed, l, l).some((f) => f.kind === 'asi' || f.kind === 'boon');
export const subclassLevel = (clsKey, ed) => findClass(clsKey)?.subLevel[ed] || 3;

// ───────────────────────── Zauber ─────────────────────────
const FULL = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const THIRD_SUBS = ['Mystischer Ritter', 'Arkaner Betrüger'];

function casterType(x) {
  const cls = findClass(x.cls);
  if (cls?.cast?.type && cls.cast.type !== 'none') return cls.cast.type;
  if (THIRD_SUBS.includes(x.subclass) || SUBCLASS_META[x.subclass]?.caster === 'third') return 'third';
  return null;
}
// Zaubertricks je Stufe: Funktion (Grundbestand), Liste mit 20 Werten oder feste Zahl (Regelpakete)
const perLevel = (v, lvl) => (typeof v === 'function' ? v(lvl) : Array.isArray(v) ? Number(v[Math.max(0, Math.min(v.length, lvl) - 1)]) || 0 : Number(v) || 0);

export function pactSlots(level) {
  if (!level) return null;
  return { count: level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1, level: level >= 9 ? 5 : Math.ceil(level / 2) };
}

// Zauberplätze (inkl. Mehrklassen-Regel) und Paktmagie
export function spellSlots(c) {
  const ed = edOf(c);
  const list = (c.classes || []).map((x) => ({ ...x, type: casterType(x) })).filter((x) => x.type);
  const pactLvl = list.filter((x) => x.type === 'pact').reduce((a, x) => a + x.level, 0);
  const casters = list.filter((x) => x.type !== 'pact');
  let casterLevel = 0;
  if (casters.length === 1) {
    const x = casters[0];
    if (x.type === 'full') casterLevel = x.level;
    else if (x.type === 'artificer') casterLevel = Math.ceil(x.level / 2);
    else if (x.type === 'half') casterLevel = ed === '2014' && x.level < 2 ? 0 : Math.ceil(x.level / 2);
    else if (x.type === 'third') casterLevel = x.level < 3 ? 0 : Math.ceil(x.level / 3);
  } else {
    for (const x of casters) {
      if (x.type === 'full') casterLevel += x.level;
      else if (x.type === 'artificer') casterLevel += Math.ceil(x.level / 2);
      else if (x.type === 'half') casterLevel += ed === '2024' ? Math.ceil(x.level / 2) : Math.floor(x.level / 2);
      else if (x.type === 'third') casterLevel += Math.floor(x.level / 3);
    }
  }
  const slots = {};
  if (casterLevel > 0) (FULL[Math.min(20, casterLevel) - 1] || []).forEach((n, i) => { slots[i + 1] = n; });
  return { slots, pact: pactSlots(pactLvl) };
}

// Zaubertricks und vorbereitete/bekannte Zauber einer Klasse
export function spellcasting(x, ed, mods) {
  const cls = findClass(x.cls);
  const lvl = x.level;
  let cast = cls?.cast?.type && cls.cast.type !== 'none' ? cls.cast : null;
  const meta = SUBCLASS_META[x.subclass];
  if (!cast && (THIRD_SUBS.includes(x.subclass) || meta?.caster === 'third') && lvl >= 3) {
    const t = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
    return { ability: meta?.ability || 'int', cantrips: x.subclass === 'Arkaner Betrüger' ? (lvl >= 10 ? 4 : 3) : lvl >= 10 ? 3 : 2, count: t[lvl - 3], mode: ed === '2024' ? 'vorbereitet' : 'bekannt' };
  }
  if (!cast) return null;
  if (cast.type === 'half' && ed === '2014' && lvl < 2) return null;
  const ab = cast.ability;
  const m = mods?.[ab] ?? 0;
  const cantrips = cast.cantrips ? perLevel(cast.cantrips, lvl) : 0;
  let count;
  let mode;
  if (ed === '2024' && cast.prep24) {
    count = cast.prep24[lvl - 1];
    mode = 'vorbereitet';
  } else if (cast.known14) {
    count = cast.known14[lvl - 1];
    mode = 'bekannt';
  } else if (cast.prep14 === 'level') {
    count = Math.max(1, m + lvl);
    mode = 'vorbereitet';
  } else if (cast.prep14 === 'half') {
    count = Math.max(1, m + Math.floor(lvl / 2));
    mode = 'vorbereitet';
  }
  if (count == null && cast.prep != null) { count = perLevel(cast.prep, lvl); mode = cast.mode === 'known' ? 'bekannt' : 'vorbereitet'; }
  return { ability: ab, cantrips, count, mode, spellbook: x.cls === 'magier' || cast.mode === 'book' ? 6 + (lvl - 1) * 2 : null };
}

// ───────────────────────── Berechnungen für den Bogen ─────────────────────────
export function hpAverage(hd) {
  return Math.floor(hd / 2) + 1;
}

export function hpBonusPerLevel(c) {
  const ed = edOf(c);
  const sp = findSpecies(ed, c.speciesKey);
  const sub = sp?.subs?.find((s) => s.key === c.subspeciesKey);
  let n = (sp?.hpPerLevel || 0) + (sub?.hpPerLevel || 0);
  for (const f of c.feats || []) n += findFeat(f.key)?.hpPerLevel || 0;
  return n;
}

// Rüstungsklasse aus getragener Rüstung, Schild, ungerüsteter Verteidigung und Kampfstil
export function computeAC(c, mods) {
  const ed = edOf(c);
  const armor = findArmor(c.armor?.body);
  const shield = !!c.armor?.shield;
  const dex = mods.dex;
  const parts = [];
  let ac;
  if (armor) {
    const d = armor.type === 'light' ? dex : armor.type === 'medium' ? Math.min(2, dex) : 0;
    ac = armor.ac + d;
    parts.push(`${armor.name} ${armor.ac}${armor.type !== 'heavy' ? ` + GES ${d}` : ''}`);
  } else {
    const opts = [{ v: 10 + dex, t: `10 + GES ${dex}` }];
    if (classLevel(c, 'barbar')) opts.push({ v: 10 + dex + mods.con, t: `Ungerüstet: 10 + GES + KON` });
    if (classLevel(c, 'moench') && !shield) opts.push({ v: 10 + dex + mods.wis, t: `Ungerüstet: 10 + GES + WEI` });
    const sorc = c.classes?.find((x) => x.cls === 'zauberer' && /Drachenblut|Drakonisch/.test(x.subclass || ''));
    if (sorc && (ed === '2014' || sorc.level >= 3)) opts.push(ed === '2014' ? { v: 13 + dex, t: 'Drachenhaut: 13 + GES' } : { v: 10 + dex + mods.cha, t: 'Drachenhaut: 10 + GES + CHA' });
    const best = opts.sort((a, b) => b.v - a.v)[0];
    ac = best.v;
    parts.push(best.t);
  }
  if (shield) { ac += 2; parts.push('Schild +2'); }
  if (armor && (c.feats || []).some((f) => f.key === 'style-defense')) { ac += 1; parts.push('Verteidigung +1'); }
  const bonus = Number(c.acBonus) || 0;
  if (bonus) { ac += bonus; parts.push(`Magie/Sonstiges ${bonus > 0 ? '+' : ''}${bonus}`); }
  return { ac, parts, stealthDis: !!armor?.stealth, heavyStrShort: armor?.str && (c.abilities?.str || 10) < armor.str };
}

export function weaponProficient(c, w) {
  const ed = edOf(c);
  for (const x of c.classes || []) {
    const cls = findClass(x.cls);
    const list = perEd(cls?.weapons, ed) || [];
    if (list.includes(w.cat) || list.includes(w.key)) return true;
    if (list.includes('martial-light') && w.cat === 'martial' && w.p.includes('l')) return true;
    if (list.includes('martial-finesse') && w.cat === 'martial' && (w.p.includes('f') || w.p.includes('l'))) return true;
  }
  return (c.extraWeapons || []).includes(w.key);
}

export function weaponAttack(c, w, mods, pbv) {
  const ranged = w.p.includes('a') || w.p.includes('A');
  const finesse = w.p.includes('f');
  const ab = finesse ? (mods.dex >= mods.str ? 'dex' : 'str') : ranged ? 'dex' : 'str';
  const monk = classLevel(c, 'moench') && w.cat === 'simple' && !w.p.includes('h') ? (mods.dex > mods[ab] ? 'dex' : ab) : ab;
  const m = mods[monk];
  const prof = weaponProficient(c, w);
  const feats = new Set((c.feats || []).map((f) => f.key));
  const bonus = m + (prof ? pbv : 0) + (ranged && feats.has('style-archery') ? 2 : 0);
  const dmgMod = m + (!ranged && feats.has('style-dueling') && !w.p.includes('2') ? 2 : 0);
  return {
    key: w.key, name: w.name, ability: monk, prof, bonus,
    damage: `${w.dmg}${dmgMod ? (dmgMod > 0 ? `+${dmgMod}` : dmgMod) : ''}`,
    versatile: w.vers ? `${w.vers}${dmgMod ? (dmgMod > 0 ? `+${dmgMod}` : dmgMod) : ''}` : null,
    type: w.type, props: [...w.p].map((x) => PROP_NAMES[x]).filter(Boolean).join(', '), mastery: w.m, gwf: w.p.includes('2') || w.p.includes('v'),
  };
}

// Alle Werte, die der Bogen und die Würfel brauchen
export function charMods(c) {
  const ed = edOf(c);
  const level = totalLevel(c);
  const pbv = profBonus(level);
  const abil = c.abilities || {};
  const mods = Object.fromEntries(AB.map((k) => [k, abMod(abil[k] ?? 10)]));
  const jack = classLevel(c, 'barde') >= 2 ? Math.floor(pbv / 2) : 0;
  const saves = Object.fromEntries(AB.map((k) => {
    const prof = (c.saves || []).includes(k);
    return [k, { prof, bonus: mods[k] + (prof ? pbv : 0) }];
  }));
  const skills = Object.fromEntries(ALL_SKILLS.map((k) => {
    const p = Number(c.skills?.[k]) || 0;
    const bonus = mods[skillAbility(k)] + (p === 2 ? pbv * 2 : p === 1 ? pbv : jack);
    return [k, { prof: p, bonus }];
  }));
  const feats = new Set((c.feats || []).map((f) => f.key));
  const init = mods.dex + (feats.has('alert') ? (ed === '2024' ? pbv : 5) : 0) + (jack && !feats.has('alert') ? jack : 0) + (Number(c.initBonus) || 0);
  const passive = {
    perception: 10 + skills.perception.bonus + (feats.has('observant') && ed === '2014' ? 5 : 0),
    insight: 10 + skills.insight.bonus,
    investigation: 10 + skills.investigation.bonus + (feats.has('observant') && ed === '2014' ? 5 : 0),
  };
  const casting = (c.classes || []).map((x) => ({ cls: x.cls, ...spellcasting(x, ed, mods) })).filter((x) => x.ability);
  const spell = casting.map((x) => ({ ...x, dc: 8 + pbv + mods[x.ability], attack: pbv + mods[x.ability] }));
  const ac = computeAC(c, mods);
  return { ed, level, pb: pbv, mods, saves, skills, init, passive, spell, ac, jack };
}

// Standard-Effekte für die Würfel aus Volk, Talenten, Klassen und Zustand
export function rollTraits(c) {
  if (!c) return {};
  const ed = edOf(c);
  const sp = findSpecies(ed, c.speciesKey);
  const feats = new Set((c.feats || []).map((f) => f.key));
  const rogue = classLevel(c, 'schurke');
  return {
    halfling: !!sp?.luck,
    elven: feats.has('elven-accuracy'),
    lucky: false,
    luckyAvailable: feats.has('lucky'),
    reliable: rogue >= (ed === '2024' ? 7 : 11),
    gwf: feats.has('style-gwf'),
    elemental: feats.has('elemental-adept'),
    savage: false,
    savageAvailable: feats.has('savage-attacker'),
    exhaustion: Number(c.exhaustion) || 0,
  };
}

// Verbrauchbare Ressourcen (Kampfrausch, Ki, Göttliche Macht …)
export function resourcesFor(c) {
  const ed = edOf(c);
  const mods = charMods(c).mods;
  const out = [];
  for (const x of c.classes || []) {
    const l = x.level;
    switch (x.cls) {
      case 'barbar': {
        const n = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, ed === '2024' ? 6 : 99][l - 1];
        out.push({ key: 'rage', name: `Kampfrausch (+${l >= 16 ? 4 : l >= 9 ? 3 : 2} Schaden)`, max: n, reset: 'long' });
        break;
      }
      case 'barde':
        out.push({ key: 'bardic', name: `Bardische Inspiration (W${l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6})`, max: Math.max(1, mods.cha), reset: l >= 5 ? 'short' : 'long' });
        break;
      case 'kleriker':
        if (l >= 2) out.push({ key: 'channel', name: 'Göttliche Macht fokussieren', max: ed === '2024' ? (l >= 18 ? 4 : l >= 6 ? 3 : 2) : l >= 18 ? 3 : l >= 6 ? 2 : 1, reset: 'short' });
        break;
      case 'druide':
        if (l >= 2) out.push({ key: 'wildshape', name: 'Tiergestalt', max: ed === '2024' ? (l >= 17 ? 4 : l >= 6 ? 3 : 2) : 2, reset: 'short' });
        break;
      case 'kaempfer':
        out.push({ key: 'secondwind', name: 'Zweiter Wind', max: ed === '2024' ? (l >= 10 ? 4 : l >= 4 ? 3 : 2) : 1, reset: 'short' });
        if (l >= 2) out.push({ key: 'surge', name: 'Tatendrang', max: l >= 17 ? 2 : 1, reset: 'short' });
        if (l >= 9) out.push({ key: 'indomitable', name: 'Unbeugsam', max: l >= 17 ? 3 : l >= 13 ? 2 : 1, reset: 'long' });
        break;
      case 'moench':
        if (l >= 2) out.push({ key: 'ki', name: ed === '2024' ? 'Fokuspunkte' : 'Ki-Punkte', max: l, reset: 'short' });
        break;
      case 'paladin':
        out.push({ key: 'layonhands', name: 'Handauflegen (TP-Vorrat)', max: 5 * l, reset: 'long', pool: true });
        if (l >= 3) out.push({ key: 'channel', name: 'Göttliche Macht fokussieren', max: ed === '2024' ? (l >= 11 ? 3 : 2) : 1, reset: 'short' });
        break;
      case 'waldlaeufer':
        if (ed === '2024') out.push({ key: 'favored', name: 'Jagdmal ohne Zauberplatz', max: l >= 17 ? 6 : l >= 13 ? 5 : l >= 9 ? 4 : l >= 5 ? 3 : 2, reset: 'long' });
        break;
      case 'zauberer':
        if (l >= 2) out.push({ key: 'sorcery', name: 'Zaubereipunkte', max: l, reset: 'long' });
        break;
      case 'magier':
        out.push({ key: 'arcanerecovery', name: `Arkane Erholung (bis ${Math.ceil(l / 2)} Grade)`, max: 1, reset: 'long' });
        break;
      default:
    }
  }
  const sp = findSpecies(ed, c.speciesKey);
  const pbv = profBonus(totalLevel(c));
  if (sp?.key === 'dragonborn') out.push({ key: 'breath', name: 'Odemwaffe', max: ed === '2024' ? pbv : 1, reset: ed === '2024' ? 'long' : 'short' });
  if (sp?.key === 'orc') out.push({ key: 'adrenaline', name: 'Adrenalinschub', max: pbv, reset: 'short' });
  if (sp?.key === 'orc' || sp?.key === 'halforc') out.push({ key: 'relentless', name: 'Unerbittliche Ausdauer', max: 1, reset: 'long' });
  if (sp?.key === 'aasimar') out.push({ key: 'healinghands', name: 'Heilende Hände', max: 1, reset: 'long' });
  if (sp?.key === 'goliath' && ed === '2024') out.push({ key: 'giant', name: 'Riesenabstammung', max: pbv, reset: 'long' });
  if ((c.feats || []).some((f) => f.key === 'lucky')) out.push({ key: 'luck', name: 'Glückspunkte', max: ed === '2024' ? pbv : 3, reset: 'long' });
  return out;
}

// Zusatzinfos pro Klasse (Hinterhältiger Angriff, Kampfkunstwürfel …)
export function classExtras(c) {
  const ed = edOf(c);
  const out = [];
  for (const x of c.classes || []) {
    const l = x.level;
    if (x.cls === 'schurke') out.push(`Hinterhältiger Angriff ${Math.ceil(l / 2)}W6`);
    if (x.cls === 'moench') out.push(`Kampfkunst W${ed === '2024' ? (l >= 17 ? 12 : l >= 11 ? 10 : l >= 5 ? 8 : 6) : l >= 17 ? 10 : l >= 11 ? 8 : l >= 5 ? 6 : 4}`);
    if (x.cls === 'hexenmeister') {
      const inv = ed === '2024' ? [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10] : [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
      out.push(`${inv[l - 1]} Schauerliche Anrufungen`);
    }
    if (x.cls === 'zauberer' && l >= 2) out.push(`Metamagie: ${ed === '2024' ? (l >= 17 ? 6 : l >= 10 ? 4 : 2) : l >= 17 ? 4 : l >= 10 ? 3 : l >= 3 ? 2 : 0} Optionen`);
  }
  return out;
}

// Mehrklassen-Voraussetzungen (13 im Hauptattribut)
export function multiclassOk(c, clsKey) {
  const cls = findClass(clsKey);
  if (!cls) return { ok: false, why: 'Unbekannte Klasse' };
  const a = c.abilities || {};
  const need = cls.mc.req;
  const ok = cls.mc.any ? need.some((g) => g.every((k) => (a[k] || 0) >= 13)) : need.every((g) => g.every((k) => (a[k] || 0) >= 13));
  const txt = need.map((g) => g.map((k) => `${AB_SHORT[k]} 13`).join(' und ')).join(cls.mc.any ? ' oder ' : ' und ');
  return { ok, why: ok ? '' : `Voraussetzung: ${txt}` };
}

// Merkmale je Stufe aus Regelpaketen: SUBCLASS_FEATURES['klasse|Unterklasse'] = { 3: [{ name, desc }], … }
export const SUBCLASS_FEATURES = {};
// Weitere Angaben zu Unterklassen aus Regelpaketen: { caster: 'third', ability: 'int' }
export const SUBCLASS_META = {};

// Kurzbeschreibungen der Unterklassen (für die Auswahl im Assistenten)
export const SUBCLASS_DESC = {
  // Barbar
  'Pfad des Berserkers': 'Rohe Wut ohne Rücksicht auf dich selbst. Im Kampfrausch führst du als Bonusaktion einen zusätzlichen Nahkampfangriff (Blutrausch) – 2014 zahlst du dafür mit Erschöpfung. Später schüchterst du Gegner allein durch dein Auftreten ein (Furchteinflößende Präsenz) und kämpfst weiter, selbst wenn dich Zauber betäuben oder bezaubern.',
  // Barde
  'Kolleg des Wissens': 'Gelehrter, Spötter und Sammler fremder Magie. Du bekommst drei zusätzliche Fertigkeiten und „Worte der Schmähung“: Ein Inspirationswürfel wird abgezogen, statt addiert – der Gegner verdirbt damit Angriff, Probe oder Schaden. Später lernst du Magische Geheimnisse, also Zauber aus jeder Klassenliste.',
  // Kleriker
  'Domäne des Lebens': 'Die stärkste Heilung im Spiel. Schwere Rüstung schützt dich, und jeder Heilzauber gibt zusätzlich 2 + Zaubergrad Trefferpunkte. Mit „Leben bewahren“ heilst du mehrere Kreaturen auf einmal, später heilt jede Berührung auch die Umstehenden.',
  // Druide
  'Zirkel des Landes': 'Der klassische Naturmagier. Du bekommst einen zusätzlichen Zaubertrick, Zauber je nach Landschaft (Arktis, Küste, Wüste, Wald, Sumpf, Berge, Grasland, Unterreich) und stellst mit „Natürliche Erholung“ in einer Rast Zauberplätze wieder her. Später ignorierst du schwieriges Gelände und widerstehst Naturmagie.',
  // Kämpfer
  Champion: 'Schlicht, robust, verlässlich. Deine kritischen Treffer beginnen schon bei einer 19 (später bei 18), du bekommst einen zweiten Kampfstil und regenerierst im Kampf Trefferpunkte. Später steigen deine Attributswürfe, und Angriffe verfehlen dich seltener.',
  // Mönch
  'Weg der offenen Hand': 'Reine Kampfkunst. Dein Schlaghagel wirft Gegner um, stößt sie zurück oder verhindert ihre Reaktion, und mit „Ruhe des Geistes“ heilst du dich selbst. Später betäubst du mit einem Schlag die Sinne eines Gegners und beherrschst den berüchtigten Todesschlag.',
  'Krieger der offenen Hand': 'Die klassische Kampfkunst in der Fassung 2024: Dein Schlaghagel wirft Gegner um oder stößt sie weg, du heilst dich selbst in der Rast und führst auf hoher Stufe den berüchtigten letzten Schlag.',
  // Paladin
  'Eid der Hingabe': 'Der klassische Ritter ohne Falsch. Mit Kanalisieren machst du deine Waffe für eine Minute heilig (+CHA auf Angriffe) oder vertreibst Untote. Deine Aura schützt alle Verbündeten vor Bezauberung, später heilst du in einer Aura und wirst kurzzeitig fast unverwundbar.',
  // Waldläufer
  Jäger: 'Spezialist gegen die Übermacht. Du wählst eine Beute – mehr Schaden gegen Einzelziele, ein Angriff gegen alle in Reichweite oder Verteidigung gegen Riesen. Später weichst du Flächenzaubern aus, schlägst mehrere Gegner gleichzeitig und stehst auch gegen eine Horde.',
  // Schurke
  Dieb: 'Schnelle Finger und flinke Füße. „Flinke Hände“ gibt dir eine zusätzliche Bonusaktion für Taschendiebstahl, Schlösser oder Fallen, dazu kletterst du mit voller Geschwindigkeit. Später nutzt du magische Gegenstände, die eigentlich anderen Klassen vorbehalten sind, und handelst als Erster.',
  // Zauberer
  Drachenblutlinie: 'Drachenerbe in deinem Blut. Du bekommst mehr Trefferpunkte pro Stufe, natürliche Rüstung ohne Rüstung (13 + GES) und sprichst Drakonisch. Zauber deiner Elementarart richten mehr Schaden an, später wachsen dir Drachenflügel.',
  'Drakonische Zauberei': 'Drachenblut in der Fassung 2024: mehr Trefferpunkte, Rüstung aus Schuppen, verstärkter Elementarschaden und früh einsetzende Drachenflügel.',
  // Hexenmeister
  'Der Unhold': 'Pakt mit einem Erzteufel. Für jeden erledigten Gegner bekommst du temporäre Trefferpunkte, später widerstehst du einer Schadensart deiner Wahl, würfelst Rettungswürfe neu und entgehst einmal pro Tag dem sicheren Tod.',
  'Unhold-Schutzherr': 'Teuflischer Pakt (2024): temporäre Trefferpunkte nach jedem Sieg, höllischer Widerstand und ein Ausweg aus dem sicheren Tod.',
  // Magier
  'Schule der Hervorrufung': 'Zerstörungsmagie mit Augenmaß. Deine Flächenzauber verschonen gewählte Verbündete, und auch bei einem bestandenen Rettungswurf richtest du Mindestschaden an. Später verstärkst du einen Zauber pro Rast auf den Maximalschaden.',
  Hervorrufer: 'Hervorrufung (2024): geformte Flächenzauber, die Verbündete verschonen, garantierter Mindestschaden und ein Zauber pro Rast mit Maximalschaden.',
};

// Kurzerklärung zu jeder begrenzten Ressource (Infotext im Charakterbogen)
export const RES_INFO = {
  rage: 'Als Bonusaktion in Wut geraten: Vorteil auf Stärkewürfe, Widerstand gegen Wucht-, Stich- und Hiebschaden und Extraschaden im Nahkampf. Endet nach 1 Minute oder wenn du eine Runde lang nichts angreifst und keinen Schaden nimmst.',
  bardic: 'Als Bonusaktion gibst du einer Kreatur in Hörweite einen Würfel. Sie darf ihn innerhalb von 10 Minuten auf einen Attributswurf, Angriffswurf oder Rettungswurf addieren – auch nach dem Wurf, aber vor dem Ergebnis.',
  channel: 'Göttliche Kraft deiner Gottheit: Untote vertreiben oder die besondere Wirkung deiner Domäne bzw. deines Eids nutzen.',
  wildshape: 'Du verwandelst dich in eine Bestie, deren Herausforderungsgrad du bereits erreichen darfst. Deine Werte werden durch die der Gestalt ersetzt, Intelligenz, Weisheit und Charisma behältst du.',
  secondwind: 'Als Bonusaktion heilst du dich um 1W10 + deine Kämpferstufe.',
  surge: 'In deinem Zug bekommst du eine zusätzliche Aktion – meist für einen weiteren Angriff.',
  indomitable: 'Einen misslungenen Rettungswurf darfst du wiederholen; das neue Ergebnis zählt.',
  ki: 'Der Treibstoff deiner Kampfkunst: Schlaghagel, Geduldige Verteidigung, Schritt des Windes und alle Fähigkeiten deiner Tradition.',
  layonhands: 'Ein Vorrat an Trefferpunkten, aus dem du heilst: Berührung als Aktion, beliebig aufgeteilt. 5 Punkte heilen stattdessen eine Krankheit oder ein Gift.',
  favored: 'Du darfst dein Jagdmal auf ein Ziel legen, ohne dafür einen Zauberplatz auszugeben.',
  sorcery: 'Punkte für Metamagie – und umwandelbar in Zauberplätze (und umgekehrt).',
  arcanerecovery: 'Nach einer kurzen Rast bekommst du Zauberplätze zurück, deren Grade zusammen höchstens die halbe Magierstufe (aufgerundet) ergeben – kein Platz über Grad 5.',
  breath: 'Statt eines Angriffs speist du einen Odem in Kegel- oder Linienform. Ziele machen einen Rettungswurf gegen deinen Zauber-SG und nehmen sonst vollen Elementarschaden.',
  adrenaline: 'Als Bonusaktion bekommst du temporäre Trefferpunkte in Höhe deines Übungsbonus und darfst dich sofort bewegen.',
  relentless: 'Fällst du auf 0 Trefferpunkte, ohne sofort zu sterben, bleibst du stattdessen mit 1 Trefferpunkt stehen.',
  healinghands: 'Als Aktion berührst du eine Kreatur und heilst sie um Würfel in Höhe deiner Stufe.',
  giant: 'Riesenkraft: Du wirst kurzzeitig größer, schlägst härter zu und hast Vorteil auf Stärkewürfe.',
  luck: 'Vor dem Ergebnis eines eigenen W20-Wurfs (oder eines Angriffs gegen dich) würfelst du einen zweiten W20 und suchst dir das Ergebnis aus.',
};
