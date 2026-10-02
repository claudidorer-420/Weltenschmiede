// Regelwerke über MCP: auflisten, lesen, Format nachschlagen, neu anlegen/ergänzen, aktivieren, löschen.
// Format, Prüfung und Ablage-Dokument kommen aus der App (js/core/packformat.js), die Wirkungsarten aus
// js/core/effects.js – was dort dazukommt, steht nach dem nächsten Deploy automatisch hier zur Verfügung.
import { PACK_FORMAT, PACK_VERSION, CATEGORIES, EDITIONS, emptyPack, readPack, checkPack, packDoc, keyOf } from '../../js/core/packformat.js';
import { FX_TYPES, FX_NEW, FX_ON, FX_HP, FX_SELFHP, FX_DMG, FX_AB, FX_CONDS, REACT_TRIG, REACT_EFF, PICK_DE, DICE_FX, STYLE_FX, BONUS_ACTS, SCHOOLS, COND_DE } from '../../js/core/effects.js';
import { slugify } from '../../js/lib/util.js';

const now = () => Date.now();
const low = (s) => String(s ?? '').toLowerCase().trim();
const LIB = (u) => `users/${u}/rulepacks`;
const CAMP = (cid) => `campaigns/${cid}/rules`;
const CAT_KEYS = CATEGORIES.map((c) => c.key);

// Schlüssel eines Eintrags je Kategorie – genau wie checkPack() doppelte Einträge erkennt
const entryKey = (cat, e) => (cat === 'subclasses' ? `${e.cls}|${e.name}` : cat === 'spells' ? String(e.id || slugify(e.name || '')) : cat === 'subspecies' ? `${e.species}|${keyOf(e)}` : keyOf(e));
const matches = (cat, e, ref) => {
  const r = low(ref);
  return low(entryKey(cat, e)) === r || low(e.key) === r || low(e.id) === r || low(e.name) === r;
};

// ───────────────────────── Formatbeschreibung ─────────────────────────
const GUIDE = {
  uebersicht: `Regelwerk (Format „${PACK_FORMAT}“ v${PACK_VERSION}) = eigene Spielregeln der Spielleitung über dem SRD-Grundbestand der App.
Je Kampagne ist genau EIN Regelwerk aktiv. Ablage: Kampagne (campaigns/{cid}/rules, wirkt für alle) und/oder eigene Bibliothek (users/{uid}/rulepacks, kampagnenübergreifend).
Aufbau: { name, edition: "2024"|"2014"|"beide", description, author, rules: {Grundregeln}, content: { ${CAT_KEYS.join(', ')} }, features: {Klassenmerkmal-Name: Text oder {desc, fx}}, spellLists: {klassenKey: [zauberIds]}, remove: {species|backgrounds|feats|classes|weapons|armor|spells: [keys], subclasses: ["klasse|Name"]} }.
Einträge mit gleichem Schlüssel wie im Grundbestand ERSETZEN ihn (Klassen dürfen teilweise überschrieben werden), neue kommen dazu. Schlüssel = „key“ (sonst aus dem Namen), Unterklassen = Klasse + Name, Zauber = „id“.
Längen/Reichweiten von Spezies (speed, dark) in FUSS (30 = 9 m); Flächen und Reichweiten eigener Aktionen in METERN. Würfel als „1d8“, „2d6+3“. Attribute: str dex con int wis cha. Schadensarten englisch: ${Object.keys(FX_DMG).join(', ')}.
Mechanik steckt in „fx“-Listen an fast jedem Eintrag (siehe thema „wirkungen“). Texte in desc/traits/featureDesc werden zusätzlich gelesen (z. B. „+3 m Bewegung“, „Resistenz gegen Feuerschaden“), solange keine strukturierten fx da sind.
Lizenz: Nur eigene Texte oder SRD-Inhalte (CC-BY-4.0) – keine Texte aus anderen Büchern übernehmen; Regeln mit eigenen Worten beschreiben.
Vorgehen: regelwerk_format (Themen) → regelwerk_speichern mit „eintraege“ (kategorienweise, auch in mehreren Schritten) → regelwerk_aktivieren. Bestehende Regelwerke mit regelwerk_lesen als Vorlage ansehen.`,
  rules: `rules (Grundregeln, alle optional): maxLevel (1–20), profTable [20 Zahlen], hpFirst "max"|"avg", hpLevel "avg"|"roll"|"max", feats true/false, multiclass true/false, rollMethod "4d6kh3"|"3d6"|"2d6+6"|"5d6kh3", standardArray [6 Zahlen], pointCost {8:0,…,15:9}, pointBudget 27, abilityMax 20, asiAmount 1–3, attuneMax (0 = unbegrenzt), critRule "dice"|"max", trackers [{name, max, reset "short"|"long"|"none", info}] (Zähler wie Hoffnung/Stress), abilityNames {str: {name, short}}, skills [{key, name, ability}] (ersetzt die Fertigkeitenliste), languages [Namen].`,
  species: `species: { key, name, size ("Klein"/"Mittelgroß"/…), type (Kreaturentyp, Standard Humanoide), speed (Fuß), dark (Dunkelsicht in Fuß), speeds {fly, swim, climb, burrow} (Fuß), senses {blind, tremor, true}, langs [Sprachen], asi {str: 2} (Regeln 2014), asiChoice {n, amount, exclude[]} (2014), skills [Fertigkeitskeys], skillAny n, resist [Schadensarten], hpPerLevel n, luck true, originFeat true (2024: zusätzliches Herkunftstalent), feat true (2014: Talent auf Stufe 1), traits [{name, desc}] (Merkmale), option {label, list: [{key, name, desc, resist[], fx[]}]} (Abstammung/Erbe zur Wahl), subs [Unterarten 2014: {key, name, asi, traits, resist, dark, speed, fx}], fx [] }.`,
  subspecies: `subspecies: Unterart einer vorhandenen Spezies (auch aus dem Grundbestand): { species (Spezies-Key), key, name, note, asi, traits [{name, desc}], resist [], dark, speed, speeds, fx [] }.`,
  backgrounds: `backgrounds: { key, name, abilities [3 Attribute] (2024), feat (Talent-Key, 2024 = Herkunftstalent), featChoice [Talent-Keys] (Talent zur Wahl), skills [2 Fertigkeitskeys], skillAny n, tool (Text), languages n (2014), feature + featureDesc (Hintergrundmerkmal), desc, equip (Text), goldAlt n (2024), fx [] }.`,
  feats: `feats: { key, name, cat "origin"|"general"|"style"|"epic", ed "2014"|"2024" (leer = beide), desc (voller Regeltext), a24 [Attribute +1 zur Wahl, 2024], a14 [… 2014], repeatable true, hpPerLevel n, grantSkills n, req {level, abil: {str: 13}, abilAny true, armor "light"|"medium"|"heavy"|"shield", spellcasting true, species [], classes []} (Voraussetzungen), prereq (Text), fx [] }.`,
  classes: `classes: { key, name, desc, hd 6|8|10|12, primary [Attribute], saves [2 Attribute], subLabel ("Pfad", "Schule" …), subLevel {2014: 3, 2024: 3}, skills {n, list [Keys] oder "any"}, armor [light, medium, heavy, shield], weapons ["simple", "martial", Waffenkeys], tools (Text), mc {req [[Attribute]], gain} (Mehrklassen), equip {2014, 2024} (Text), gold {2014, 2024}, style n (Kampfstil ab Stufe), subclasses {2014: [Namen], 2024: [Namen]}, feat {2024: {1: ["Merkmalname", …], 2: […] … 20}, 2014: {…}} (Merkmalstabelle je Stufe; Platzhalter "@asi" = Attributswerterhöhung/Talent, "@sub" = Unterklassenmerkmal, "@boon" = epische Gabe – Texte/Wirkungen der Merkmale stehen unter „features“), columns [{name, values [20 Werte]}] (eigene Tabellenspalten, in fx als "col:Name" bzw. "[Name]" nutzbar), cast {type "full"|"half"|"third"|"pact"|"artificer", ability, mode "prepare"|"known"|"book", cantrips [20], prep [20] bzw. known14 [20]}, fx [] }. Klassen des Grundbestands lassen sich teilweise überschreiben (nur geänderte Felder angeben).
features (oberste Ebene des Pakets, nicht in content): { "Merkmalname": "Regeltext" oder { desc, fx [] } } – gilt für Merkmale aus der Merkmalstabelle eigener und vorhandener Klassen.`,
  subclasses: `subclasses: { cls (Klassen-Key), name, ed "2014"|"2024", desc, features { 3: [{name, desc, fx []}], 6: […] … } (Merkmale je Stufe), spells { 3: [Zaubernamen] } (immer vorbereitet), caster "third" + ability + list (Drittelzauberer) }.`,
  spells: `spells: { id (Kennung), name, level 0–9, school (${Object.keys(SCHOOLS).join(', ')}), classes [Klassenkeys], desc [Absätze], time ("Aktion"), action "action"|"bonus"|"reaction"|"long", rangeKind "dist"|"self"|"touch"|"sight"|"unl", rangeM (Meter), comps ("V, G, M (…)"), duration, conc true, ritual true, Kampfwirkung: attack "ranged"|"melee" ODER save (Attribut), damage [{dice, type}], heal {dice, mod: true}, area {shape "sphere"|"cube"|"cone"|"line"|"cylinder", size m}, dazu fx {use "attack"|"save"|"heal"|"buff"|"temp"|"zone", t "enemy"|"ally"|"self"|"point", half true, up {Grad: "1d6"}, cond (verursachter Zustand)} }. spellLists (oberste Ebene): { klassenKey: [Zauber-IDs] } ergänzt Klassenlisten.`,
  weapons: `weapons: { key, name, cat "simple"|"martial", dmg "1d8", vers "1d10" (vielseitig), type ("Hieb"|"Stich"|"Wucht" oder Schadensart), p (Eigenschaften als Buchstaben: f Finesse, l leicht, h schwer, 2 zweihändig, v vielseitig, r Reichweite 3 m, t Wurfwaffe, a Munition/Fernkampf, o Laden), range [normal, weit] (m), m (Meisterschaft 2024), magic 0–3, extraDmg + extraType, ability (Angriffsattribut), rarity, attune, attuneBy [], alwaysProf, weight (kg), cost (GM), special (Text), charges {max, rest "short"|"long"|"dawn"|"never", regain "1d6+1"}, fx [] }.`,
  armor: `armor: { key, name, type "light"|"medium"|"heavy"|"clothing"|"shield", ac, bonus, dexCap, str (STÄ-Voraussetzung), stealth true (Nachteil), rarity, attune, attuneBy [], alwaysProf, weight, cost, special, charges, fx [] }.`,
  items: `items: { key, name, slot (amulet ring cloak clothing boots gloves bracers head belt focus instrument wondrous potion ammo other), rarity (gewöhnlich, ungewöhnlich, selten, sehr selten, legendär, Artefakt), attune true, attuneBy [Klassen-/Spezieskeys], consumable true, weight (kg), cost (GM), desc, charges {max, rest, regain}, fx [] }. Tränke/Verbrauchsgüter wirken über eine Aktion in fx (t "action", kind "heal" …).`,
  conditions: `conditions (eigene Zustände): { key, name, desc, rounds (Standarddauer, 0 = bis Ende), stack (stapelbar bis n), dot {dice, type, at "start"|"end"} (Schaden pro Zug), save {ab, dc, at "end"|"start"} (endet mit Rettungswurf), noHeal true, base [Standardzustände, als die er zählt: ${FX_CONDS.join(', ')}], fx [] (Wirkungen auf den Betroffenen) }.`,
  wirkungen: `fx = Liste von Wirkungen { t: Art, … }. Gemeinsame Felder: lvl (ab Stufe), cond (Bedingung, unter der sie gilt: ${Object.entries(COND_DE).map(([k, v]) => `${k} = ${v}`).join(', ')}, "sp:<spezies>", "cls:<klasse>"), inflict (verursachter Zustand bei onHit/retaliate/Aktionen), item (Waffenschlüssel – gilt nur für diese Waffe).
Werte (v): Zahl, Würfel, "pb" (Übungsbonus), "level", "mod:str"…"mod:spell", "col:Spaltenname". Würfel-Platzhalter: PB, LV, HL (halbe Stufe), MOD, [Spaltenname].
Angriffsfilter: on (${Object.keys(FX_ON).join('|')}), vs (Kreaturentyp/Größe, "größer"/"kleiner"), vsCond (Zustand des Ziels), hp (${Object.keys(FX_HP).join('|')}), selfHp (${Object.keys(FX_SELFHP).join('|')}), adv true, crit true, once true (einmal pro Zug), first true (erste Runde), allyNear true, wk [Waffenkeys], notActed true.
Auswahl (t "pick"): k (${Object.keys(PICK_DE).join(', ')}), n (Anzahl, auch "pb"/"mod:x"/"col:x"), from [Auswahlliste], options [{key, name, desc, fx}] bei k "option".
Würfelglück (t "dice", k): ${Object.keys(DICE_FX).join(', ')}. Kampfstile (t "style", k): ${Object.keys(STYLE_FX).join(', ')}. Bonusaktionen (t "bonusAct", k): ${Object.keys(BONUS_ACTS).join(', ')}.`,
  aktionen: `Eigene Aktion (t "action"): { k: Name, kind attack|weapon|save|heal|temp|buff|mark|restore|react|summon|form, cost "action"|"bonus"|"reaction"|"free", dice, type (Schadensart), ab (Attribut), save (Rettungswurf-Attribut), half true, area {shape "cone"|"line"|"sphere"|"cube"|"cylinder", size m}, range m, uses ("pb", Zahl, "mod:x") + rest "short"|"long"|"dawn" oder pool (Ressourcenname) + poolCost oder charge true (Ladungen des Gegenstands), up {Stufe: Würfel}, inflict + condDur + condSave "end", push m, selfDmg, selfHeal, addPb, atkFixed, dcFixed, replaces (blendet Aktion aus), cond (nur unter Kampfbedingung, z. B. "raging") }.
buff: fx [] + dur "rounds"|"conc"|"toggle" + rounds, eff "rage" + effV (Kampfrausch) oder "reckless". mark: dice/flat/adv/crit. restore: Zauberplatz bis lvMax oder Ressource zurückholen. summon: names [Kreaturen], types [Typen], cr/crDiv/crAt, n, keep, conc. form: types, cr-Grenze, flyAt/swimAt, mode "replace"|"temp".
Reaktion (kind "react"): trigger (${Object.entries(REACT_TRIG).map(([k, v]) => `${k} = ${v}`).join('; ')}), effect (${Object.entries(REACT_EFF).map(([k, v]) => `${k} = ${v}`).join('; ')}), dazu dice/v/half/addMod/range/saves/free.
Treffer-Option (t "hitOpt", z. B. Manöver, Göttlicher Schlag): { k, dice (auch "[Überlegenheitswürfel]"), type, pool + poolCost | uses + rest | charge | slot true (+ slotDice je Grad, slotMin), save + dc/ab, inflict + condDur, push, drain, temp, once, Filter }.
Zauber aus Merkmalen/Gegenständen (t "spell"): { k: Zaubername, lv (ab Stufe), castLv, uses "will"|Zahl|"pb", rest, dc, ab, act "bonus", uses "pool" + pool + poolCost }.`,
};

function fxCatalog(filter) {
  const f = low(filter);
  return FX_TYPES.filter((x) => !f || low(x.t).includes(f) || low(x.label).includes(f) || low(x.group).includes(f)).map((x) => ({
    t: x.t, gruppe: x.group, bedeutung: x.label, textbeispiel: x.ex, struktur: { t: x.t, ...(FX_NEW[x.t] || {}) },
  }));
}

// ───────────────────────── Werkzeuge ─────────────────────────
export function registerRuleTools({ tool, S, str, bool, KAMPAGNE, RO, RW, DEL, needGM }) {
  const obj = (description) => ({ type: 'object', additionalProperties: true, description });
  const ABLAGE = str('„kampagne“ (Standard: wirkt in der Kampagne), „bibliothek“ (eigene Sammlung, kampagnenübergreifend) oder „beide“', { enum: ['kampagne', 'bibliothek', 'beide'] });
  const REF = str('Regelwerk: ID oder Name');

  async function listAll(ctx, k) {
    const [camp, lib] = await Promise.all([
      k ? ctx.fs.list(k.p('rules')).catch(() => []) : [],
      ctx.fs.list(LIB(ctx.user.uid)).catch(() => []),
    ]);
    return { camp, lib };
  }
  const pick = (list, ref) => {
    const r = low(ref);
    return list.find((d) => d.id === ref) || list.find((d) => low(d.name) === r) || list.find((d) => low(d.name).includes(r)) || null;
  };
  async function findPack(ctx, k, ref, quelle) {
    if (!ref) throw new Error('Bitte „regelwerk“ angeben (ID oder Name).');
    const { camp, lib } = await listAll(ctx, k);
    const d = (quelle !== 'bibliothek' && pick(camp, ref)) || (quelle !== 'kampagne' && pick(lib, ref));
    if (!d) throw new Error(`Regelwerk „${ref}“ nicht gefunden. Vorhanden: ${[...camp.map((x) => `${x.name} (Kampagne, ${x.id})`), ...lib.map((x) => `${x.name} (Bibliothek, ${x.id})`)].join(', ') || '–'}`);
    const where = camp.includes(d) ? 'kampagne' : 'bibliothek';
    return { doc: d, where, pack: { ...readPack(d.json || '{}'), id: d.id } };
  }
  const summary = (d, where) => ({ id: d.id, name: d.name, regelstand: d.edition, ablage: where, ...(where === 'kampagne' ? { aktiv: d.active === true || d.active == null } : {}), beschreibung: d.description || '', anzahl: d.counts || null, geaendert: d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 16).replace('T', ' ') : null });

  tool('regelwerke', 'Regelwerke auflisten', 'Listet die Regelwerke der Kampagne (genau eines ist aktiv) und der eigenen Bibliothek mit Regelstand und Anzahl Einträgen je Kategorie.', S({ kampagne: KAMPAGNE }), RO, async (ctx, a) => {
    const k = await ctx.campaign(a.kampagne).catch(() => null);
    const { camp, lib } = await listAll(ctx, k);
    const aktiv = camp.filter((d) => d.active === true || d.active == null).sort((x, y) => (y.activatedAt || 0) - (x.activatedAt || 0))[0];
    return {
      kampagne: k?.name || null,
      aktiv: aktiv ? { id: aktiv.id, name: aktiv.name } : 'nur Grundbestand (SRD)',
      in_der_kampagne: camp.map((d) => ({ ...summary(d, 'kampagne'), aktiv: d === aktiv })),
      bibliothek: lib.map((d) => summary(d, 'bibliothek')),
    };
  });

  tool('regelwerk_format', 'Regelwerk-Format nachschlagen', 'Beschreibt das Format eines Regelwerks, damit du eines von Grund auf anlegen kannst: Übersicht, Felder je Kategorie (species, subspecies, backgrounds, feats, classes, subclasses, spells, weapons, armor, items, conditions), Grundregeln (rules), Wirkungen (fx) samt aller Wirkungsarten mit Beispielstruktur, eigene Aktionen/Reaktionen/Treffer-Optionen.', S({
    thema: str(`„uebersicht“ (Standard), eine Kategorie (${CAT_KEYS.join(', ')}), „rules“, „wirkungen“, „wirkungsarten“ (alle ${FX_TYPES.length} Arten mit Beispielstruktur), „aktionen“ oder „alles“`),
    filter: str('Bei „wirkungsarten“: nur Arten, deren Name/Gruppe diesen Text enthält (z. B. „Angriff“, „resist“)'),
  }), RO, async (_ctx, a) => {
    const t = low(a.thema || 'uebersicht');
    if (t === 'wirkungsarten') return { anzahl: FX_TYPES.length, arten: fxCatalog(a.filter), schadensarten: FX_DMG, attribute: FX_AB, zustaende: FX_CONDS };
    if (t === 'alles') return { ...GUIDE, wirkungsarten: fxCatalog(a.filter) };
    if (GUIDE[t]) return GUIDE[t];
    throw new Error(`Unbekanntes Thema „${a.thema}“. Möglich: ${[...Object.keys(GUIDE), 'wirkungsarten', 'alles'].join(', ')}`);
  });

  tool('regelwerk_lesen', 'Regelwerk lesen', 'Liest ein Regelwerk der Kampagne oder der Bibliothek. Ohne „kategorie“: Überblick (Grundregeln, Namen aller Einträge je Kategorie, Klassenmerkmale, Zauberlisten, Ausgeblendetes). Mit „kategorie“: die vollständigen Einträge (optional nur bestimmte Namen). Gut als Vorlage für eigene Einträge.', S({
    kampagne: KAMPAGNE, regelwerk: REF, quelle: str('„kampagne“ oder „bibliothek“ (Standard: zuerst Kampagne)', { enum: ['kampagne', 'bibliothek'] }),
    kategorie: str(`${CAT_KEYS.join(', ')}, „features“ (Klassenmerkmale), „spellLists“, „rules“ oder „remove“`),
    namen: { type: 'array', items: { type: 'string' }, description: 'Nur diese Einträge (Name oder Schlüssel)' },
    alles: bool('Das ganze Paket als JSON (kann sehr groß sein)'),
  }, ['regelwerk']), RO, async (ctx, a) => {
    const k = await ctx.campaign(a.kampagne).catch(() => null);
    const { doc, where, pack } = await findPack(ctx, k, a.regelwerk, a.quelle);
    const head = summary(doc, where);
    if (a.alles) return { ...head, paket: pack };
    const cat = a.kategorie;
    if (!cat) {
      return {
        ...head, autor: pack.author, rules: pack.rules,
        eintraege: Object.fromEntries(CAT_KEYS.filter((c) => pack.content[c]?.length).map((c) => [c, pack.content[c].map((e) => (c === 'subclasses' ? `${e.cls}|${e.name}` : e.name || e.key || e.id))])),
        merkmale: Object.keys(pack.features || {}), zauberlisten: Object.fromEntries(Object.entries(pack.spellLists || {}).map(([c, l]) => [c, (l || []).length])), ausgeblendet: pack.remove,
      };
    }
    if (cat === 'features') {
      const f = pack.features || {};
      return a.namen?.length ? Object.fromEntries(Object.entries(f).filter(([n]) => a.namen.some((x) => low(x) === low(n)))) : f;
    }
    if (['spellLists', 'rules', 'remove'].includes(cat)) return pack[cat] || {};
    if (!CAT_KEYS.includes(cat)) throw new Error(`Unbekannte Kategorie „${cat}“.`);
    const list = pack.content[cat] || [];
    return a.namen?.length ? list.filter((e) => a.namen.some((n) => matches(cat, e, n))) : list;
  });

  tool('regelwerk_speichern', 'Regelwerk anlegen oder ändern', 'Legt ein neues Regelwerk an (ohne „regelwerk“) oder ändert ein bestehendes: Einträge je Kategorie hinzufügen/ersetzen (gleicher Schlüssel bzw. Name ersetzt), Einträge entfernen, Grundregeln, Klassenmerkmale, Zauberlisten und Ausgeblendetes ergänzen – oder mit „paket“ ein komplettes Paket (z. B. aus einer Datei) einsetzen. Wird vor dem Speichern wie in der App geprüft; Fehler verhindern das Speichern, Warnungen kommen zurück. Große Regelwerke kategorienweise in mehreren Aufrufen füllen. Format: regelwerk_format. Nur Spielleitung (für die Kampagne).', S({
    kampagne: KAMPAGNE,
    regelwerk: str('Bestehendes Regelwerk (ID oder Name) – weglassen für ein neues'),
    name: str('Name (Pflicht bei neuen Regelwerken)'),
    regelstand: str('„2024“, „2014“ oder „beide“', { enum: EDITIONS.map((e) => e.value) }),
    beschreibung: str('Kurzbeschreibung'), autor: str('Autor'),
    eintraege: obj(`Einträge je Kategorie, z. B. {"feats": [{…}], "species": [{…}]}. Kategorien: ${CAT_KEYS.join(', ')}`),
    entfernen: obj('Einträge aus dem Paket entfernen: {"feats": ["Name oder Schlüssel"], "features": ["Merkmalname"]}'),
    regeln: obj('Grundregeln (werden zusammengeführt), siehe regelwerk_format thema „rules“'),
    merkmale: obj('Klassenmerkmale {"Name": "Text" oder {"desc": "…", "fx": […]}} (werden zusammengeführt)'),
    zauberlisten: obj('{"klassenKey": ["zauber-id", …]} (ersetzt die Liste dieser Klasse)'),
    ausblenden: obj('Grundbestand ausblenden: {"species": ["key"], "subclasses": ["klasse|Name"], "spells": ["id"]} (ersetzt die jeweilige Liste)'),
    paket: { description: 'Komplettes Paket (Objekt oder JSON-Text im Format weltenschmiede-regeln) – ersetzt den Inhalt', anyOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }] },
    ablage: ABLAGE,
    aktivieren: bool('Danach in der Kampagne aktivieren (alle anderen werden pausiert). Standard bei neuen Regelwerken in der Kampagne: nein'),
    nur_pruefen: bool('Nur prüfen, nichts speichern'),
  }), RW, async (ctx, a) => {
    let kErr = null;
    const k = await ctx.campaign(a.kampagne).catch((e) => { kErr = e; return null; });
    const ablage = a.ablage || (a.regelwerk ? '' : 'kampagne');
    let toCamp = ablage === 'kampagne' || ablage === 'beide';
    let toLib = ablage === 'bibliothek' || ablage === 'beide';
    let pack;
    let found = null;
    if (a.regelwerk) {
      found = await findPack(ctx, k, a.regelwerk, ablage === 'kampagne' || ablage === 'bibliothek' ? ablage : undefined);
      pack = found.pack;
      // ohne Angabe: überall aktualisieren, wo es dieses Regelwerk schon gibt
      if (!ablage) {
        toCamp = found.where === 'kampagne' || (k ? !!(await ctx.fs.get(`${CAMP(k.cid)}/${pack.id}`).catch(() => null)) : false);
        toLib = found.where === 'bibliothek' || !!(await ctx.fs.get(`${LIB(ctx.user.uid)}/${pack.id}`).catch(() => null));
      }
    } else {
      if (!a.name && !a.paket) throw new Error('Neues Regelwerk: bitte „name“ angeben.');
      pack = emptyPack(a.name || 'Neues Regelwerk', a.regelstand || '2024');
    }
    if (toCamp && !k) throw kErr || new Error('Kampagne nicht gefunden.');
    if (toCamp) needGM(k);
    if (a.paket) {
      const id = pack.id;
      pack = readPack(a.paket);
      if (found) pack.id = id;
    }
    if (a.name) pack.name = a.name;
    if (a.regelstand) pack.edition = a.regelstand;
    if (a.beschreibung != null) pack.description = a.beschreibung;
    if (a.autor != null) pack.author = a.autor;
    const changed = [];
    for (const [cat, list] of Object.entries(a.eintraege || {})) {
      if (!CAT_KEYS.includes(cat)) throw new Error(`Unbekannte Kategorie „${cat}“. Möglich: ${CAT_KEYS.join(', ')}`);
      const target = pack.content[cat] || (pack.content[cat] = []);
      for (const e of Array.isArray(list) ? list : [list]) {
        if (!e || typeof e !== 'object') throw new Error(`${cat}: Einträge müssen Objekte sein.`);
        const key = entryKey(cat, e);
        const i = target.findIndex((x) => entryKey(cat, x) === key || (e.name && low(x.name) === low(e.name) && (cat !== 'subclasses' || x.cls === e.cls)));
        if (i >= 0) { target[i] = e; changed.push(`${cat}: ${e.name || key} ersetzt`); } else { target.push(e); changed.push(`${cat}: ${e.name || key} neu`); }
      }
    }
    for (const [cat, refs] of Object.entries(a.entfernen || {})) {
      const list = Array.isArray(refs) ? refs : [refs];
      if (cat === 'features') { for (const n of list) { const key = Object.keys(pack.features || {}).find((x) => low(x) === low(n)); if (key) { delete pack.features[key]; changed.push(`Merkmal ${key} entfernt`); } } continue; }
      if (!CAT_KEYS.includes(cat)) throw new Error(`Unbekannte Kategorie „${cat}“.`);
      const before = pack.content[cat]?.length || 0;
      pack.content[cat] = (pack.content[cat] || []).filter((e) => !list.some((r) => matches(cat, e, r)));
      if (pack.content[cat].length < before) changed.push(`${cat}: ${before - pack.content[cat].length} entfernt`);
    }
    if (a.regeln) { pack.rules = { ...(pack.rules || {}), ...a.regeln }; changed.push('Grundregeln'); }
    if (a.merkmale) { pack.features = { ...(pack.features || {}), ...a.merkmale }; changed.push(`${Object.keys(a.merkmale).length} Merkmale`); }
    if (a.zauberlisten) { pack.spellLists = { ...(pack.spellLists || {}), ...a.zauberlisten }; changed.push('Zauberlisten'); }
    if (a.ausblenden) { pack.remove = { ...(pack.remove || {}), ...a.ausblenden }; changed.push('Ausgeblendetes'); }
    pack.updated = now();
    const chk = checkPack(pack);
    const report = { name: pack.name, id: pack.id, regelstand: pack.edition, anzahl: chk.counts, groesse_kb: Math.round(chk.size / 1024), warnungen: chk.warnings, aenderungen: changed };
    if (chk.errors.length) return { gespeichert: false, fehler: chk.errors, ...report };
    if (a.nur_pruefen) return { gespeichert: false, geprueft: true, ...report };
    const saved = [];
    let active = false;
    if (toCamp) {
      const old = await ctx.fs.get(`${CAMP(k.cid)}/${pack.id}`).catch(() => null);
      const on = a.aktivieren === true ? true : old ? old.active !== false : false;
      await ctx.fs.set(`${CAMP(k.cid)}/${pack.id}`, packDoc(pack, { active: on, order: old?.order ?? now(), activatedAt: a.aktivieren ? now() : old?.activatedAt || 0 }));
      saved.push(`Kampagne „${k.name}“`);
      active = on;
      if (a.aktivieren) {
        const all = await ctx.fs.list(k.p('rules'));
        for (const d of all) if (d.id !== pack.id && d.active !== false) await ctx.fs.update(`${CAMP(k.cid)}/${d.id}`, { active: false });
      }
    }
    if (toLib) { await ctx.fs.set(`${LIB(ctx.user.uid)}/${pack.id}`, packDoc(pack)); saved.push('Bibliothek'); }
    return { gespeichert: true, in: saved, ...(toCamp ? { aktiv: active } : {}), ...report, ...(toCamp && !active ? { hinweis: 'Zum Anwenden: regelwerk_aktivieren (oder in der App unter Regelwerke).' } : {}) };
  });

  tool('regelwerk_aktivieren', 'Regelwerk aktivieren', 'Macht ein Regelwerk der Kampagne zum aktiven (alle anderen werden pausiert) oder schaltet mit keins=true auf den reinen Grundbestand (SRD). Ein Regelwerk aus der Bibliothek wird dabei in die Kampagne kopiert. Nur Spielleitung.', S({
    kampagne: KAMPAGNE, regelwerk: REF, keins: bool('Nur Grundbestand (kein Regelwerk aktiv)'),
  }), RW, async (ctx, a) => {
    const k = await ctx.campaign(a.kampagne);
    needGM(k);
    const all = await ctx.fs.list(k.p('rules'));
    let id = null;
    if (!a.keins) {
      const { doc, where, pack } = await findPack(ctx, k, a.regelwerk);
      id = doc.id;
      if (where === 'bibliothek') await ctx.fs.set(`${CAMP(k.cid)}/${id}`, packDoc(pack, { active: true, order: now(), activatedAt: now() }));
      else await ctx.fs.update(`${CAMP(k.cid)}/${id}`, { active: true, activatedAt: now() });
    }
    for (const d of all) if (d.id !== id && d.active !== false) await ctx.fs.update(`${CAMP(k.cid)}/${d.id}`, { active: false });
    return { ok: true, aktiv: id ? (all.find((d) => d.id === id)?.name || id) : 'nur Grundbestand (SRD)' };
  });

  tool('regelwerk_loeschen', 'Regelwerk löschen', 'Löscht ein Regelwerk endgültig aus der Kampagne oder der eigenen Bibliothek (die jeweils andere Kopie bleibt). Vorher besser mit regelwerk_lesen sichern.', S({
    kampagne: KAMPAGNE, regelwerk: REF, ablage: str('„kampagne“ oder „bibliothek“', { enum: ['kampagne', 'bibliothek'] }),
  }, ['regelwerk', 'ablage']), DEL, async (ctx, a) => {
    const k = await ctx.campaign(a.kampagne).catch(() => null);
    if (a.ablage === 'kampagne') needGM(k);
    const { doc, where } = await findPack(ctx, k, a.regelwerk, a.ablage);
    await ctx.fs.remove(where === 'kampagne' ? `${CAMP(k.cid)}/${doc.id}` : `${LIB(ctx.user.uid)}/${doc.id}`);
    return { ok: true, geloescht: doc.name, aus: where };
  });
}
