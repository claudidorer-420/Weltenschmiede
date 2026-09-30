// Merkmale der Unterklassen des Grundbestands (SRD 5.1 / 5.2.1, CC-BY-4.0 – in eigenen Worten zusammengefasst) je Stufe,
// mit strukturierten Wirkungen (core/effects.js). Sie wirken im Charakterbogen und im Kampf, solange kein Regelwerk die
// Unterklasse selbst beschreibt, und dienen im Regelwerk-Editor als Vorlage („Aus Grundbestand“).
// Schlüssel: 'klasse|Unterklasse' → { 2014: { stufe: [{ name, desc, fx }] }, 2024: { … } } (fehlt ein Regelstand, gilt der andere).
// DOM-frei (MCP-Server, Tests).

const hint = (k) => ({ t: 'adv', k });
const both = (x) => ({ 2014: x, 2024: x });

const CHAMP14 = {
  3: [{ name: 'Verbesserter kritischer Treffer', desc: 'Deine Waffenangriffe sind bei einem Wurf von 19 oder 20 ein kritischer Treffer.', fx: [{ t: 'crit', v: 1, on: 'weapon' }] }],
  7: [{ name: 'Bemerkenswerter Athlet', desc: 'Halber Übungsbonus (aufgerundet) auf Stärke-, Geschicklichkeits- und Konstitutionswürfe ohne Übung. Weitsprung +STÄ-Modifikator × 0,3 m.', fx: [{ t: 'jack', k: ['str', 'dex', 'con'], up: true }] }],
  10: [{ name: 'Zusätzlicher Kampfstil', desc: 'Du wählst einen zweiten Kampfstil.', fx: [{ t: 'pick', k: 'style', n: 1, label: 'Zusätzlicher Kampfstil' }] }],
  15: [{ name: 'Überragender kritischer Treffer', desc: 'Deine Waffenangriffe sind schon bei 18–20 ein kritischer Treffer.', fx: [{ t: 'crit', v: 1, on: 'weapon' }] }],
  18: [{ name: 'Überlebender', desc: 'Zu Beginn jedes Zuges erhältst du 5 + KON-Modifikator TP zurück, wenn du höchstens die Hälfte deiner TP hast (aber mindestens 1).', fx: [{ t: 'regen', v: 5, only: 'bloodied' }, { t: 'regen', v: 'mod:con', only: 'bloodied' }] }],
};
const CHAMP24 = {
  3: [
    { name: 'Verbesserter kritischer Treffer', desc: 'Angriffe mit Waffen und waffenlose Schläge sind bei 19 oder 20 ein kritischer Treffer.', fx: [{ t: 'crit', v: 1, on: 'weapon' }] },
    { name: 'Bemerkenswerter Athlet', desc: 'Vorteil auf Initiative und auf Stärke (Athletik). Nach einem kritischen Treffer darfst du dich um die halbe Bewegungsrate bewegen, ohne Gelegenheitsangriffe auszulösen.', fx: [{ t: 'checkAdv', k: ['init', 'athletics'] }] },
  ],
  7: [{ name: 'Zusätzlicher Kampfstil', desc: 'Du erhältst ein weiteres Kampfstil-Talent.', fx: [{ t: 'pick', k: 'style', n: 1, label: 'Zusätzlicher Kampfstil' }] }],
  10: [{ name: 'Heldenhafter Krieger', desc: 'Im Kampf erhältst du zu Beginn deines Zuges Heldenmut, falls du keinen hast.', fx: [hint('Heldenmut zu Beginn jedes Zuges im Kampf')] }],
  15: [{ name: 'Überragender kritischer Treffer', desc: 'Kritische Treffer schon bei 18–20.', fx: [{ t: 'crit', v: 1, on: 'weapon' }] }],
  18: [{ name: 'Überlebender', desc: 'Vorteil auf Todesrettungswürfe. Bei höchstens halben TP erhältst du zu Beginn jedes Zuges 5 + KON-Modifikator TP zurück.', fx: [{ t: 'saveAdv', k: ['death'] }, { t: 'regen', v: 5, only: 'bloodied' }, { t: 'regen', v: 'mod:con', only: 'bloodied' }] }],
};

const LIFE_DISCIPLE = { name: 'Jünger des Lebens', desc: 'Heilt ein Zauber des 1. Grades oder höher, erhält das Ziel zusätzlich 2 + Grad des Zaubers TP.', fx: [{ t: 'healBonus', v: 2, slot: true }] };
const LIFE14 = {
  1: [{ name: 'Zusätzliche Übung', desc: 'Du erhältst Übung mit schwerer Rüstung.', fx: [{ t: 'armor', k: ['heavy'] }] }, LIFE_DISCIPLE],
  2: [{ name: 'Leben bewahren', desc: 'Göttliche Macht fokussieren: Du verteilst 5 × Klerikerstufe TP auf Kreaturen in 9 m (höchstens bis zur Hälfte ihrer TP).', fx: [hint('Leben bewahren: 5 × Klerikerstufe TP verteilen (Göttliche Macht)')] }],
  6: [{ name: 'Gesegneter Heiler', desc: 'Heilst du mit einem Zauber eine andere Kreatur, erhältst du selbst 2 + Grad des Zaubers TP.', fx: [{ t: 'healSelf', v: 2 }] }],
  8: [{ name: 'Göttlicher Schlag', desc: 'Einmal in jedem deiner Züge verursacht ein Waffentreffer zusätzlich 1W8 gleißenden Schaden (ab Stufe 14 2W8).', fx: [{ t: 'dmgExtra', dice: '1d8', type: 'radiant', on: 'weapon', once: true }, { t: 'dmgExtra', dice: '1d8', type: 'radiant', on: 'weapon', once: true, lvl: 14 }] }],
  17: [{ name: 'Höchste Heilung', desc: 'Würfelst du Heilung aus, zählt jeder Würfel mit seinem Höchstwert.', fx: [{ t: 'healBonus', max: true }] }],
};
const LIFE24 = {
  3: [LIFE_DISCIPLE, { name: 'Leben bewahren', desc: 'Göttliche Macht fokussieren: Du verteilst 5 × Klerikerstufe TP auf Kreaturen in 9 m (höchstens bis zur Hälfte ihrer TP).', fx: [hint('Leben bewahren: 5 × Klerikerstufe TP verteilen (Göttliche Macht)')] }],
  6: [{ name: 'Gesegneter Heiler', desc: 'Heilst du mit einem Zauberplatz eine andere Kreatur, erhältst du selbst 2 + Grad des Zaubers TP.', fx: [{ t: 'healSelf', v: 2 }] }],
  17: [{ name: 'Höchste Heilung', desc: 'Würfelst du Heilung aus, zählt jeder Würfel mit seinem Höchstwert.', fx: [{ t: 'healBonus', max: true }] }],
};

const LAND14 = {
  2: [
    { name: 'Zusätzlicher Zaubertrick', desc: 'Du lernst einen weiteren Druiden-Zaubertrick.', fx: [{ t: 'pick', k: 'cantrip', n: 1, list: 'druide', label: 'Zirkel des Landes: Zaubertrick' }] },
    { name: 'Natürliche Erholung', desc: 'Einmal pro langer Rast holst du während einer kurzen Rast Zauberplätze zurück (zusammen höchstens die halbe Druidenstufe, keiner über Grad 5).', fx: [{ t: 'action', k: 'Natürliche Erholung', kind: 'restore', what: 'slot', lvMax: 5, cost: 'free', uses: '1', rest: 'long' }] },
  ],
  6: [{ name: 'Leichtfüßigkeit', desc: 'Nichtmagisches schwieriges Gelände kostet dich keine zusätzliche Bewegung; Pflanzen behindern dich nicht.', fx: [{ t: 'ignoreTerrain' }] }],
  10: [{ name: 'Schutz der Natur', desc: 'Du kannst nicht vergiftet werden, bist immun gegen Gift und Krankheiten, und Elementare wie Feenwesen können dich nicht bezaubern oder verängstigen.', fx: [{ t: 'condImm', k: ['Vergiftet'] }, { t: 'immune', k: ['poison'] }] }],
  14: [{ name: 'Refugium der Natur', desc: 'Pflanzen und Tiere spüren deine Verbundenheit: Bevor sie dich angreifen, müssen sie einen WEI-Rettungswurf schaffen.', fx: [hint('Tiere und Pflanzen müssen einen WEI-Rettungswurf schaffen, um dich anzugreifen')] }],
};
const LAND24 = {
  3: [{ name: 'Hilfe des Landes', desc: 'Tiergestalt aufwenden: Kugel mit 3 m Radius in 18 m – Feinde KON-Rettungswurf gegen 2W6 nekrotischen Schaden, ein Verbündeter heilt 2W6 (mehr ab Stufe 10 und 14).', fx: [{ t: 'action', k: 'Hilfe des Landes', kind: 'save', cost: 'action', save: 'con', dice: '2d6', type: 'necrotic', half: true, area: { shape: 'sphere', size: 3 }, range: 18, pool: 'Tiergestalt', poolCost: 1, ab: 'wis', up: { 10: '3d6', 14: '4d6' } }] }],
  6: [{ name: 'Natürliche Erholung', desc: 'Einmal pro langer Rast holst du in einer kurzen Rast Zauberplätze zurück (zusammen höchstens die halbe Druidenstufe, keiner über Grad 5).', fx: [{ t: 'action', k: 'Natürliche Erholung', kind: 'restore', what: 'slot', lvMax: 5, cost: 'free', uses: '1', rest: 'long' }] }],
  10: [{ name: 'Schutz der Natur', desc: 'Du kannst nicht vergiftet werden und hast Resistenz gegen eine Schadensart je nach Landschaft (Kälte, Feuer oder Blitz).', fx: [{ t: 'condImm', k: ['Vergiftet'] }, { t: 'pick', k: 'dmg', n: 1, into: 'resist', from: ['cold', 'fire', 'lightning'], label: 'Schutz der Natur: Resistenz' }] }],
  14: [{ name: 'Refugium der Natur', desc: 'Als Aktion lässt du für 1 Minute Bäume und Ranken wachsen: Halbe Deckung für dich und Verbündete, Resistenz nach deiner Landschaft.', fx: [hint('Refugium der Natur: Deckung und Resistenz für Verbündete (Aktion, Tiergestalt)')] }],
};

const BERS14 = {
  3: [{ name: 'Raserei', desc: 'Im Kampfrausch kannst du in Raserei verfallen: Bis zum Ende des Kampfrausches greifst du als Bonusaktion in jedem Zug einmal mit einer Nahkampfwaffe an. Danach erleidest du eine Stufe Erschöpfung.', fx: [{ t: 'action', k: 'Raserei-Angriff', kind: 'weapon', cost: 'bonus', cond: 'raging', desc: 'In Raserei (Kampfrausch): ein Nahkampfangriff als Bonusaktion.' }] }],
  6: [{ name: 'Besinnungsloser Kampfrausch', desc: 'Im Kampfrausch kannst du weder bezaubert noch verängstigt werden.', fx: [{ t: 'condImm', k: ['Bezaubert', 'Verängstigt'], cond: 'raging' }] }],
  10: [{ name: 'Einschüchternde Präsenz', desc: 'Als Aktion verängstigst du eine Kreatur in 9 m bis zum Ende deines nächsten Zuges (WEI-Rettungswurf, SG 8 + Übungsbonus + CHA).', fx: [{ t: 'action', k: 'Einschüchternde Präsenz', kind: 'save', cost: 'action', save: 'wis', ab: 'cha', dice: '0', inflict: 'Verängstigt', condDur: 1, range: 9 }] }],
  14: [{ name: 'Vergeltung', desc: 'Erleidest du Schaden durch eine Kreatur in 1,5 m, greifst du sie als Reaktion mit einer Nahkampfwaffe an.', fx: [{ t: 'action', k: 'Vergeltung', kind: 'react', trigger: 'melee', effect: 'riposte' }] }],
};
const BERS24 = {
  3: [{ name: 'Raserei', desc: 'Greifst du im Kampfrausch tollkühn an, verursacht dein erster Treffer im Zug zusätzlich so viele W6, wie dein Wutschaden beträgt.', fx: [{ t: 'dmgExtra', dice: '[Wutschaden]d6', on: 'melee', once: true, cond: 'raging' }] }],
  6: [{ name: 'Besinnungsloser Kampfrausch', desc: 'Im Kampfrausch bist du immun gegen Bezaubert und Verängstigt; beim Eintritt enden diese Zustände.', fx: [{ t: 'condImm', k: ['Bezaubert', 'Verängstigt'], cond: 'raging' }] }],
  10: [{ name: 'Vergeltung', desc: 'Erleidest du Schaden durch eine Kreatur in 1,5 m, greifst du sie als Reaktion mit einer Waffe oder waffenlos an.', fx: [{ t: 'action', k: 'Vergeltung', kind: 'react', trigger: 'melee', effect: 'riposte' }] }],
  14: [{ name: 'Einschüchternde Präsenz', desc: 'Als Bonusaktion verängstigst du Kreaturen deiner Wahl in 9 m für 1 Minute (WEI-Rettungswurf, SG 8 + STÄ + Übungsbonus).', fx: [{ t: 'action', k: 'Einschüchternde Präsenz', kind: 'save', cost: 'bonus', save: 'wis', ab: 'str', dice: '0', inflict: 'Verängstigt', condDur: 10, condSave: 'end', area: { shape: 'emanation', size: 9 }, uses: '1', rest: 'long' }] }],
};

const LORE = {
  3: [
    { name: 'Zusätzliche Übungen', desc: 'Du erhältst Übung in drei Fertigkeiten deiner Wahl.', fx: [{ t: 'pick', k: 'skill', n: 3, label: 'Kolleg des Wissens: Fertigkeiten' }] },
    { name: 'Schneidende Worte', desc: 'Reaktion: Du ziehst einen Bardischen Inspirationswürfel vom Angriffs-, Attributs- oder Schadenswurf einer Kreatur in 18 m ab.', fx: [hint('Schneidende Worte: Inspirationswürfel von einem gegnerischen Wurf abziehen (Reaktion)')] },
  ],
  6: [{ name: 'Magische Entdeckungen', desc: 'Du lernst zwei Zauber aus beliebigen Klassenlisten; sie zählen als Bardenzauber und sind immer vorbereitet.', fx: [{ t: 'pick', k: 'spell', n: 2, lv: 3, uses: 'always', label: 'Magische Entdeckungen' }] }],
  14: [{ name: 'Unvergleichliches Geschick', desc: 'Misslingt dir ein Attributswurf oder Angriff, darfst du einen Inspirationswürfel addieren – er wird nur verbraucht, wenn es dann gelingt.', fx: [hint('Unvergleichliches Geschick: Inspirationswürfel auf eigene Würfe')] }],
};

const OPEN14 = {
  3: [{ name: 'Technik der offenen Hand', desc: 'Triffst du mit einem Schlaghagel-Schlag, kannst du das Ziel umwerfen (GES-Rettungswurf), 4,5 m wegstoßen (STÄ-Rettungswurf) oder ihm bis zum Ende deines nächsten Zuges seine Reaktionen nehmen.', fx: [hint('Schlaghagel: Umwerfen, Wegstoßen oder keine Reaktionen')] }],
  6: [{ name: 'Ganzheit des Körpers', desc: 'Einmal pro langer Rast heilst du dich als Aktion um das Dreifache deiner Mönchsstufe.', fx: [{ t: 'action', k: 'Ganzheit des Körpers', kind: 'heal', cost: 'action', dice: '0', addMod: false, addLevel: true, uses: '1', rest: 'long', desc: 'Heilt 3 × Mönchsstufe (hier wird die Stufe einmal addiert – den Rest bitte von Hand ergänzen).' }] }],
  11: [{ name: 'Ruhe', desc: 'Nach einer langen Rast wirkt auf dir Schutzbereich bis zum Beginn der nächsten langen Rast (SG 8 + WEI + Übungsbonus).', fx: [hint('Ruhe: Schutzbereich nach jeder langen Rast')] }],
  17: [{ name: 'Bebende Handfläche', desc: 'Mit 3 Ki versetzt du einem Ziel tödliche Schwingungen; später lässt du es mit einer Aktion KON-Rettungswurf machen: 0 TP oder 10W10 nekrotisch.', fx: [hint('Bebende Handfläche (3 Ki)')] }],
};
const OPEN24 = {
  3: [{ name: 'Technik der offenen Hand', desc: 'Triffst du mit einem Schlaghagel-Schlag, kannst du das Ziel umwerfen oder 4,5 m wegstoßen (Rettungswurf) oder ihm bis zum Beginn deines nächsten Zuges Gelegenheitsangriffe nehmen.', fx: [hint('Schlaghagel: Umwerfen, Wegstoßen oder keine Gelegenheitsangriffe')] }],
  6: [{ name: 'Ganzheit des Körpers', desc: 'Als Bonusaktion heilst du dich um einen Kampfkunstwürfel + WEI-Modifikator – so oft wie dein WEI-Modifikator pro langer Rast.', fx: [{ t: 'action', k: 'Ganzheit des Körpers', kind: 'heal', cost: 'bonus', dice: '[Kampfkunst]', ab: 'wis', uses: 'mod:wis', rest: 'long' }] }],
  11: [{ name: 'Flinker Schritt', desc: 'Nutzt du eine Bonusaktion, darfst du sofort Schritt des Windes einsetzen.', fx: [hint('Flinker Schritt: Schritt des Windes nach jeder Bonusaktion')] }],
  17: [{ name: 'Bebende Handfläche', desc: 'Mit 4 Fokuspunkten setzt du tödliche Schwingungen: KON-Rettungswurf gegen 10W12 Energieschaden (halb bei Erfolg).', fx: [hint('Bebende Handfläche (4 Fokuspunkte)')] }],
};

const DEVOTION = {
  3: [
    { name: 'Heilige Waffe', desc: 'Göttliche Macht fokussieren: Deine Waffe leuchtet 1 Minute lang; du addierst deinen CHA-Modifikator (mindestens +1) auf Angriffswürfe mit ihr.', fx: [{ t: 'action', k: 'Heilige Waffe', kind: 'buff', cost: 'bonus', rounds: 10, pool: 'Göttliche Macht', poolCost: 1, fx: [{ t: 'attack', v: 'mod:cha', k: 'weapon' }] }] },
    { name: 'Unheilige vertreiben', desc: 'Göttliche Macht fokussieren: Unholde und Untote in 9 m sind bei misslungenem WEI-Rettungswurf 1 Minute vertrieben.', fx: [{ t: 'action', k: 'Unheilige vertreiben', kind: 'save', cost: 'action', save: 'wis', ab: 'cha', dice: '0', inflict: 'Verängstigt', condDur: 10, area: { shape: 'emanation', size: 9 }, vs: 'Unholde, Untote', pool: 'Göttliche Macht', poolCost: 1 }] },
  ],
  7: [{ name: 'Aura der Hingabe', desc: 'Du und Verbündete in 3 m (ab Stufe 18: 9 m) könnt nicht bezaubert werden, solange du bei Bewusstsein bist.', fx: [{ t: 'aura', k: 'fx', r: 10, fx: [{ t: 'condImm', k: ['Bezaubert'] }] }, { t: 'aura', k: 'fx', r: 30, lvl: 18, fx: [{ t: 'condImm', k: ['Bezaubert'] }] }] }],
  15: [{ name: 'Reinheit des Geistes', desc: 'Du stehst dauerhaft unter Schutz vor Gut und Böse.', fx: [hint('Dauerhaft Schutz vor Gut und Böse')] }],
  20: [{ name: 'Heiliger Nimbus', desc: 'Als Aktion strahlst du 1 Minute lang Licht aus: Feinde, die ihren Zug darin beginnen, erleiden 10 gleißenden Schaden; Vorteil auf Rettungswürfe gegen Zauber von Unholden und Untoten.', fx: [{ t: 'action', k: 'Heiliger Nimbus', kind: 'buff', cost: 'action', rounds: 10, uses: '1', rest: 'long', fx: [{ t: 'retaliate', on: 'melee', v: 10, type: 'radiant' }] }] }],
};

const HUNTER14 = {
  3: [{ name: 'Beute des Jägers', desc: 'Du wählst eine Jagdtechnik.', fx: [{ t: 'pick', k: 'option', n: 1, label: 'Beute des Jägers', options: [
    { key: 'kolossbezwinger', name: 'Kolossbezwinger', desc: 'Einmal pro Zug +1W8 Schaden gegen ein Ziel, das bereits verletzt ist.', fx: [{ t: 'dmgExtra', dice: '1d8', on: 'weapon', hp: 'hurt', once: true }] },
    { key: 'riesentoeter', name: 'Riesentöter', desc: 'Greift dich eine große oder größere Kreatur in 1,5 m an, darfst du sie als Reaktion sofort angreifen.', fx: [{ t: 'action', k: 'Riesentöter', kind: 'react', trigger: 'melee', effect: 'riposte', desc: 'Nur gegen große oder größere Angreifer.' }] },
    { key: 'hordenbrecher', name: 'Hordenbrecher', desc: 'Einmal pro Zug darfst du eine zweite Kreatur in 1,5 m des ersten Ziels angreifen.', fx: [hint('Hordenbrecher: zusätzlicher Angriff gegen ein zweites Ziel daneben')] },
  ] }] }],
  7: [{ name: 'Verteidigungstaktik', desc: 'Du wählst eine Verteidigungstechnik.', fx: [{ t: 'pick', k: 'option', n: 1, label: 'Verteidigungstaktik', options: [
    { key: 'horde', name: 'Der Horde entkommen', desc: 'Gelegenheitsangriffe gegen dich sind im Nachteil.', fx: [hint('Gelegenheitsangriffe gegen dich im Nachteil')] },
    { key: 'mehrfach', name: 'Mehrfachangriffsabwehr', desc: 'Nach einem Treffer durch eine Kreatur hast du +4 RK gegen alle weiteren Angriffe dieser Kreatur in diesem Zug.', fx: [hint('+4 RK gegen weitere Angriffe desselben Angreifers')] },
    { key: 'stahl', name: 'Stählerner Wille', desc: 'Vorteil auf Rettungswürfe gegen Verängstigt.', fx: [{ t: 'saveAdv', vs: 'Verängstigt' }] },
  ] }] }],
  11: [{ name: 'Mehrfachangriff', desc: 'Salve (Fernkampfangriff gegen alle in 3 m um einen Punkt) oder Wirbelangriff (Nahkampfangriff gegen alle in Reichweite).', fx: [hint('Salve / Wirbelangriff')] }],
  15: [{ name: 'Überlegene Jägerverteidigung', desc: 'Du wählst Entrinnen, Standhalten gegen die Flut oder Unglaubliches Ausweichen.', fx: [{ t: 'pick', k: 'option', n: 1, label: 'Überlegene Jägerverteidigung', options: [
    { key: 'entrinnen', name: 'Entrinnen', desc: 'Kein Schaden bei gelungenem GES-Rettungswurf gegen Flächenschaden, halber bei Misserfolg.', fx: [{ t: 'evasion' }] },
    { key: 'flut', name: 'Standhalten gegen die Flut', desc: 'Verfehlt dich ein Nahkampfangriff, kannst du ihn als Reaktion auf eine andere Kreatur lenken.', fx: [hint('Verfehlte Nahkampfangriffe umlenken (Reaktion)')] },
    { key: 'ausweichen', name: 'Unglaubliches Ausweichen', desc: 'Trifft dich ein Angreifer, den du siehst, halbierst du den Schaden als Reaktion.', fx: [{ t: 'action', k: 'Unglaubliches Ausweichen', kind: 'react', trigger: 'hit', effect: 'reduce', half: true }] },
  ] }] }],
};
const HUNTER24 = {
  3: [
    { name: 'Wissen des Jägers', desc: 'Bei einer Kreatur mit deinem Jagdmal kennst du ihre Immunitäten, Resistenzen und Anfälligkeiten.', fx: [hint('Jagdmal zeigt Immunitäten, Resistenzen und Anfälligkeiten')] },
    HUNTER14[3][0],
  ],
  7: [{ name: 'Verteidigungstaktik', desc: 'Du wählst eine Verteidigungstechnik (nach jeder langen Rast neu).', fx: [{ t: 'pick', k: 'option', n: 1, label: 'Verteidigungstaktik', options: HUNTER14[7][0].fx[0].options.filter((o) => o.key !== 'stahl') }] }],
  11: [{ name: 'Überlegenes Jagdmal', desc: 'Einmal pro Zug trifft der Zusatzschaden deines Jagdmals auch eine zweite Kreatur in 9 m.', fx: [hint('Jagdmal-Schaden zusätzlich gegen ein zweites Ziel')] }],
  15: [{ name: 'Überlegene Jägerverteidigung', desc: 'Erleidest du Schaden, erhältst du als Reaktion bis zum Ende des Zuges Resistenz gegen diese und jede weitere Schadensart dieses Zuges.', fx: [hint('Reaktion: Resistenz gegen den erlittenen Schaden')] }],
};

const THIEF = {
  3: [
    { name: 'Flinke Hände', desc: 'Mit der Bonusaktion deiner Raffinierten Aktion kannst du Fingerfertigkeit einsetzen, Schlösser öffnen, Fallen entschärfen oder einen Gegenstand benutzen.', fx: [hint('Raffinierte Aktion: Fingerfertigkeit, Diebeswerkzeug oder Gegenstand benutzen')] },
    { name: 'Fassadenkletterer', desc: 'Klettern kostet dich keine zusätzliche Bewegung (Klettergeschwindigkeit = Bewegungsrate).', fx: [{ t: 'move', k: 'climb', v: 'walk' }] },
  ],
  9: [{ name: 'Höchste Heimlichkeit', desc: 'Vorteil auf Geschicklichkeit (Heimlichkeit), wenn du dich höchstens mit halber Bewegungsrate bewegst.', fx: [hint('Vorteil auf Heimlichkeit bei halber Bewegung')] }],
  13: [{ name: 'Magische Gegenstände benutzen', desc: 'Du ignorierst Klassen-, Spezies- und Stufenvorgaben beim Benutzen magischer Gegenstände.', fx: [hint('Ignoriert Voraussetzungen magischer Gegenstände')] }],
  17: [{ name: 'Diebesreflexe', desc: 'In der ersten Kampfrunde hast du zwei Züge (der zweite mit Initiative −10).', fx: [hint('Zwei Züge in der ersten Kampfrunde')] }],
};

const DRAGON_OPTS = [['schwarz', 'Schwarz', 'acid'], ['blau', 'Blau', 'lightning'], ['messing', 'Messing', 'fire'], ['bronze', 'Bronze', 'lightning'], ['kupfer', 'Kupfer', 'acid'], ['gold', 'Gold', 'fire'], ['gruen', 'Grün', 'poison'], ['rot', 'Rot', 'fire'], ['silber', 'Silber', 'cold'], ['weiss', 'Weiß', 'cold']];
const DT = { acid: 'Säure', lightning: 'Blitz', fire: 'Feuer', poison: 'Gift', cold: 'Kälte' };
const dragonPick = (resist) => ({ t: 'pick', k: 'option', n: 1, label: 'Drachenahn', options: DRAGON_OPTS.map(([key, name, dt]) => ({ key, name, desc: `Schadensart: ${DT[dt]}. Ab Stufe 6 addierst du deinen CHA-Modifikator auf einen Schadenswurf von Zaubern dieser Art${resist ? ' und bist resistent dagegen' : ''}.`, fx: [{ t: 'spellDmg', v: 'mod:cha', ifType: [dt], once: true, lvl: 6 }, ...(resist ? [{ t: 'resist', k: [dt], lvl: 6 }] : [])] })) });
const DRACO14 = {
  1: [
    { name: 'Drachenahn', desc: 'Du wählst die Art deines Drachenahnen; du sprichst Drakonisch.', fx: [dragonPick(false), { t: 'lang', k: ['Drakonisch'] }] },
    { name: 'Drakonische Widerstandskraft', desc: '+1 TP pro Zaubererstufe. Ohne Rüstung ist deine RK 13 + GES-Modifikator.', fx: [{ t: 'hpLevel', v: 1 }, { t: 'acFormula', v: 13, k: ['dex'] }] },
  ],
  6: [{ name: 'Elementare Affinität', desc: 'Zauber mit der Schadensart deines Ahnen: +CHA auf einen Schadenswurf. Für 1 Zaubereipunkt eine Stunde lang Resistenz dagegen.', fx: [hint('Elementare Affinität: siehe Drachenahn')] }],
  14: [{ name: 'Drachenflügel', desc: 'Als Bonusaktion lässt du Flügel wachsen: Flugbewegung gleich deiner Bewegungsrate, bis du sie einziehst.', fx: [{ t: 'action', k: 'Drachenflügel', kind: 'buff', cost: 'bonus', dur: 'toggle', fx: [{ t: 'move', k: 'fly', v: 'walk' }] }] }],
  18: [{ name: 'Drachengestalt', desc: 'Für 5 Zaubereipunkte wirkst du einmal pro langer Rast eine furchterregende Präsenz (60 ft) ohne Konzentration.', fx: [hint('Drachengestalt: Präsenz (5 Zaubereipunkte)')] }],
};
const DRACO24 = {
  3: [
    { name: 'Drakonische Widerstandskraft', desc: '+3 TP, danach +1 TP je weiterer Zaubererstufe. Ohne Rüstung ist deine RK 10 + GES + CHA.', fx: [{ t: 'hpLevel', v: 1 }, { t: 'hp', v: 2 }, { t: 'acFormula', v: 10, k: ['dex', 'cha'] }] },
    { name: 'Drachenahn', desc: 'Du wählst die Art deines Drachenahnen.', fx: [dragonPick(true)] },
  ],
  6: [{ name: 'Elementare Affinität', desc: 'Resistenz gegen die Schadensart deines Ahnen und +CHA auf einen Schadenswurf deiner Zauber dieser Art.', fx: [hint('Elementare Affinität: siehe Drachenahn')] }],
  14: [{ name: 'Drachenflügel', desc: 'Als Bonusaktion wachsen dir für 1 Stunde Flügel: Flugbewegung 18 m. Einmal pro langer Rast (oder für 3 Zaubereipunkte).', fx: [{ t: 'action', k: 'Drachenflügel', kind: 'buff', cost: 'bonus', rounds: 600, uses: '1', rest: 'long', fx: [{ t: 'move', k: 'fly', v: 60 }] }] }],
  18: [{ name: 'Drachischer Begleiter', desc: 'Du kannst Drachen beschwören wirken (ohne Materialkomponente), einmal pro langer Rast ohne Zauberplatz.', fx: [hint('Drachen beschwören 1× pro langer Rast ohne Platz')] }],
};

const FIEND = (ed) => ({
  [ed === '2024' ? 3 : 1]: [{ name: 'Segen des Dunklen', desc: 'Bringst du eine feindliche Kreatur auf 0 TP, erhältst du temporäre TP in Höhe von CHA-Modifikator + Hexenmeisterstufe (mindestens 1).', fx: [{ t: 'onKill', temp: 'MOD+LV' }] }],
  6: [{ name: 'Glück des Dunklen', desc: 'Einmal pro kurzer oder langer Rast addierst du 1W10 auf einen Attributs- oder Rettungswurf.', fx: [{ t: 'res', k: 'Glück des Dunklen', v: ed === '2024' ? 'mod:cha' : 1, rest: ed === '2024' ? 'long' : 'short' }, hint('Glück des Dunklen: +1W10 auf einen Attributs- oder Rettungswurf')] }],
  10: [{ name: 'Unholdische Widerstandskraft', desc: 'Nach jeder Rast wählst du eine Schadensart (nicht Energie); gegen sie bist du resistent.', fx: [{ t: 'pick', k: 'dmg', n: 1, into: 'resist', from: ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'], label: 'Unholdische Widerstandskraft' }] }],
  14: [{ name: 'Durch die Hölle schleudern', desc: 'Triffst du eine Kreatur mit einem Angriff, schickst du sie einmal pro langer Rast durch die Niederen Ebenen: 10W10 psychischer Schaden (2024: CHA-Rettungswurf, 8W10).', fx: [hint('Durch die Hölle schleudern: 1× pro langer Rast')] }],
});

const EVOC = (ed) => ({
  [ed === '2024' ? 3 : 2]: [
    { name: 'Hervorrufungsgelehrter', desc: 'Hervorrufungszauber kosten dich beim Abschreiben halb so viel Zeit und Gold.', fx: [] },
    { name: 'Zauber formen', desc: 'Bei Hervorrufungszaubern mit Fläche schützt du 1 + Grad Kreaturen: Sie bestehen den Rettungswurf automatisch und erleiden keinen Schaden.', fx: [hint('Zauber formen: Verbündete in deinen Flächenzaubern verschonen')] },
  ],
  6: [{ name: 'Mächtiger Zaubertrick', desc: 'Besteht ein Ziel den Rettungswurf gegen deinen Zaubertrick, erleidet es trotzdem halben Schaden (ohne weitere Wirkung).', fx: [hint('Zaubertricks: halber Schaden auch bei gelungenem Rettungswurf')] }],
  10: [{ name: 'Verstärkte Hervorrufung', desc: 'Du addierst deinen INT-Modifikator auf einen Schadenswurf deiner Hervorrufungszauber.', fx: [{ t: 'spellDmg', v: 'mod:int', on: 'school', school: 'evocation' }] }],
  14: [{ name: 'Überladung', desc: 'Einmal ohne Folgen richtet ein Zauber bis Grad 5 den höchstmöglichen Schaden an; danach kostet es dich jedes Mal nekrotischen Schaden.', fx: [hint('Überladung: Maximalschaden bei Zaubern bis Grad 5')] }],
});

export const SUBCLASS_BASE = {
  'kaempfer|Champion': { 2014: CHAMP14, 2024: CHAMP24 },
  'kleriker|Domäne des Lebens': { 2014: LIFE14, 2024: LIFE24 },
  'druide|Zirkel des Landes': { 2014: LAND14, 2024: LAND24 },
  'barbar|Pfad des Berserkers': { 2014: BERS14, 2024: BERS24 },
  'barde|Kolleg des Wissens': both(LORE),
  'moench|Weg der offenen Hand': { 2014: OPEN14, 2024: OPEN24 },
  'moench|Krieger der offenen Hand': { 2014: OPEN14, 2024: OPEN24 },
  'paladin|Eid der Hingabe': both(DEVOTION),
  'waldlaeufer|Jäger': { 2014: HUNTER14, 2024: HUNTER24 },
  'schurke|Dieb': both(THIEF),
  'zauberer|Drachenblutlinie': { 2014: DRACO14, 2024: DRACO24 },
  'zauberer|Drakonische Zauberei': { 2014: DRACO14, 2024: DRACO24 },
  'hexenmeister|Der Unhold': { 2014: FIEND('2014'), 2024: FIEND('2024') },
  'hexenmeister|Unhold-Schutzherr': { 2014: FIEND('2014'), 2024: FIEND('2024') },
  'magier|Schule der Hervorrufung': { 2014: EVOC('2014'), 2024: EVOC('2024') },
  'magier|Hervorrufer': { 2014: EVOC('2014'), 2024: EVOC('2024') },
};
export const baseSubFeatures = (clsKey, sub, ed) => {
  const e = SUBCLASS_BASE[`${clsKey}|${sub}`];
  return e ? e[ed] || e[2024] || e[2014] || null : null;
};
