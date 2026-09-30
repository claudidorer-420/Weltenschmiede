// Regelwerk-Editor: eigene Regelwerke bauen, prüfen, importieren/exportieren und in der Kampagne aktivieren.
// Grundlage bleibt immer der frei lizenzierte Grundbestand (SRD 5.1 / 5.2.1). Ein Regelwerk ergänzt, ersetzt oder
// blendet Einträge aus – angewendet wird es in core/rulesets.js, sobald die Kampagne geöffnet ist. Je Kampagne gilt
// genau ein Regelwerk (oder nur der Grundbestand).
// Bearbeitet wird eine veränderliche Kopie des Pakets (ref) – touch() zeichnet neu und merkt „ungespeichert“.
// Wirkungen: Beschreibungen werden gelesen (core/effects.js) – erkannte Formulierungen wirken im Charakterbogen;
// dazu kommen strukturierte Wirkungen (Feld fx) für alles, was sich nicht in einem Satz sagen lässt.
import { html, useState, useEffect, useMemo, useRef } from '../lib/preact.js';
import { useStore } from '../core/store.js';
import { app, myUid, useEdition, updateCampaign } from '../core/app.js';
import {
  CATEGORIES, EDITIONS, rulesState, baseEntries, plain, emptyPack, readPack, checkPack, packFromDoc,
  watchLibrary, saveToLibrary, removeFromLibrary, watchCampaignPacks, saveToCampaign, removeFromCampaign, exportPack, activeDoc, activateOnly,
} from '../core/rulesets.js';
import * as CG from '../data/chargen.js';
import { loadBase, TEMPLATE_ONLY } from '../core/rulebase.js';
import { SKILLS } from '../data/rules5e.js';
import { DAMAGE_ART, SCHOOL_ART } from '../data/artmap.js';
import { useSpells } from '../data/spells.js';
import { FX_TYPES, FX_BY, FX_HELP, FX_CONDS, MOVE_DE, SENSE_DE, fxLabel, CUSTOM_STATUS, ENGINE_EFFECTS, FX_ON, FX_HP, FX_SELFHP, DICE_FX, STYLE_FX, BONUS_ACTS, PICK_DE, SCHOOLS, REACT_TRIG, REACT_EFF } from '../core/effects.js';
import { FxText, fxNames, fxTitle } from '../ui/fxtext.js';
import { ViewFrame } from '../ui/frame.js';
import { Icon, IconBtn, Btn, Field, Toggle, Check, Segmented, Select, AutoTextarea, Empty, ViewToggle, openModal, confirmDialog, promptDialog, openMenu, toast, pickFiles } from '../ui/components.js';
import { slugify, uid, now } from '../lib/util.js';

const AB = CG.AB;
const DMG = Object.entries(DAMAGE_ART).map(([k, v]) => ({ value: k, label: v.name, color: v.color }));
const SKILL_OPTS = SKILLS.map((s) => ({ value: s.key, label: s.name }));
const AB_OPTS = AB.map((k) => ({ value: k, label: CG.AB_SHORT[k], title: CG.AB_NAME[k] }));
const FEAT_CATS = [{ value: 'origin', label: 'Herkunftstalent' }, { value: 'general', label: 'Allgemeines Talent' }, { value: 'style', label: 'Kampfstil' }, { value: 'epic', label: 'Epische Gabe' }];
const CAT_LABEL = Object.fromEntries(FEAT_CATS.map((c) => [c.value, c.label]));
const SIZE_LIST = ['Winzig', 'Klein', 'Mittelgroß', 'Groß'];
const CREATURE_TYPES = ['Humanoide', 'Feenwesen', 'Konstrukt', 'Untoter', 'Elementar', 'Celestisches Wesen', 'Unhold', 'Drache', 'Riese', 'Monstrosität', 'Pflanze', 'Bestie', 'Aberration', 'Schlick'];
const WEAPON_TYPES = ['Hieb', 'Stich', 'Wucht', 'Feuer', 'Kälte', 'Blitz', 'Säure', 'Gift', 'Energie', 'Nekrotisch', 'Gleißend', 'Psychisch', 'Schall'];
const PROPS = [['f', 'Finesse'], ['l', 'leicht'], ['h', 'schwer'], ['2', 'zweihändig'], ['v', 'vielseitig'], ['r', 'Reichweite (3 m)'], ['t', 'Wurfwaffe'], ['a', 'Munition / Fernkampf'], ['o', 'Laden']];
// Meisterschaften (Regeln 2024) – eigene Kurzfassung
const MASTERY = [
  ['Spalten', 'Triffst du, darfst du eine zweite Kreatur in 1,5 m angreifen (ohne Attributsbonus auf den Schaden) – einmal pro Zug.'],
  ['Streifen', 'Verfehlst du, erleidet das Ziel trotzdem Schaden in Höhe deines Attributsmodifikators.'],
  ['Kerbe', 'Der Zusatzangriff mit einer leichten Zweitwaffe gehört zur Angriffsaktion statt eine Bonusaktion zu kosten.'],
  ['Stoßen', 'Bei einem Treffer stößt du ein höchstens großes Ziel 3 m von dir weg.'],
  ['Schwächen', 'Bei einem Treffer hat das Ziel Nachteil auf seinen nächsten Angriff vor deinem nächsten Zug.'],
  ['Verlangsamen', 'Bei einem Treffer mit Schaden sinkt die Bewegungsrate des Ziels bis zu deinem nächsten Zug um 3 m.'],
  ['Umstoßen', 'Bei einem Treffer muss das Ziel einen KON-Rettungswurf schaffen oder wird umgestoßen.'],
  ['Plagen', 'Bei einem Treffer mit Schaden hast du Vorteil auf deinen nächsten Angriff gegen dieses Ziel.'],
];
const EXTRA_TAB = { overview: 'Überblick', rules: 'Grundregeln', remove: 'Ausblenden' };
const TABS = ['overview', 'species', 'subspecies', 'backgrounds', 'feats', 'classes', 'subclasses', 'spells', 'weapons', 'armor', 'items', 'conditions', 'rules', 'remove'];
const catOf = (k) => CATEGORIES.find((c) => c.key === k);
const m2ft = (m) => Math.round((Number(m) || 0) / 0.3);
const ft2m = (ft) => Math.round((Number(ft) || 0) * 0.3 * 10) / 10;
const fmtM = (ft) => `${String(ft2m(ft)).replace('.', ',')} m`;
const toArr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const edOf = (obj, pack) => (obj?.ed ? String(obj.ed) : pack.edition === 'beide' ? null : pack.edition);
const has14 = (obj, pack) => edOf(obj, pack) !== '2024';
const has24 = (obj, pack) => edOf(obj, pack) !== '2014';

// ───────────────────────── Infotexte ─────────────────────────
const INFO = {
  filters: 'Wann die Wirkung gilt: „gilt für“ = welche Angriffe (Waffen, Nahkampf, Fernkampf, waffenlos, Zauber, Zaubertricks, nur mit Hinterhältigem Angriff). „gegen“ = Kreaturentyp oder Größe des Ziels (z. B. „Untote, Unholde“, „groß+“ = groß oder größer). „einmal pro Zug“ wie beim Hinterhältigen Angriff. „nur wenn du diesen Schaden verursachst“ = z. B. +1 Kälte, wann immer du Kälteschaden machst.',
  onHitDc: 'Leer = 8 + Übungsbonus + Attributsmodifikator des Angriffs (bei Zaubern der Zauber-SG). Gegenstände haben oft einen festen SG (z. B. 12 oder 15).',
  spellFx: 'Zauber aus Merkmalen und Gegenständen kosten keinen Zauberplatz. „als Grad“ = wird auf diesem Grad gewirkt (z. B. Magisches Geschoss als 3. Grad). „fester SG“ = Rettungswurf-SG des Gegenstands statt deines eigenen. „kostet Ladungen“ nutzt die Ladungen des Gegenstands (Feld „Ladungen“).',
  actKind: 'Angriff: Trefferwurf mit eigenem Schaden (Klauen, Biss). Waffenaktion: Angriff mit der Waffe (an der die Wirkung hängt, sonst der besten) plus Extra-Schaden und Zustand (z. B. Hieb, der blutet, oder Schlag, der umwirft). Rettungswurf: Odem, Welle, Blick. Kampfhaltung: Wirkungen auf Zeit (Kampfrausch, Klingengesang, −5/+10). Markieren: Zeichen des Jägers o. Ä. Zurückholen: Zauberplatz oder Ressourcenpunkte. Reaktion: wird dir angeboten, wenn du getroffen wirst.',
  actDice: 'Würfel wie 2W6 oder 1W8. Platzhalter: PB = Übungsbonus (z. B. „PBW4“), LV = Stufe (z. B. „LVW6“), HL = halbe Stufe aufgerundet (z. B. „HLW6“ wie der Hinterhältige Angriff), MOD = Attributsmodifikator, „4*LV“ = viermal die Stufe, [Spaltenname] = Wert einer Tabellenspalte der Klasse (z. B. „[Überlegenheitswürfel]“ oder „[Kampfkunst]+MOD“).',
  actUses: '„kostet Punkte einer Ressource“: z. B. Ki-Punkte, Überlegenheitswürfel, Zaubereipunkte – der Name muss mit einer Ressource des Charakters beginnen. „kostet Ladungen“: bei Gegenständen mit Ladungen (Zauberstäbe, Stäbe, Ringe).',
  itemSlot: 'Wo der Gegenstand getragen wird. Tränke verbrauchen sich; alles andere wirkt, solange es im Inventar ausgerüstet ist (und eingestimmt, falls nötig).',
  attune: 'Magische Gegenstände mit Einstimmung wirken erst, wenn der Charakter sich eingestimmt hat. Wie viele gleichzeitig gehen, steht in den Grundregeln (5E: 3).',
  charges: 'Ladungen für Zauber und Aktionen des Gegenstands. „im Morgengrauen“ = nach einer langen Rast kommen so viele Ladungen zurück, wie der Würfel zeigt (z. B. 1W6+1).',
  itemFx: 'Alles, was der Gegenstand kann: Boni, Resistenzen, Zauber (auch mit Ladungen), eigene Aktionen (z. B. Waffenaktion mit Zustand), Zusatzschaden. An Waffen gelten Angriffswirkungen nur für Angriffe mit dieser Waffe.',
  status: 'Eigene Zustände für „Bei Treffer“, Aktionen und Vergeltung – z. B. „Brennend“ (1W4 Feuer pro Zug), „Blutend“, „Nass“ (Anfälligkeit Blitz), „Schwung“ (+3 m Bewegung). Stapelbar: Werte vervielfachen sich mit jeder Stufe.',
  statusBase: 'Zählt zusätzlich als dieser Grundzustand (z. B. „Kampfunfähig“) – mit all seinen Regeln.',
  alwaysProf: 'Wer die Waffe/Rüstung trägt, gilt als geübt (z. B. Elfenkettenhemd, Sonnenklinge).',
  attuneMax: 'Wie viele eingestimmte Gegenstände ein Charakter gleichzeitig tragen darf. 5E: 3 · 0 = unbegrenzt.',
  skillsRule: 'Fertigkeiten der Welt: umbenennen, einem anderen Attribut zuordnen, eigene hinzufügen (z. B. „Seefahrt“ auf WEI) oder entfernen. Leer = die 18 Fertigkeiten des Grundbestands.',
  actAb: 'Attribut, das die Aktion antreibt: Beim Angriff zählt es zum Trefferwurf (+ Übungsbonus) und zum Schaden, beim Rettungswurf bestimmt es den SG (8 + Übungsbonus + Modifikator), bei der Heilung wird sein Modifikator addiert.',
  actRange: 'Reichweite in Metern. Angriffe bis 3 m gelten als Nahkampf (1,5 m = angrenzend), darüber als Fernkampf. Bei Rettungswurf-Aktionen mit Fläche bleibt das Feld leer, wenn die Fläche vom Charakter ausgeht (Kegel, Linie, Ausstrahlung).',
  actUp: 'Optional: Ab diesen Charakterstufen ersetzt der angegebene Würfel den Grundschaden – wie bei Zaubertricks oder einer Odemwaffe (z. B. 2W6 → 3W6 → 4W6 → 5W6).',
  ed: 'Für welchen Regelstand dieser Eintrag gilt. „Wie das Paket“ übernimmt den Regelstand aus dem Überblick deines Regelwerks (Regeln 2014, Regeln 2024 oder beide). Nur nötig, wenn ein Regelwerk für beide Stände gilt und dieser Eintrag nur zu einem passt.',
  key: 'Interner, eindeutiger Schlüssel. Wählst du dieselbe Kennung wie ein Eintrag des Grundbestands, ersetzt dein Eintrag ihn. Wird aus dem Namen erzeugt, solange du sie nicht von Hand änderst.',
  size: 'Größen, die Spieler wählen dürfen. Mehrere = Auswahl im Assistenten (z. B. „Mittelgroß oder Klein“). Die Größe bestimmt den Platz auf der Karte.',
  type: 'Kreaturentyp, z. B. für Zauber wie „Person bezaubern“, die nur Humanoide betreffen.',
  speed: 'Laufbewegung pro Zug. Üblich: 9 m; Kleine Völker in Regeln 2014 meist 7,5 m; flinke Völker 10,5 m.',
  speeds: 'Weitere Bewegungsarten. „= Bewegung“ bedeutet: immer so schnell wie die Laufbewegung (auch mit Boni).',
  dark: 'Sicht im Dunkeln (schwarz-weiß). 0 = keine. Üblich: 18 m; besonders gut: 36 m. Wirkt auf der Karte (Spielersicht).',
  senses: 'Besondere Sinne: Blindsicht (ohne Augen), Erschütterungssinn (Vibrationen am Boden), Wahrer Blick (durchschaut Illusionen und Unsichtbarkeit).',
  asi: 'Feste Boni auf Attributswerte (typisch für Regeln 2014, z. B. GES +2). In Regeln 2024 kommen die Boni vom Hintergrund.',
  asiChoice: 'Frei verteilbare Boni: Anzahl der Attribute und wie viel jedes erhält, z. B. „2 Attribute um je 1“.',
  skills: 'Fertigkeiten, in denen jeder Angehörige automatisch geübt ist.',
  skillAny: 'So viele Fertigkeiten darf der Spieler zusätzlich frei wählen.',
  skillChoice: 'Eine Auswahl aus einer festen Liste, z. B. „Scharfe Sinne: eine aus Motiv erkennen, Wahrnehmung, Überlebenskunst“.',
  langs: 'Sprachen, die jeder Angehörige spricht. Dazu kannst du freie Sprachen nach Wahl vergeben.',
  resist: 'Halbiert Schaden dieser Arten – wirkt im Kampf automatisch.',
  hpPerLevel: 'Zusätzliche Trefferpunkte auf jeder Stufe (z. B. 1 bei besonders zähen Völkern). 0 = keine.',
  luck: 'Eine natürliche 1 bei W20-Würfen wird automatisch neu gewürfelt.',
  originFeat: 'Regeln 2024: Der Charakter wählt ein zusätzliches Herkunftstalent.',
  feat: 'Regeln 2014: Der Charakter erhält auf Stufe 1 ein Talent (wie beim „Menschen (Variante)“).',
  traits: 'Name und Regeltext jedes Merkmals. Erkannte Formulierungen (Symbol „i“ neben der Beschreibung) wirken direkt im Charakterbogen – fett markiert. Gepunktet unterstrichen = nur Hinweis.',
  option: 'Eine Wahl innerhalb der Spezies – z. B. Abstammung, Erbe oder Ahnen. Jede Möglichkeit kann eigene Werte und Wirkungen haben.',
  subs: 'Unterarten (Regeln 2014), z. B. Hochelf und Waldelf. Sie ergänzen die Spezies.',
  fx: 'Wirkungen, die sich nicht in einem Satz sagen lassen oder die du genau festlegen willst: Bewegungsarten, Sinne, RK, Resistenzen, Übungen, Zauber, begrenzte Nutzungen … „ab Stufe“ = gilt erst ab dieser Charakterstufe (bei Klassen: Klassenstufe). Die Bedingung schränkt ein, wann die Wirkung zählt.',
  abilities: 'Regeln 2024: drei Attribute, auf die der Spieler +2/+1 oder dreimal +1 verteilt.',
  bgFeat: 'Talent, das jeder mit diesem Hintergrund erhält (Regeln 2024: das Herkunftstalent; in Regeln 2014 z. B. für Hintergründe, die ein Talent mitbringen).',
  attuneBy: 'Leer = jeder darf sich einstimmen. Sonst nur Charaktere mit einer der gewählten Klassen oder Spezies (z. B. „erfordert Einstimmung durch einen Magier“).',
  hitOpt: 'Nach einem Treffer beim Schadenswurf wählbar (wie Niederstrecken): Zusatzschaden – auch aus einer Tabellenspalte wie [Überlegenheitswürfel] – plus optional Rettungswurf mit Zustand, Stoß oder Heilung. „einmal pro Zug“ unter Bedingungen setzen, wenn es nur einmal pro Zug geht.',
  resInit: 'Hast du beim Würfeln der Initiative keine Nutzung mehr übrig, bekommst du so viele zurück (z. B. Rastlos: 1 Überlegenheitswürfel).',
  bgFeatChoice: 'Der Spieler wählt im Assistenten eines dieser Talente (z. B. „Aufmerksam, Begabt oder Zäh“). Leer lassen, wenn der Hintergrund ein festes oder kein Talent gibt.',
  tool: 'Werkzeug oder Instrument, in dem der Hintergrund Übung gibt (Text wie im Bogen).',
  languages: 'Anzahl zusätzlicher Sprachen nach Wahl (Regeln 2014).',
  feature: 'Name des Hintergrundmerkmals (Regeln 2014), z. B. „Zuflucht der Gläubigen“.',
  featureDesc: 'Regeltext des Hintergrundmerkmals. Auch hier wirken erkannte Formulierungen.',
  equip: 'Gegenstände durch Komma getrennt, Mengen vorne („2 Dolche“). Geldbeträge wie „15 GM“ landen im Geldbeutel (Gold markiert), bekannte Waffen und Rüstungen (fett markiert) legt der Assistent gleich an und rüstet sie aus.',
  goldAlt: 'Regeln 2024: Statt der Ausrüstung dürfen Spieler diesen Goldbetrag nehmen (üblich: 50 GM).',
  featCat: 'Herkunftstalente gibt es auf Stufe 1 (Hintergrund, Menschen), allgemeine Talente statt einer Attributswerterhöhung, Kampfstile über das Klassenmerkmal, epische Gaben ab Stufe 19.',
  featAsi: 'Halbtalent: Der Spieler erhöht eines dieser Attribute um 1.',
  repeatable: 'Darf mehrfach gewählt werden (z. B. mit anderer Zauberliste oder anderen Fertigkeiten).',
  req: 'Voraussetzungen werden im Assistenten und beim Stufenaufstieg geprüft und angezeigt.',
  prereq: 'Freier Text für Voraussetzungen, die sich nicht prüfen lassen (z. B. „Mitglied einer Gilde“).',
  grantSkills: 'So viele Fertigkeiten (oder Werkzeuge) wählt der Spieler mit diesem Talent.',
  hd: 'Würfel für Trefferpunkte je Stufe. Stufe 1: Maximum (siehe Grundregeln), danach Durchschnitt oder Wurf.',
  primary: 'Das wichtigste Attribut der Klasse – Hinweis im Assistenten.',
  saves: 'Rettungswürfe, in denen die Klasse geübt ist (üblich: zwei).',
  subLabel: 'So heißt die Unterklasse in dieser Klasse, z. B. Pfad, Schule, Eid, Domäne.',
  subLevel: 'Auf dieser Stufe wählt der Charakter seine Unterklasse. In der Merkmalstabelle markiert „Unterklasse“ die Stufen mit weiteren Unterklassen-Merkmalen.',
  classSkills: 'Anzahl der Fertigkeiten, die der Spieler aus der Liste wählt. Ohne Auswahl sind alle erlaubt.',
  armor: 'Rüstungen, mit denen die Klasse geübt ist. Ohne Übung: Nachteil bei STÄ/GES-Würfen und keine Zauber.',
  weapons: 'Waffenkategorien und einzelne Waffen, mit denen die Klasse geübt ist – dann zählt der Übungsbonus auf den Angriff.',
  unarmored: 'Ohne Rüstung zählt RK = Basis + GES + dieses Attribut (wie beim Barbaren oder Mönch). Der beste Wert gilt automatisch.',
  style: 'Ab dieser Stufe wählt der Charakter einen Kampfstil (Talent-Art „Kampfstil“). Leer = kein Kampfstil.',
  expertise: 'Auf diesen Stufen erhält der Charakter Expertise (doppelter Übungsbonus) in so vielen geübten Fertigkeiten.',
  mcReq: 'Mindestwert 13 in diesen Attributen, um die Klasse per Mehrklassen zu nehmen.',
  mcGain: 'Übungen, die man beim Mehrklassen-Einstieg erhält (Hinweis im Stufenaufstieg).',
  classEquip: 'Startausrüstung. Mehrere Pakete mit „ · “ trennen, z. B. „A: Langschwert, Kettenhemd · B: 2 Handäxte, 75 GM“.',
  gold: 'Startgold als Alternative zur Ausrüstung: feste Zahl oder Würfel (z. B. „5d4×10“).',
  cast: 'Art des Zauberwirkens: Voll- (bis Grad 9), Halb- (bis Grad 5), Drittelzauberer (bis Grad 4) oder Paktmagie (wenige Plätze, kurze Rast). Die Zauberplätze ergeben sich daraus automatisch.',
  castMode: '„bereitet vor“: täglich aus der Klassenliste wählen · „kennt feste Zauber“: nur beim Stufenaufstieg tauschen · „Zauberbuch“: sammelt Zauber im Buch und bereitet daraus vor.',
  resources: 'Begrenzt nutzbare Klassenfähigkeiten (z. B. Kampfrausch, Fokuspunkte, Inspiration). Sie erscheinen im Bogen mit Anzeige und werden bei der Rast aufgefrischt.',
  columns: 'Eigene Spalten der Klassentabelle, z. B. „Wutschaden“ (+2, +3 …) oder „Kampfkunst“ (W6, W8 …). Der aktuelle Wert erscheint im Bogen – und Wirkungen können ihn nutzen: in Würfelfeldern als „[Kampfkunst]“ (wird zu 1W8), bei Zahlen über „Spalte“ (z. B. Schadensbonus = Wutschaden). Eingebaut sind außerdem „Hinterhältiger Angriff“, „Kampfkunst“ und „Wutschaden“.',
  featFx: 'Strukturierte Wirkungen dieses Merkmals – sie wirken genau so, wie sie hier stehen (z. B. „Kritischer Treffer schon ab 19“, eine Auswahl für den Spieler, eine eigene Aktion). Solange hier Wirkungen stehen, wird der Text oben nicht zusätzlich gelesen.',
  options: 'Eigene Optionen, aus denen der Spieler wählt – z. B. Kampfmanöver, Schauerliche Anrufungen, Totemtiere, Erzfeinde oder Drachenahnen. Jede Option hat einen Text und eigene Wirkungen (Zusatzschaden, Aktion mit Überlegenheitswürfel, Resistenz …). „Anzahl“ darf auch eine Tabellenspalte sein, damit mit der Stufe mehr dazukommen.',
  replaces: 'Name einer anderen Aktion, die diese ersetzt (z. B. ein Unterklassen-Kampfrausch statt des normalen). Die ersetzte Aktion verschwindet aus der Kampfleiste.',
  classFx: 'Wirkungen der Klasse selbst; „ab Stufe“ bezieht sich hier auf die Klassenstufe.',
  featTable: 'Merkmale je Stufe. Eingabetaste fügt ein Merkmal hinzu, ein Klick auf den Namen öffnet seinen Regeltext. „Extra-Angriff“, „Zwei Extra-Angriffe“ und „Drei Extra-Angriffe“ erhöhen die Angriffe pro Angriffsaktion automatisch.',
  subDesc: 'Erscheint bei der Auswahl im Assistenten.',
  subCaster: 'Unterklassen wie der „arkane Ritter“ wirken als Drittelzauberer Zauber einer Klassenliste.',
  subFeatures: 'Merkmale der Unterklasse je Stufe – mit Regeltext. Erkannte Formulierungen wirken im Bogen.',
  subSpells: 'Immer vorbereitete Zauber je Stufe (z. B. Domänen- oder Eidzauber). Sie zählen nicht gegen die vorbereiteten Zauber und erscheinen im Bogen.',
  spellClasses: 'Welche Klassen den Zauber auf ihrer Liste haben. Eigene Klassen stehen hier ebenfalls zur Auswahl.',
  comps: 'V = verbal (sprechen), G = Geste (eine freie Hand), M = Material (Komponentenbeutel oder Fokus; mit Preis verbraucht oder nötig).',
  material: 'Welches Material der Zauber braucht. Mit Preis: muss der Charakter wirklich besitzen; „wird verbraucht“ = ist danach weg.',
  duration: 'Wie lange der Zauber wirkt. Konzentration: endet, wenn der Wirker einen zweiten Konzentrationszauber wirkt oder den Konzentrations-Rettungswurf nach Schaden verfehlt.',
  higher: 'Was beim Wirken mit einem höheren Zauberplatz passiert, z. B. „Der Schaden steigt um 1W6 für jeden Grad über dem 1.“ Für die automatische Rechnung zusätzlich „+ Schaden je höherem Grad“ ausfüllen.',
  combat: 'Damit würfelt die Kampfleiste Angriff, Rettungswurf, Schaden, Heilung und Zustände automatisch. Besondere Effekte handelt die Spielleitung von Hand ab.',
  up: 'Wie viele Würfel pro Grad über dem Grundgrad dazukommen, z. B. „1d6“. Zaubertricks steigen automatisch auf Stufe 5, 11 und 17.',
  targets: 'Wen der Zauber trifft. „Mehrere“: Anzahl und wie viele pro höherem Grad dazukommen.',
  cond: 'Zustand bei misslungenem Rettungswurf (bzw. Treffer). „Rettungswurf am Zugende“: das Ziel darf es am Ende jedes eigenen Zuges erneut versuchen.',
  weaponCat: 'Einfache Waffen kann fast jeder führen, Kriegswaffen brauchen Übung (Kämpfer, Paladin …).',
  dmg: 'Schadenswürfel, z. B. 1d8. Vielseitig: Würfel bei zweihändiger Führung.',
  range: 'Normale und weite Reichweite in Metern (weit: Nachteil). Nur für Fern- und Wurfwaffen.',
  mastery: 'Regeln 2024: Besondere Eigenschaft, die Klassen mit „Waffenmeisterschaft“ nutzen.',
  magic: 'Magischer Bonus auf Angriff und Schaden (+1 bis +3).',
  extraDmg: 'Zusätzlicher Schaden bei jedem Treffer, z. B. „1d6“ Feuer (Flammenzunge).',
  wAbility: 'Nur ausfüllen, wenn die Waffe ein anderes Attribut nutzt (z. B. Weisheit bei einem Druidenstab). Sonst: STÄ, GES bei Finesse/Fernkampf.',
  armorType: 'Leicht: + GES · Mittelschwer: + GES (höchstens 2) · Schwer: ohne GES · Kleidung: zählt als ungerüstet (ungerüstete Verteidigung und „Magierrüstung“ wirken weiter) und kann trotzdem RK geben · Schild: wird zusätzlich getragen.',
  armorAc: 'Rüstung: RK-Grundwert. Schild: Bonus auf die RK (üblich +2). Kleidung: Bonus auf die RK (0 = keiner).',
  dexCap: 'Höchster GES-Bonus auf die RK. Leer = üblicher Wert (leicht unbegrenzt, mittelschwer 2, schwer 0).',
  strReq: 'Mindeststärke; darunter sinkt die Bewegung um 3 m.',
  weight: 'Gewicht in Kilogramm (für die Traglast).',
  cost: 'Preis in Goldmünzen.',
};
const ED_OPTS = [{ value: '', label: 'Wie das Paket' }, { value: '2024', label: 'Regeln 2024' }, { value: '2014', label: 'Regeln 2014' }];

// ───────────────────────── Kleine Bausteine ─────────────────────────
function Info({ text, children, wide = false }) {
  const [pin, setPin] = useState(false);
  // Lange Hilfe (wide): erscheint als Leiste am linken Rand – Klick auf „i“ hält sie fest, × oder erneuter Klick schließt
  if (wide) {
    const toggle = (e) => { e.preventDefault(); e.stopPropagation(); setPin(!pin); if (pin) e.currentTarget.blur?.(); };
    return html`<span class=${`rb-i wide${pin ? ' pin' : ''}`} tabindex="0" role="button" aria-label="Hilfe" aria-expanded=${pin}
      onClick=${toggle} onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); if (e.key === 'Escape') setPin(false); }}>
      <${Icon} name="info" size=${13} />
      <span class="rb-i-dock" role="dialog" aria-label="Hilfe" onClick=${(e) => e.stopPropagation()}>
        <span class="rb-i-dock-head"><b>Hilfe</b><span class="grow"></span>
          ${pin ? html`<button type="button" class="icon-btn" title="Schließen" aria-label="Schließen" onClick=${(e) => { e.stopPropagation(); setPin(false); }}><${Icon} name="x" size=${16} /></button>` : html`<span class="tiny faint">Klick auf „i“ hält die Hilfe fest</span>`}</span>
        ${children || text}
      </span></span>`;
  }
  return html`<span class=${`rb-i${pin ? ' pin' : ''}${wide ? ' wide' : ''}`} tabindex="0" role="button" aria-label="Info"
    onClick=${(e) => { e.preventDefault(); e.stopPropagation(); setPin(!pin); }} onMouseLeave=${() => setPin(false)}>
    <${Icon} name="info" size=${13} /><span class="rb-i-pop" role="tooltip">${children || text}</span></span>`;
}
const Lab = (label, info) => (info ? html`<span class="rb-lab">${label}<${Info} text=${info} /></span>` : label);
// Hervorgehobene Beispiele in der Hilfe: „…“ fett, Geldbeträge gold
function Hl({ text }) {
  return html`<span>${String(text).split(/(„[^“]+“)/).map((p, i) => (p.startsWith('„')
    ? html`<b key=${i} class=${/\d+\s*(GM|SM|KM)\b/.test(p) ? 'fx-hl fx-money' : 'fx-hl'}>${p.slice(1, -1)}</b>` : p))}</span>`;
}
function FxHelp() {
  return html`<div class="rb-help">
    <b>Diese Formulierungen wirken im Charakterbogen</b>
    ${FX_HELP.map(([k, v]) => html`<div key=${k}><b>${k}:</b> <${Hl} text=${v} /></div>`)}
    <div class="faint">Fett = wirkt · gepunktet = nur Hinweis. Wirkungen aus Texten gelten für Einträge aus Regelwerken; der Grundbestand hat seine Regeln fest eingebaut.</div>
  </div>`;
}

function Chips({ options, value, onChange, max = 0 }) {
  const sel = toArr(value);
  return html`<div class="rb-chips">${options.map((o) => {
    const on = sel.includes(o.value);
    return html`<button type="button" key=${o.value} class=${`rb-chip${on ? ' on' : ''}`} title=${o.title || ''} style=${o.color && on ? { borderColor: o.color, color: o.color } : null}
      onClick=${() => { if (on) onChange(sel.filter((x) => x !== o.value)); else if (!max || sel.length < max) onChange([...sel, o.value]); else toast(`Höchstens ${max} auswählbar.`); }}>${o.label}</button>`;
  })}</div>`;
}
function TextIn({ value, onChange, placeholder = '', list = null, mono = false, cls = '' }) {
  return html`<input class=${`input${mono ? ' mono' : ''}${cls ? ` ${cls}` : ''}`} value=${value ?? ''} placeholder=${placeholder} list=${list} onInput=${(e) => onChange(e.target.value)} />`;
}
function NumIn({ value, onChange, min, max, step = 1, placeholder = '' }) {
  return html`<input class="input rb-num" type="number" value=${value ?? ''} min=${min} max=${max} step=${step} placeholder=${placeholder}
    onInput=${(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />`;
}
function Area({ value, onChange, rows = 3, placeholder = '' }) {
  return html`<${AutoTextarea} value=${value ?? ''} minRows=${rows} placeholder=${placeholder} onInput=${(e) => onChange(e.target.value)} />`;
}
function DistIn({ value, onChange, placeholder = '' }) {
  return html`<div class="rb-unit"><${NumIn} value=${value == null || value === '' ? '' : ft2m(value)} step=${1.5} min=${0} placeholder=${placeholder} onChange=${(m) => onChange(m == null ? undefined : m2ft(m))} /><span>m</span></div>`;
}
// Vorschläge unter einem Feld: [{ label, v, hi }]
function Suggest({ items, value, onPick }) {
  if (!items?.length) return null;
  return html`<div class="rb-suggest"><span class="tiny faint">Vorschläge:</span>${items.map((s) => html`<button type="button" key=${s.label} class=${`rb-sug${value === s.v ? ' on' : ''}${s.hi ? ' hi' : ''}`} title=${s.title || ''} onClick=${() => onPick(s.v)}>${s.label}</button>`)}</div>`;
}
const SUG = {
  dark: () => [{ label: 'keine', v: 0 }, { label: 'kurz 9 m', v: 30 }, { label: 'normal 18 m', v: 60 }, { label: 'weit 36 m', v: 120 }],
  speed: (o) => {
    const sz = String(o.size || 'Mittelgroß');
    return [
      { label: 'Winzig 6 m', v: 20, hi: /Winzig/.test(sz) },
      { label: 'Klein 7,5 m', v: 25, hi: /Klein/.test(sz), title: 'Kleine Völker nach Regeln 2014' },
      { label: 'Standard 9 m', v: 30, hi: /Mittel|Klein/.test(sz) },
      { label: 'flink 10,5 m', v: 35 },
      { label: 'Groß 12 m', v: 40, hi: /Groß/.test(sz) },
    ];
  },
  skillAny: () => [{ label: 'keine', v: undefined }, { label: '1', v: 1 }, { label: '2', v: 2 }, { label: '3', v: 3 }],
  hpPerLevel: () => [{ label: 'keine', v: undefined }, { label: '+1 (zäh)', v: 1 }, { label: '+2 (sehr zäh)', v: 2 }],
  languages: () => [{ label: 'keine', v: undefined }, { label: '1', v: 1 }, { label: '2', v: 2 }],
  grantSkills: () => [{ label: '1', v: 1 }, { label: '2', v: 2 }, { label: '3', v: 3 }],
  goldAlt: () => [{ label: '50 GM', v: 50 }, { label: '25 GM', v: 25 }, { label: '100 GM', v: 100 }],
};

// Regeltext mit erkannten Wirkungen (✔ wirkt, ○ nur Hinweis)
// muted: Es gibt strukturierte Wirkungen – dann wird der Text nicht zusätzlich gelesen (Chips nur zur Orientierung)
function FxArea({ value, onChange, rows = 3, placeholder = '', name = '', muted = false }) {
  const text = String(value ?? '');
  const fx = useMemo(() => CG.fxText(text, { name }), [text, name]);
  const shown = fx.filter((f) => f.t !== 'money');
  return html`<div class="rb-fxarea">
    <${Area} rows=${rows} value=${value} placeholder=${placeholder} onChange=${onChange} />
    ${shown.length ? html`<div class="rb-fxchips">${shown.map((f, i) => html`<span key=${i} class=${`rb-fxchip ${f.active && !muted ? 'on' : 'off'}`} title=${fxTitle(f)}>${f.active && !muted ? '✔' : '○'} ${fxLabel(f, fxNames)}</span>`)}${muted ? html`<span class="tiny faint">Text wird nicht gelesen – es gelten die Wirkungen unten.</span>` : null}</div>` : null}
  </div>`;
}
// Ausrüstung mit Markierung erkannter Gegenstände und Geldbeträge
function EquipArea({ value, onChange, rows = 2 }) {
  const text = String(value ?? '');
  const parts = text.split(/,\s*/).map((t) => t.trim()).filter(Boolean);
  const known = (t) => {
    const n = t.replace(/^\d+\s+/, '').toLowerCase();
    return CG.WEAPONS.some((w) => n.startsWith(w.name.toLowerCase())) ? 'Waffe' : CG.ARMOR.some((a) => n.startsWith(a.name.toLowerCase())) ? 'Rüstung' : /schild/.test(n) ? 'Schild' : '';
  };
  return html`<div class="rb-fxarea">
    <${Area} rows=${rows} value=${value} placeholder="z. B. Langschwert, Kettenhemd, Rucksack, 10 Fackeln, 15 GM" onChange=${onChange} />
    ${parts.length ? html`<div class="rb-fxchips">${parts.map((t, i) => {
      const money = /^\d+\s*(GM|SM|KM|EM|PM)$/i.test(t);
      const k = money ? '' : known(t);
      return html`<span key=${i} class=${`rb-fxchip ${money ? 'money' : k ? 'on' : 'plain'}`} title=${money ? 'Kommt in den Geldbeutel' : k ? `${k} – wird angelegt und ausgerüstet` : 'Gegenstand im Rucksack'}>${t}</span>`;
    })}</div>` : null}
  </div>`;
}

// Merkmale als Name + Text (mit erkannten Wirkungen)
function PairList({ value, onChange, addLabel = 'Merkmal hinzufügen', names = ['Name', 'Beschreibung'] }) {
  const list = toArr(value);
  const set = (i, j, v) => { const n = list.map((x) => [...x]); n[i][j] = v; onChange(n); };
  return html`<div class="rb-pairs">
    ${list.map((p, i) => html`<div class="rb-pair" key=${i}>
      <div class="grow stack sm"><${TextIn} value=${p[0]} placeholder=${names[0]} onChange=${(v) => set(i, 0, v)} />
        <${FxArea} rows=${2} value=${p[1]} name=${p[0]} placeholder=${names[1]} onChange=${(v) => set(i, 1, v)} /></div>
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
  return html`<div class="rb-abmap">${AB.map((k) => html`<label key=${k}><span>${CG.AB_SHORT[k]}</span><${NumIn} value=${v[k]} min=${-4} max=${4} placeholder="0"
    onChange=${(n) => { const o = { ...v }; if (!n) delete o[k]; else o[k] = n; onChange(Object.keys(o).length ? o : undefined); }} /></label>`)}</div>`;
}

// 20 Werte (eine je Stufe) mit Vorlagen; text = beliebiger Text statt Zahl
function LevelRow({ value, onChange, presets = [], text = false }) {
  const row = Array.from({ length: 20 }, (_, i) => (Array.isArray(value) ? value[i] ?? '' : value ?? ''));
  return html`<div class="stack sm">
    <div class="rb-levelrow">${row.map((n, i) => html`<label key=${i}><span>${i + 1}</span><input class="input" type=${text ? 'text' : 'number'} min="0" value=${n}
      onInput=${(e) => { const r = row.map((x) => (text ? String(x ?? '') : x === '' ? 0 : Number(x))); r[i] = text ? e.target.value : Number(e.target.value) || 0; onChange(r); }} /></label>`)}</div>
    ${presets.length ? html`<div class="row" style="gap:6px;flex-wrap:wrap">${presets.map(([label, arr]) => html`<${Btn} size="sm" kind="ghost" key=${label} onClick=${() => onChange([...arr])}>${label}<//>`)}</div>` : null}
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

// ───────────────────────── Strukturierte Wirkungen ─────────────────────────
const FX_NEW = {
  speed: { v: 10 }, speedSet: { v: 30 }, speedMul: { v: 2 }, move: { k: 'fly', v: 30 }, sense: { k: 'dark', v: 60 }, reach: { v: 5 },
  ac: { v: 1 }, acFormula: { v: 13, k: ['dex'] }, acMin: { v: 16 }, dexCap: { v: 1 }, stealthOk: {},
  resist: { k: [] }, immune: { k: [] }, vuln: { k: [] }, condImm: { k: [] }, dmgReduce: { v: 1, k: [] }, critImmune: {},
  disAttackers: { on: 'all' }, retaliate: { on: 'melee', dice: '1d4', type: 'fire' }, evasion: {}, endure: { uses: '1', rest: 'long' }, aura: { k: 'save', v: 'mod:cha', min: 1, r: 10 },
  hpLevel: { v: 1 }, hp: { v: 5 }, regen: { dice: '1d4' }, healSelf: { v: 2 }, tempStart: { v: 'mod:cha' }, healBonus: { v: 2 },
  abil: { k: 'str', v: 1 }, abilSet: { k: 'str', v: 19 }, init: { v: 2 }, saveProf: { k: [] }, saveBonus: { v: 1 }, saveAdv: { k: [], vs: 'spell' },
  checkBonus: { k: [], v: 1 }, checkAdv: { k: [] }, jack: {}, dice: { k: [] },
  skill: { k: [] }, expertise: { k: [] }, weapon: { k: [] }, armor: { k: [] }, tool: { k: '' }, lang: { k: [] }, pick: { k: 'skill', n: 1 },
  attack: { v: 1, k: 'all' }, damage: { v: 1, k: 'all' }, dmgExtra: { dice: '1d6', type: 'fire', on: 'weapon' }, crit: { v: 1, on: 'weapon' }, advAttack: { on: 'all', vs: '' },
  onHit: { inflict: 'Vergiftet', save: 'con', dc: 'auto', rounds: 2, on: 'weapon' }, ignoreResist: { k: [] }, attacks: { v: 2 }, unarmed: { dice: '1d6', ab: 'best' }, style: { k: [] },
  spell: { k: '', lv: 0, uses: 'will' }, spellDc: { v: 1 }, spellDmg: { v: 'mod:spell', on: 'cantrip' }, slots: { lv: 1, n: 1 },
  res: { k: '', v: 1, rest: 'long' }, resMax: { k: '', v: 1 }, bonusAct: { k: ['dash', 'disengage', 'hide'] },
  action: { k: '', kind: 'save', cost: 'action', ab: 'con', dice: '2d6', type: 'fire', save: 'dex', half: true, area: { shape: 'cone', size: 4.5 }, uses: 'pb', rest: 'long' },
  adv: { k: 'Vorteil bei …' },
  heavyOk: {}, healRecv: { v: 'mod:con' }, minRoll: { k: [], v: 10 }, rangedOk: { k: ['long'], on: 'weapon' }, autoCrit: { vsCond: 'surprised' }, concDis: {},
  hitOpt: { k: '', dice: '1d8', pool: '', poolCost: 1, once: true, on: 'weapon' }, spellList: { cls: '', k: [] }, cantripHalf: {}, sculpt: { school: 'evocation' }, summonHp: { v: 30 },
  resInit: { k: '', v: 1 },
};
const ACT_KIND = [
  { value: 'attack', label: 'Angriff (Trefferwurf gegen RK)' }, { value: 'weapon', label: 'Waffenaktion (Angriff mit der Waffe + Extra)' },
  { value: 'save', label: 'Rettungswurf (Odem, Welle, Blick)' }, { value: 'heal', label: 'Heilung' }, { value: 'temp', label: 'Temporäre TP' },
  { value: 'buff', label: 'Kampfhaltung / Stärkung (Wirkungen auf Zeit)' }, { value: 'mark', label: 'Ziel markieren (Zusatzschaden, Vorteil)' },
  { value: 'restore', label: 'Zauberplatz / Ressource zurückholen' }, { value: 'react', label: 'Reaktion (Treffer, Verfehlen, Angriff, Verbündete)' },
  { value: 'summon', label: 'Beschwören / Gefährte (Kreatur aus dem Kompendium)' }, { value: 'form', label: 'Gestalt annehmen (Tiergestalt)' },
];
const ACT_COST = [{ value: 'action', label: 'Aktion' }, { value: 'bonus', label: 'Bonusaktion' }, { value: 'attack', label: 'statt eines Angriffs' }, { value: 'free', label: 'frei (keine Aktion)' }];
const ACT_AREA = [{ value: '', label: 'ein Ziel' }, { value: 'cone', label: 'Kegel' }, { value: 'line', label: 'Linie' }, { value: 'sphere', label: 'Kugel' }, { value: 'cube', label: 'Würfel' }, { value: 'emanation', label: 'Ausstrahlung um sich' }];
const ACT_USES = [{ value: 'will', label: 'beliebig oft' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }, { value: 'pb', label: 'Übungsbonus-mal' }, ...AB.map((k) => ({ value: `mod:${k}`, label: `${CG.AB_SHORT[k]}-Mod.-mal` }))];
// Welche Wirkung zu welchem Auslöser passt
const REACT_OK = {
  hit: ['reduce', 'ac', 'strike', 'riposte', 'uncrit', 'selfCond'], melee: ['reduce', 'ac', 'strike', 'riposte', 'uncrit', 'selfCond'], ranged: ['reduce', 'ac', 'strike', 'uncrit', 'selfCond'], miss: ['riposte', 'strike'],
  attacked: ['dis', 'penalty'], ally: ['reduce', 'ac', 'uncrit'], allyAttacked: ['dis', 'penalty', 'strike', 'riposte'], damaged: ['reduce', 'strike', 'selfCond'],
  failSave: ['bonus', 'reroll', 'success'], allyFailSave: ['bonus', 'reroll', 'success'],
};
function MIn({ value, onChange, placeholder = '' }) {
  return html`<div class="rb-unit"><${NumIn} value=${value ?? ''} step=${1.5} min=${0} placeholder=${placeholder} onChange=${onChange} /><span>m</span></div>`;
}
// Bedingungen, unter denen eine Wirkung gilt (Rüstung, Kampfbedingungen, nur eine Spezies/Klasse)
const COND_OPTS = [
  { value: '', label: 'immer' }, { value: 'noHeavy', label: 'ohne schwere Rüstung' }, { value: 'unarmored', label: 'ohne Rüstung' }, { value: 'unarmoredNoShield', label: 'ohne Rüstung und Schild' },
  { value: 'noShield', label: 'ohne Schild' }, { value: 'armored', label: 'in Rüstung' }, { value: 'heavy', label: 'in schwerer Rüstung' }, { value: 'shield', label: 'mit Schild' },
  { value: 'noMedHeavy', label: 'ohne mittelschwere oder schwere Rüstung' }, { value: 'dual', label: 'mit zwei Nahkampfwaffen' },
  { value: 'conc', label: 'solange du dich konzentrierst (Kampf)' }, { value: 'bloodied', label: 'bei höchstens halben TP (Kampf)' }, { value: 'raging', label: 'im Kampfrausch (Kampf)' },
];
const condOpts = () => [...COND_OPTS,
  ...[...new Map([...CG.SPECIES[2024], ...CG.SPECIES[2014]].map((s) => [s.key, s])).values()].map((s) => ({ value: `sp:${s.key}`, label: `nur Spezies: ${s.name}` })),
  ...CG.CLASSES.map((c) => ({ value: `cls:${c.key}`, label: `nur Klasse: ${c.name}` }))];
const RES_V = [{ value: 'num', label: 'feste Zahl' }, { value: 'pb', label: 'Übungsbonus' }, { value: 'level', label: 'Stufe' }, { value: 'half', label: 'halbe Stufe' }, ...AB.map((k) => ({ value: `mod:${k}`, label: `${CG.AB_SHORT[k]}-Modifikator` }))];
const RESTS = [{ value: 'short', label: 'kurze Rast' }, { value: 'long', label: 'lange Rast' }];
const ATK_K = [{ value: 'all', label: 'alle' }, { value: 'melee', label: 'Nahkampf' }, { value: 'ranged', label: 'Fernkampf' }, { value: 'weapon', label: 'Waffen' }, { value: 'unarmed', label: 'waffenlos' }, { value: 'thrown', label: 'Wurfwaffen' }, { value: 'spell', label: 'Zauber' }];
const ON_OPTS = Object.entries(FX_ON).map(([value, label]) => ({ value, label }));
const DMG_ANY = [{ value: '', label: 'wie die Waffe' }, ...DMG];
const SAVE_OPTS = [{ value: '', label: 'ohne Rettungswurf' }, ...AB_OPTS.map((o) => ({ ...o, label: `${o.label}-Rettungswurf` }))];
// Aktuelles Regelwerk (für eigene Zustände in Auswahllisten)
let CUR_PACK = null;
function condRefOpts() {
  const own = new Map(Object.entries(CUSTOM_STATUS).map(([k, s]) => [k, s.name]));
  for (const s of CUR_PACK?.content?.conditions || []) own.set(s.key || slugify(s.name || ''), s.name);
  return [{ value: '', label: '– keiner –' },
    ...FX_CONDS.map((c) => ({ value: c, label: c })),
    ...Object.entries(ENGINE_EFFECTS).map(([k, l]) => ({ value: `eff:${k}`, label: l })),
    ...[...own].filter(([k]) => k).map(([k, n]) => ({ value: `st:${k}`, label: `${n} (eigener Zustand)` }))];
}
// Wert: Zahl, Würfel, Übungsbonus oder Attributsmodifikator
function ValIn({ value, onChange, dice = true, spell = false, level = false, placeholder = '' }) {
  const t = value == null ? '' : String(value);
  const mode = t === 'pb' ? 'pb' : t === 'level' ? 'level' : t.startsWith('mod:') ? t : t.startsWith('col:') ? 'col' : /\d*[dW]\d|\[/.test(t) ? 'dice' : 'num';
  const opts = [{ value: 'num', label: 'Zahl' }, ...(dice ? [{ value: 'dice', label: 'Würfel' }] : []), { value: 'pb', label: 'Übungsbonus' }, ...(level ? [{ value: 'level', label: 'Stufe' }] : []),
    ...AB.map((k) => ({ value: `mod:${k}`, label: `${CG.AB_SHORT[k]}-Mod.` })), ...(spell ? [{ value: 'mod:spell', label: 'Zauberattribut-Mod.' }] : []), { value: 'col', label: 'Tabellenspalte' }];
  return html`<span class="rb-val"><${Select} value=${mode} options=${opts} onChange=${(m) => onChange(m === 'num' ? 1 : m === 'dice' ? '1d4' : m === 'col' ? 'col:' : m)} />
    ${mode === 'num' ? html`<${NumIn} value=${value} placeholder=${placeholder} onChange=${(x) => onChange(x ?? 0)} />` : mode === 'dice' ? html`<${TextIn} cls="rb-dice" value=${t} placeholder="1W4" onChange=${(x) => onChange(x.replace(/[Ww](?=\d)/g, 'd'))} />`
      : mode === 'col' ? html`<${TextIn} value=${t.slice(4)} placeholder="Spaltenname, z. B. Wutschaden" list="rb-colnames" onChange=${(x) => onChange(`col:${x}`)} />` : null}</span>`;
}
// Bedingungen einer Angriffswirkung: worauf, gegen wen, wann
function Filters({ f, set, on = true, types = true }) {
  const n = ['vs', 'vsCond', 'hp', 'selfHp', 'adv', 'crit', 'once', 'ifType', 'notActed', 'first', 'allyNear', 'wk'].filter((k) => f[k]).length;
  return html`<details class="rb-filt" open=${n > 0}>
    <summary><span class="small">Bedingungen${n ? ` (${n})` : ''}</span><${Info} text=${INFO.filters} /></summary>
    <div class="rb-act-row">
      ${on ? html`<span class="rb-fxp"><span class="small muted">gilt für</span><${Select} value=${f.on || f.k || 'all'} options=${ON_OPTS} onChange=${(x) => set({ on: x })} /></span>` : null}
      <span class="rb-fxp"><span class="small muted">gegen</span><${TextIn} value=${f.vs || ''} placeholder="z. B. Untote, Unholde, groß+" list="rb-ctypes" onChange=${(x) => set({ vs: x || undefined })} /></span>
      <span class="rb-fxp"><span class="small muted">Ziel mit Zustand</span><${Select} value=${f.vsCond || ''} options=${condRefOpts()} onChange=${(x) => set({ vsCond: x || undefined })} /></span>
    </div>
    <div class="rb-act-row">
      <span class="rb-fxp"><${Select} value=${f.hp || ''} options=${[{ value: '', label: 'Ziel: beliebige TP' }, ...Object.entries(FX_HP).map(([v, l]) => ({ value: v, label: l }))]} onChange=${(x) => set({ hp: x || undefined })} /></span>
      <span class="rb-fxp"><${Select} value=${f.selfHp || ''} options=${[{ value: '', label: 'du: beliebige TP' }, ...Object.entries(FX_SELFHP).map(([v, l]) => ({ value: v, label: l }))]} onChange=${(x) => set({ selfHp: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.adv} label="nur mit Vorteil" onChange=${(x) => set({ adv: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.crit} label="nur kritisch" onChange=${(x) => set({ crit: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.once} label="einmal pro Zug" onChange=${(x) => set({ once: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.notActed} label="Ziel noch nicht am Zug" onChange=${(x) => set({ notActed: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.first} label="erste Kampfrunde" onChange=${(x) => set({ first: x || undefined })} /></span>
      <span class="rb-fxp"><${Check} checked=${!!f.allyNear} label="Verbündeter neben dem Ziel" onChange=${(x) => set({ allyNear: x || undefined })} /></span>
    </div>
    <div class="rb-act-row"><span class="rb-fxp"><span class="small muted">nur mit diesen Waffen</span><${Select} value="" options=${[{ value: '', label: '+ Waffe' }, ...CG.WEAPONS.map((w) => ({ value: w.key, label: w.name }))]} onChange=${(k) => k && set({ wk: [...new Set([...toArr(f.wk), k])] })} /></span>
      ${toArr(f.wk).map((k) => html`<button type="button" class="rb-chip on" key=${k} onClick=${() => { const r = toArr(f.wk).filter((y) => y !== k); set({ wk: r.length ? r : undefined }); }}>${CG.findWeapon(k)?.name || k} ×</button>`)}</div>
    ${types ? html`<div class="rb-act-row"><span class="rb-fxp"><span class="small muted">nur wenn du diesen Schaden verursachst</span></span><${Chips} options=${DMG} value=${toArr(f.ifType)} onChange=${(x) => set({ ifType: x.length ? x : undefined })} /></div>` : null}
  </details>`;
}
const PICK_FROM = { skill: () => SKILL_OPTS, expertise: () => SKILL_OPTS, ability: () => AB_OPTS, save: () => AB_OPTS, dmg: () => DMG, lang: () => CG.LANGUAGES.map((l) => ({ value: l, label: l })), weapon: () => [{ value: 'simple', label: 'einfache Waffen' }, { value: 'martial', label: 'Kriegswaffen' }, ...CG.WEAPONS.map((w) => ({ value: w.key, label: w.name }))], armor: () => [{ value: 'light', label: 'leicht' }, { value: 'medium', label: 'mittelschwer' }, { value: 'heavy', label: 'schwer' }, { value: 'shield', label: 'Schilde' }], style: () => Object.entries(STYLE_FX).map(([v, l]) => ({ value: v, label: l })) };

function FxParams({ f, set, spells }) {
  const v = (el) => html`<span class="rb-fxp">${el}</span>`;
  const lab = (t) => html`<span class="small muted">${t}</span>`;
  switch (f.t) {
    case 'speed': case 'speedSet': case 'reach': return v(html`<${DistIn} value=${f.v} onChange=${(x) => set({ v: x || 0 })} />`);
    case 'speedMul': return v(html`${lab('×')}<${NumIn} value=${f.v} min=${1} max=${4} onChange=${(x) => set({ v: x || 2 })} />`);
    case 'move': return html`${v(html`<${Select} value=${f.k} options=${Object.entries(MOVE_DE).map(([k, l]) => ({ value: k, label: l }))} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`<${Check} checked=${f.v === 'walk'} label="= Bewegung" onChange=${(x) => set({ v: x ? 'walk' : 30 })} />`)}${f.v === 'walk' ? null : v(html`<${DistIn} value=${f.v} onChange=${(x) => set({ v: x || 0 })} />`)}`;
    case 'sense': return html`${v(html`<${Select} value=${f.k} options=${Object.entries(SENSE_DE).map(([k, l]) => ({ value: k, label: l }))} onChange=${(x) => set({ k: x })} />`)}${v(html`<${DistIn} value=${f.v} onChange=${(x) => set({ v: x || 0 })} />`)}`;
    case 'ac': case 'hpLevel': case 'hp': case 'attacks': case 'acMin': case 'spellDc': return v(html`<${NumIn} value=${f.v} onChange=${(x) => set({ v: x || 0 })} />`);
    case 'dexCap': return v(html`${lab('GES bis +2 plus')}<${NumIn} value=${f.v} min=${1} max=${10} onChange=${(x) => set({ v: x || 1 })} />`);
    case 'stealthOk': case 'critImmune': case 'evasion': case 'ignoreTerrain': return v(lab('keine weiteren Angaben nötig'));
    case 'jack': return html`${v(html`${lab('nur für (leer = alle)')}<${Chips} options=${AB_OPTS} value=${toArr(f.k)} onChange=${(x) => set({ k: x.length ? x : undefined })} />`)}${v(html`<${Check} checked=${!!f.up} label="aufrunden" onChange=${(x) => set({ up: x || undefined })} />`)}`;
    case 'carry': return v(html`${lab('+')}<${NumIn} value=${f.v ?? 100} min=${5} max=${400} step=${5} onChange=${(x) => set({ v: x || 100 })} />${lab('% (100 = doppelt)')}`);
    case 'attune': return v(html`${lab('+')}<${NumIn} value=${f.v ?? 1} min=${1} max=${6} onChange=${(x) => set({ v: x || 1 })} />${lab('Plätze')}`);
    case 'wAbility': return html`${v(html`<${Select} value=${f.k || 'cha'} options=${[...AB_OPTS, { value: 'spell', label: 'Zauberattribut' }]} onChange=${(x) => set({ k: x })} />${lab('statt STÄ/GES, wenn höher')}`)}
      ${v(html`${lab('für')}<${Select} value=${f.on || 'all'} options=${[{ value: 'all', label: 'alle Waffen' }, { value: 'melee', label: 'Nahkampfwaffen' }, { value: 'ranged', label: 'Fernkampfwaffen' }, { value: 'simple', label: 'einfache Waffen' }, { value: 'monk', label: 'Waffen ohne „schwer“/„zweihändig“' }]} onChange=${(x) => set({ on: x === 'all' ? undefined : x })} />`)}`;
    case 'onKill': return html`<div class="rb-act"><div class="rb-act-row">
      ${v(html`${lab('temp. TP')}<${TextIn} cls="rb-dice" value=${f.temp ?? ''} placeholder="z. B. MOD+LV" onChange=${(x) => set({ temp: x || undefined })} />`)}
      ${v(html`${lab('du heilst')}<${TextIn} cls="rb-dice" value=${f.heal ?? ''} placeholder="–" onChange=${(x) => set({ heal: x || undefined })} /><${Check} checked=${!!f.slot} label="× Grad des Zaubers" onChange=${(x) => set({ slot: x || undefined })} />`)}
</div>
      <div class="rb-act-row">${v(html`${lab('durch')}<${Select} value=${f.on || 'all'} options=${[{ value: 'all', label: 'jeden Schaden' }, { value: 'melee', label: 'Nahkampfangriffe' }, { value: 'weapon', label: 'Waffenangriffe' }, { value: 'spell', label: 'Zauber' }]} onChange=${(x) => set({ on: x === 'all' ? undefined : x })} />`)}
        ${v(html`<${Check} checked=${!!f.once} label="einmal pro Zug" onChange=${(x) => set({ once: x || undefined })} />`)}</div></div>`;
    case 'acFormula': return html`${v(html`${lab('RK =')}<${NumIn} value=${f.v} min=${0} max=${25} onChange=${(x) => set({ v: x || 10 })} />${lab('+')}`)}${v(html`<${Chips} options=${AB_OPTS} value=${f.k} max=${2} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`<${Check} checked=${f.shield !== false} label="Schild erlaubt" onChange=${(x) => set({ shield: x ? undefined : false })} />`)}`;
    case 'resist': return html`${v(html`<${Chips} options=${DMG} value=${f.k} onChange=${(x) => set({ k: x })} /><${Btn} size="sm" kind="ghost" onClick=${() => set({ k: DMG.map((d) => d.value) })}>alle<//>`)}${v(html`<${Check} checked=${!!f.nm} label="nur gegen nichtmagische Angriffe" onChange=${(x) => set({ nm: x || undefined, spell: undefined })} /><${Check} checked=${!!f.spell} label="nur gegen Zauberschaden" onChange=${(x) => set({ spell: x || undefined, nm: undefined })} />`)}`;
    case 'healSelf': return v(html`${lab('du erhältst')}<${ValIn} value=${f.v ?? 2} dice=${false} onChange=${(x) => set({ v: x })} /><${Check} checked=${f.slot !== false} label="+ Grad des Zaubers" onChange=${(x) => set({ slot: x ? undefined : false })} />`);
    case 'immune': case 'vuln': return v(html`<${Chips} options=${DMG} value=${f.k} onChange=${(x) => set({ k: x })} />`);
    case 'ignoreResist': return html`${v(html`<${Chips} options=${DMG} value=${f.k} onChange=${(x) => set({ k: x })} />`)}${v(html`${lab('leer = Schadensart des Angriffs · gilt für')}<${Select} value=${f.on || 'all'} options=${ON_OPTS.slice(0, 7)} onChange=${(x) => set({ on: x })} />`)}`;
    case 'condImm': return v(html`<${Chips} options=${FX_CONDS.map((c) => ({ value: c, label: c }))} value=${f.k} onChange=${(x) => set({ k: x })} />`);
    case 'dmgReduce': return html`${v(html`${lab('um')}<${ValIn} value=${f.v} onChange=${(x) => set({ v: x })} />`)}${v(html`<${Chips} options=${DMG} value=${f.k} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('leer = jeder Schaden')}<${Check} checked=${!!f.nm} label="nur nichtmagische Angriffe" onChange=${(x) => set({ nm: x || undefined })} />`)}`;
    case 'disAttackers': return html`${v(html`<${Select} value=${f.adv ? 'adv' : 'dis'} options=${[{ value: 'dis', label: 'im Nachteil' }, { value: 'adv', label: 'im Vorteil' }]} onChange=${(x) => set({ adv: x === 'adv' || undefined })} />`)}
      ${v(html`${lab('Angriffe')}<${Select} value=${f.on || 'all'} options=${[{ value: 'all', label: 'alle' }, { value: 'melee', label: 'Nahkampf' }, { value: 'ranged', label: 'Fernkampf' }, { value: 'spell', label: 'Zauberangriffe' }]} onChange=${(x) => set({ on: x })} />`)}
      ${v(html`${lab('nur von')}<${TextIn} value=${f.vs || ''} placeholder="z. B. Untote" list="rb-ctypes" onChange=${(x) => set({ vs: x || undefined })} />`)}`;
    case 'retaliate': return html`<div class="rb-act">
      <div class="rb-act-row">${v(html`${lab('wenn')}<${Select} value=${f.on || 'melee'} options=${[{ value: 'melee', label: 'dich ein Nahkampfangriff trifft' }, { value: 'hit', label: 'dich ein Angriff trifft' }, { value: 'miss', label: 'ein Angriff dich verfehlt' }]} onChange=${(x) => set({ on: x })} />`)}
        ${v(html`${lab('Schaden')}<${ValIn} value=${f.dice || f.v} onChange=${(x) => set(/[dW]/.test(String(x)) ? { dice: x, v: undefined } : { v: x, dice: undefined })} />`)}${v(html`<${Select} value=${f.type || 'force'} options=${DMG} onChange=${(x) => set({ type: x })} />`)}</div>
      <div class="rb-act-row">${v(html`<${Select} value=${f.save || ''} options=${SAVE_OPTS} onChange=${(x) => set({ save: x || undefined })} />`)}${f.save ? v(html`${lab('SG')}<${NumIn} value=${f.dc} placeholder="8+ÜB+KON" onChange=${(x) => set({ dc: x || undefined })} /><${Check} checked=${!!f.half} label="Hälfte bei Erfolg" onChange=${(x) => set({ half: x || undefined })} />`) : null}
        ${v(html`${lab('Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />`)}${v(html`<${Filters} f=${f} set=${set} on=${false} types=${false} />`)}</div></div>`;
    case 'endure': return html`${v(html`<${Select} value=${f.dice ? 'dice' : 'one'} options=${[{ value: 'one', label: 'stattdessen 1 TP' }, { value: 'dice', label: 'TP zurück (Würfel)' }]} onChange=${(x) => set({ dice: x === 'dice' ? '2d6' : undefined })} />`)}
      ${f.dice ? v(html`<${TextIn} cls="rb-dice" value=${f.dice} onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') })} />`) : null}
      ${v(html`<${Select} value=${f.uses || '1'} options=${ACT_USES.filter((o) => o.value !== 'will')} onChange=${(x) => set({ uses: x })} />${lab('pro')}<${Select} value=${f.rest || 'long'} options=${RESTS} onChange=${(x) => set({ rest: x })} />`)}`;
    case 'aura': return html`<div class="rb-act"><div class="rb-act-row">${v(html`<${Select} value=${f.k || 'save'} options=${[{ value: 'save', label: 'Bonus auf Rettungswürfe' }, { value: 'saveAdv', label: 'Vorteil gegen Zauber' }, { value: 'heal', label: 'Heilung zu deinem Zugbeginn' }, { value: 'fx', label: 'eigene Wirkungen (Resistenz, Immunität, Schaden …)' }, { value: 'dmg', label: 'Schaden für Gegner, die ihren Zug darin beginnen' }]} onChange=${(x) => set({ k: x, ...(x === 'fx' ? { v: undefined, fx: f.fx || [] } : { fx: undefined }), ...(x === 'dmg' ? { dice: f.dice || '1d6', type: f.type || 'fire', v: undefined } : {}) })} />`)}
      ${f.k === 'saveAdv' || f.k === 'fx' || f.k === 'dmg' ? null : v(html`<${ValIn} value=${f.v} onChange=${(x) => set({ v: x })} />`)}${v(html`${lab('Radius')}<${DistIn} value=${f.r || 10} onChange=${(x) => set({ r: x || 10 })} />`)}
      ${f.k === 'fx' ? v(html`<${Check} checked=${!!f.foe} label="wirkt auf Gegner statt Verbündete" onChange=${(x) => set({ foe: x || undefined })} />${f.foe ? null : html`<${Check} checked=${f.self !== false} label="gilt auch für dich" onChange=${(x) => set({ self: x ? undefined : false })} />`}`) : null}
      ${f.k === 'dmg' ? html`${v(html`<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="1W6 / LV" onChange=${(x) => set({ dice: x.replace(/[Ww](?=\d)/g, 'd') || undefined })} /><${Select} value=${f.type || 'fire'} options=${DMG} onChange=${(x) => set({ type: x })} />`)}
        ${v(html`<${Select} value=${f.save || ''} options=${SAVE_OPTS} onChange=${(x) => set({ save: x || undefined })} />${f.save ? html`${lab('SG')}<${NumIn} value=${f.dc} placeholder="8+ÜB+Mod." onChange=${(x) => set({ dc: x || undefined })} /><${Select} value=${f.ab || 'con'} options=${AB_OPTS} onChange=${(x) => set({ ab: x })} /><${Check} checked=${!!f.half} label="Hälfte bei Erfolg" onChange=${(x) => set({ half: x || undefined })} />` : null}`)}` : null}</div>
      ${f.k === 'fx' ? html`<div class="rb-act-sub"><div class="small muted">Wirkungen für Verbündete im Radius (wirken im Kampf; die Aura endet, wenn du kampfunfähig bist):</div><${FxEditor} value=${f.fx} onChange=${(x) => set({ fx: x })} /></div>` : null}</div>`;
    case 'regen': return html`${v(html`<${ValIn} value=${f.dice || f.v} onChange=${(x) => set(/[dW]/.test(String(x)) ? { dice: x, v: undefined } : { v: x, dice: undefined })} />`)}
      ${v(html`<${Select} value=${f.only || ''} options=${[{ value: '', label: 'immer (ab 1 TP)' }, { value: 'bloodied', label: 'nur bei höchstens halben TP' }]} onChange=${(x) => set({ only: x || undefined })} />`)}`;
    case 'tempStart': return v(html`<${ValIn} value=${f.v} dice=${false} onChange=${(x) => set({ v: x })} />`);
    case 'healBonus': return html`${v(html`<${Check} checked=${!!f.max} label="Heilwürfel immer maximal" onChange=${(x) => set({ max: x || undefined })} />`)}${f.max ? null : v(html`<${ValIn} value=${f.v} dice=${false} onChange=${(x) => set({ v: x })} /><${Check} checked=${!!f.slot} label="+ Grad des Zaubers" onChange=${(x) => set({ slot: x || undefined })} />`)}`;
    case 'abil': return html`${v(html`<${Select} value=${f.k} options=${AB_OPTS} onChange=${(x) => set({ k: x })} />`)}${v(html`<${NumIn} value=${f.v} onChange=${(x) => set({ v: x || 0 })} />`)}
      ${v(html`${lab('höchstens')}<${NumIn} value=${f.max} min=${1} max=${30} placeholder="–" onChange=${(x) => set({ max: x || undefined })} />`)}`;
    case 'abilSet': return html`${v(html`<${Select} value=${f.k} options=${AB_OPTS} onChange=${(x) => set({ k: x })} />`)}${v(html`${lab('wird zu')}<${NumIn} value=${f.v} min=${1} max=${30} onChange=${(x) => set({ v: x || 19 })} />`)}`;
    case 'init': return v(html`<${ValIn} value=${f.v} dice=${false} onChange=${(x) => set({ v: x })} />`);
    case 'saveProf': return v(html`<${Chips} options=${AB_OPTS} value=${f.k} onChange=${(x) => set({ k: x })} />`);
    case 'saveBonus': return html`${v(html`<${ValIn} value=${f.v} spell onChange=${(x) => set({ v: x })} />`)}
      ${v(html`<${Chips} options=${[...AB_OPTS, { value: 'death', label: 'Tod' }, { value: 'conc', label: 'Konz.' }]} value=${toArr(f.k)} onChange=${(x) => set({ k: x.length ? x : undefined })} />`)}
      ${v(html`${lab('leer = alle · nur')}<${Select} value=${f.vs || ''} options=${[{ value: '', label: 'immer' }, { value: 'spell', label: 'gegen Zauber' }]} onChange=${(x) => set({ vs: x || undefined })} />`)}`;
    case 'saveAdv': return html`${v(html`<${Select} value=${f.dis ? 'dis' : 'adv'} options=${[{ value: 'adv', label: 'Vorteil' }, { value: 'dis', label: 'Nachteil' }]} onChange=${(x) => set({ dis: x === 'dis' || undefined })} />`)}
      ${v(html`<${Chips} options=${[...AB_OPTS, { value: 'death', label: 'Tod' }, { value: 'conc', label: 'Konz.' }]} value=${toArr(f.k)} onChange=${(x) => set({ k: x.length ? x : undefined })} />`)}
      ${v(html`${lab('gegen')}<${Select} value=${f.vs || ''} options=${[{ value: '', label: 'alles' }, { value: 'spell', label: 'Zauber' }, ...FX_CONDS.map((c) => ({ value: c, label: c })), ...condRefOpts().filter((o) => o.value.startsWith('st:'))]} onChange=${(x) => set({ vs: x || undefined })} />`)}`;
    case 'checkBonus': case 'checkAdv': return html`${v(html`<${Chips} options=${[{ value: 'all', label: 'alle' }, { value: 'init', label: 'Initiative' }, ...AB_OPTS, ...SKILL_OPTS]} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`)}
      ${f.t === 'checkBonus' ? v(html`<${ValIn} value=${f.v} onChange=${(x) => set({ v: x })} />`) : v(html`<${Check} checked=${!!f.dis} label="Nachteil statt Vorteil" onChange=${(x) => set({ dis: x || undefined })} />`)}`;
    case 'dice': return v(html`<${Chips} options=${Object.entries(DICE_FX).map(([value, label]) => ({ value, label }))} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`);
    case 'style': return v(html`<${Chips} options=${Object.entries(STYLE_FX).map(([value, label]) => ({ value, label }))} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`);
    case 'bonusAct': return v(html`<${Chips} options=${Object.entries(BONUS_ACTS).map(([value, label]) => ({ value, label }))} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`);
    case 'skill': case 'expertise': return html`${v(html`<${Chips} options=${SKILL_OPTS} value=${f.k} onChange=${(x) => set({ k: x })} />`)}
      ${f.t === 'skill' ? v(html`<${Check} checked=${!!f.up} label="bist du schon geübt: Expertise" onChange=${(x) => set({ up: x || undefined })} />`) : null}`;
    case 'weapon': return html`${v(html`<${Chips} options=${[{ value: 'simple', label: 'einfache Waffen' }, { value: 'martial', label: 'Kriegswaffen' }]} value=${toArr(f.k).filter((x) => x === 'simple' || x === 'martial')} onChange=${(x) => set({ k: [...x, ...toArr(f.k).filter((y) => y !== 'simple' && y !== 'martial')] })} />`)}
      ${v(html`<${Select} value="" options=${[{ value: '', label: '+ einzelne Waffe' }, ...CG.WEAPONS.map((w) => ({ value: w.key, label: w.name }))]} onChange=${(k) => k && set({ k: [...new Set([...toArr(f.k), k])] })} />`)}
      ${toArr(f.k).filter((x) => x !== 'simple' && x !== 'martial').map((k) => html`<button type="button" class="rb-chip on" key=${k} onClick=${() => set({ k: toArr(f.k).filter((y) => y !== k) })}>${CG.findWeapon(k)?.name || k} ×</button>`)}`;
    case 'armor': return v(html`<${Chips} options=${[{ value: 'light', label: 'leicht' }, { value: 'medium', label: 'mittelschwer' }, { value: 'heavy', label: 'schwer' }, { value: 'shield', label: 'Schilde' }]} value=${f.k} onChange=${(x) => set({ k: x })} />`);
    case 'tool': return v(html`<${TextIn} value=${f.k} placeholder="z. B. Diebeswerkzeug" onChange=${(x) => set({ k: x })} />`);
    case 'lang': return html`${v(html`<${Chips} options=${CG.LANGUAGES.map((l) => ({ value: l, label: l }))} value=${f.k} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('+ nach Wahl')}<${NumIn} value=${f.n} min=${0} max=${5} onChange=${(x) => set({ n: x || undefined })} />`)}`;
    case 'pick': return html`<div class="rb-act">
      <div class="rb-act-row">${v(html`${lab('Anzahl')}<${ValIn} value=${f.n ?? 1} dice=${false} onChange=${(x) => set({ n: x || 1 })} />`)}
        ${v(html`<${Select} value=${f.k || 'skill'} options=${Object.entries(PICK_DE).map(([value, label]) => ({ value, label }))} onChange=${(x) => set({ k: x, from: undefined, into: undefined })} />`)}
        ${f.k === 'ability' ? v(html`${lab('um')}<${NumIn} value=${f.v} min=${0} max=${3} placeholder="1" onChange=${(x) => set({ v: x ?? undefined })} />${lab('höchstens')}<${NumIn} value=${f.max} placeholder="20" onChange=${(x) => set({ max: x || undefined })} />
          <${Check} checked=${toArr(f.into).includes('saveProf')} label="+ Übung im Rettungswurf" onChange=${(x) => set({ into: pickInto(f, 'saveProf', x) })} />
          <${Check} checked=${toArr(f.into).includes('skillsOf')} label="+ Übung in allen Fertigkeiten des Attributs" onChange=${(x) => set({ into: pickInto(f, 'skillsOf', x) })} />`) : null}
        ${f.k === 'dmg' ? v(html`${lab('als')}<${Select} value=${toArr(f.into)[0] || 'resist'} options=${[{ value: 'resist', label: 'Resistenz' }, { value: 'immune', label: 'Immunität' }, { value: 'ignoreResist', label: 'Resistenz ignorieren' }]} onChange=${(x) => set({ into: x })} />`) : null}
        ${f.k === 'spell' || f.k === 'cantrip' ? v(html`${lab('aus der Liste')}<${Select} value=${f.list || ''} options=${[{ value: '', label: 'alle Zauber' }, ...CG.CLASSES.map((c) => ({ value: c.key, label: c.name }))]} onChange=${(x) => set({ list: x || undefined })} />${f.k === 'spell' ? html`${lab('Grad')}<${NumIn} value=${f.lv} min=${1} max=${9} placeholder="1" onChange=${(x) => set({ lv: x || undefined })} /><${Select} value=${f.uses || '1'} options=${[{ value: '1', label: '1× pro langer Rast' }, { value: 'will', label: 'beliebig oft' }, { value: 'always', label: 'immer vorbereitet (Zauberplatz)' }]} onChange=${(x) => set({ uses: x })} />` : null}`) : null}</div>
      ${PICK_FROM[f.k] ? html`<div class="rb-act-row">${lab('nur aus (leer = alle)')}<${Chips} options=${PICK_FROM[f.k]()} value=${toArr(f.from)} onChange=${(x) => set({ from: x.length ? x : undefined })} /></div>` : null}
      ${f.k === 'option' ? html`<div class="rb-act-sub"><div class="small muted">Optionen<${Info} text=${INFO.options} /></div><${OptionsEditor} value=${f.options} onChange=${(x) => set({ options: x })} /></div>` : null}
      <div class="rb-act-row">${lab('Bezeichnung im Assistenten')}<${TextIn} value=${f.label || ''} placeholder="z. B. Widerstandsfähig: Attribut" onChange=${(x) => set({ label: x || undefined })} /></div></div>`;
    case 'attack': case 'damage': return html`<div class="rb-act"><div class="rb-act-row">${v(html`<${ValIn} value=${f.v} spell onChange=${(x) => set({ v: x })} />`)}${v(html`<${Select} value=${f.k || 'all'} options=${f.t === 'damage' ? ATK_K.filter((o) => o.value !== 'spell') : ATK_K} onChange=${(x) => set({ k: x })} />`)}</div>
      <${Filters} f=${f} set=${set} on=${false} /></div>`;
    case 'dmgExtra': return html`<div class="rb-act"><div class="rb-act-row">
      ${v(html`${lab('Würfel')}<${TextIn} cls="rb-dice" value=${f.dice === 'weapon' ? '' : f.dice || ''} placeholder="1W6" onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') || undefined })} />`)}
      ${v(html`<${Check} checked=${f.dice === 'weapon'} label="Waffenwürfel" onChange=${(x) => set({ dice: x ? 'weapon' : '1d6', n: x ? 1 : undefined })} />${f.dice === 'weapon' ? html`${lab('×')}<${NumIn} value=${f.n} min=${1} max=${4} onChange=${(x) => set({ n: x || 1 })} />` : null}`)}
      ${v(html`${lab('+')}<${ValIn} value=${f.v ?? 0} dice=${false} spell onChange=${(x) => set({ v: x || undefined })} />`)}
      ${v(html`<${Select} value=${f.type || ''} options=${DMG_ANY} onChange=${(x) => set({ type: x || undefined })} />`)}</div>
      <${Filters} f=${f} set=${set} /></div>`;
    case 'crit': return html`${v(html`${lab('kritisch ab')}<${Select} value=${String(f.v || 1)} options=${[{ value: '1', label: '19 (–1)' }, { value: '2', label: '18 (–2)' }, { value: '3', label: '17 (–3)' }]} onChange=${(x) => set({ v: Number(x) })} />`)}
      ${v(html`${lab('gilt für')}<${Select} value=${f.on || 'all'} options=${ON_OPTS.slice(0, 7)} onChange=${(x) => set({ on: x })} />`)}`;
    case 'advAttack': return html`<div class="rb-act"><div class="rb-act-row">${v(html`<${Select} value=${f.dis ? 'dis' : 'adv'} options=${[{ value: 'adv', label: 'Vorteil' }, { value: 'dis', label: 'Nachteil' }]} onChange=${(x) => set({ dis: x === 'dis' || undefined })} />`)}</div><${Filters} f=${f} set=${set} types=${false} /></div>`;
    case 'onHit': return html`<div class="rb-act">
      <div class="rb-act-row">${v(html`${lab('Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />`)}
        ${v(html`<${Select} value=${f.save || ''} options=${SAVE_OPTS} onChange=${(x) => set({ save: x || undefined })} />`)}
        ${f.save ? v(html`${lab('SG')}<${NumIn} value=${f.dc === 'auto' ? '' : f.dc} placeholder="8+ÜB+Mod." onChange=${(x) => set({ dc: x || 'auto' })} /><${Info} text=${INFO.onHitDc} />`) : null}
        ${v(html`${lab('Runden')}<${NumIn} value=${f.rounds} min=${0} max=${100} placeholder="–" onChange=${(x) => set({ rounds: x || undefined })} />`)}
        ${f.save ? v(html`<${Check} checked=${!!f.saveEnd} label="neuer Wurf am Zugende" onChange=${(x) => set({ saveEnd: x || undefined })} />`) : null}
        ${v(html`<${Check} checked=${!!f.self} label="trifft dich selbst (z. B. Schwung)" onChange=${(x) => set({ self: x || undefined })} />`)}</div>
      <div class="rb-act-row">${v(html`${lab('du heilst')}<${TextIn} cls="rb-dice" value=${f.heal || ''} placeholder="1W6" onChange=${(x) => set({ heal: x.replace(/[Ww]/g, 'd') || undefined })} />`)}
        ${v(html`${lab('temp. TP')}<${TextIn} cls="rb-dice" value=${f.temp || ''} placeholder="5" onChange=${(x) => set({ temp: x || undefined })} />`)}
        ${v(html`${lab('Stoß')}<${MIn} value=${f.push} onChange=${(x) => set({ push: x || undefined })} />`)}</div>
      <${Filters} f=${f} set=${set} /></div>`;
    case 'unarmed': return html`${v(html`<${TextIn} cls="rb-dice" value=${f.dice} placeholder="1W6" onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') })} />`)}
      ${v(html`<${Select} value=${f.type || 'bludgeoning'} options=${DMG} onChange=${(x) => set({ type: x })} />`)}
      ${v(html`<${Select} value=${f.ab || 'best'} options=${[{ value: 'best', label: 'STÄ oder GES' }, ...AB_OPTS]} onChange=${(x) => set({ ab: x })} />`)}`;
    case 'spell': return html`${v(html`<${TextIn} value=${f.k} placeholder="Name des Zaubers" list="rb-spellnames" onChange=${(x) => set({ k: x })} />`)}
      ${v(html`<${Select} value=${String(f.lv ?? 1)} options=${[{ value: '0', label: 'Zaubertrick' }, ...Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. Grad` }))]} onChange=${(x) => set({ lv: Number(x) })} />`)}
      ${v(html`<${Select} value=${f.uses || (f.lv === 0 ? 'will' : '1')} options=${[{ value: 'will', label: 'beliebig oft' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }, { value: 'pb', label: 'Übungsbonus-mal' }, { value: 'charges', label: 'kostet Ladungen des Gegenstands' }, { value: 'pool', label: 'kostet Punkte einer Ressource (Ki …)' }, { value: 'always', label: 'immer vorbereitet (Zauberplatz)' }]} onChange=${(x) => set({ uses: x })} />`)}
      ${f.uses === 'pool' ? v(html`<${TextIn} value=${f.pool || ''} placeholder="Ki-Punkte" list="rb-resnames" onChange=${(x) => set({ pool: x || undefined })} />${lab('Kosten')}<${NumIn} value=${f.cost} min=${1} placeholder="1" onChange=${(x) => set({ cost: x || undefined })} />`) : null}
      ${['1', '2', '3', 'pb'].includes(String(f.uses || (f.lv === 0 ? '' : '1'))) ? v(html`${lab('pro')}<${Select} value=${f.rest || 'long'} options=${RESTS} onChange=${(x) => set({ rest: x })} />`) : null}
      ${f.uses === 'charges' ? v(html`${lab('Ladungen')}<${NumIn} value=${f.cost} min=${1} max=${20} placeholder="1" onChange=${(x) => set({ cost: x || undefined })} />`) : null}
      ${v(html`${lab('als Grad')}<${NumIn} value=${f.castLv} min=${1} max=${9} placeholder="–" onChange=${(x) => set({ castLv: x || undefined })} />`)}
      ${v(html`${lab('Attribut')}<${Select} value=${f.ab || ''} options=${[{ value: '', label: 'wie Zauberklasse' }, ...AB_OPTS]} onChange=${(x) => set({ ab: x || undefined })} /><${Check} checked=${f.act === 'bonus'} label="als Bonusaktion" onChange=${(x) => set({ act: x ? 'bonus' : undefined })} />`)}
      ${v(html`${lab('fester SG')}<${NumIn} value=${f.dc} min=${8} max=${30} placeholder="–" onChange=${(x) => set({ dc: x || undefined })} /><${Info} text=${INFO.spellFx} />`)}
      ${spells && f.k && !spells.some((s) => s.name.toLowerCase() === String(f.k).toLowerCase()) ? html`<span class="tiny rb-warn">Zauber nicht gefunden – im Regelwerk anlegen oder Namen prüfen.</span>` : null}`;
    case 'spellDmg': return html`${v(html`<${ValIn} value=${f.v} dice=${false} spell onChange=${(x) => set({ v: x })} />`)}
      ${v(html`${lab('für')}<${Select} value=${f.on && !['all', 'cantrip', 'school'].includes(f.on) ? 'name' : f.on || 'all'} options=${[{ value: 'all', label: 'alle Zauber' }, { value: 'cantrip', label: 'Zaubertricks' }, { value: 'school', label: 'eine Zauberschule' }, { value: 'name', label: 'einen Zauber …' }]} onChange=${(x) => set({ on: x === 'name' ? '' : x, school: x === 'school' ? f.school || 'evocation' : undefined })} />`)}
      ${f.on === 'school' ? v(html`<${Select} value=${f.school || 'evocation'} options=${Object.entries(SCHOOLS).map(([value, label]) => ({ value, label }))} onChange=${(x) => set({ school: x })} />`) : null}
      ${f.on !== undefined && !['all', 'cantrip', 'school'].includes(f.on) ? v(html`<${TextIn} value=${f.on} placeholder="Name des Zaubers" list="rb-spellnames" onChange=${(x) => set({ on: x })} />`) : null}
      ${v(html`<${Check} checked=${!!f.once} label="einmal pro Zug" onChange=${(x) => set({ once: x || undefined })} />`)}
      ${v(html`${lab('nur bei')}<${Chips} options=${DMG} value=${toArr(f.ifType)} onChange=${(x) => set({ ifType: x.length ? x : undefined })} />`)}`;
    case 'slots': return html`${v(html`<${NumIn} value=${f.n} min=${1} max=${4} onChange=${(x) => set({ n: x || 1 })} />${lab('Zauberplatz/-plätze des')}`)}${v(html`<${Select} value=${String(f.lv || 1)} options=${Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. Grades` }))} onChange=${(x) => set({ lv: Number(x) })} />`)}`;
    case 'res': {
      const mode = typeof f.v === 'number' || f.v == null ? 'num' : f.v;
      return html`${v(html`<${TextIn} value=${f.k} placeholder="Name, z. B. Kampfschrei" onChange=${(x) => set({ k: x })} />`)}
        ${v(html`<${Select} value=${mode} options=${RES_V} onChange=${(x) => set({ v: x === 'num' ? 1 : x })} />`)}${mode === 'num' ? v(html`<${NumIn} value=${f.v} min=${1} onChange=${(x) => set({ v: x || 1 })} />`) : null}
        ${v(html`${lab('frischt auf')}<${Select} value=${f.rest || 'long'} options=${[...RESTS, { value: 'dawn', label: 'im Morgengrauen (Würfel)' }]} onChange=${(x) => set({ rest: x })} />`)}
        ${f.rest === 'dawn' ? v(html`${lab('zurück')}<${TextIn} cls="rb-dice" value=${f.regain || ''} placeholder="1W6+1" onChange=${(x) => set({ regain: x.replace(/[Ww]/g, 'd') || undefined })} />`) : null}
        ${v(html`${lab('bei Initiative +')}<${NumIn} value=${f.init} min=${0} max=${10} placeholder="–" onChange=${(x) => set({ init: x || undefined })} /><${Info} text=${INFO.resInit} />`)}`;
    }
    case 'resMax': return html`${v(html`<${TextIn} value=${f.k} placeholder="Ressource, z. B. Göttliche Macht" list="rb-resnames" onChange=${(x) => set({ k: x })} />`)}${v(html`${lab('+')}<${NumIn} value=${f.v} min=${1} max=${10} onChange=${(x) => set({ v: x || 1 })} />`)}`;
    case 'adv': return v(html`<${TextIn} value=${f.k} placeholder="z. B. Vorteil beim Aufspüren von Fallen" onChange=${(x) => set({ k: x })} />`);
    case 'action': return html`<${ActionParams} f=${f} set=${set} v=${v} lab=${lab} />`;
    case 'heavyOk': case 'concDis': case 'cantripHalf': return null;
    case 'healRecv': case 'summonHp': return v(html`<${ValIn} value=${f.v} dice=${false} onChange=${(x) => set({ v: x })} />${f.t === 'summonHp' ? lab('temporäre TP je Kreatur') : lab('zusätzliche TP je Heilung')}`);
    case 'minRoll': return html`${v(html`<${Chips} options=${[{ value: 'all', label: 'alle Proben' }, { value: 'prof', label: 'geübte Proben' }, ...AB_OPTS, ...SKILL_OPTS]} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('W20 zählt mindestens als')}<${NumIn} value=${f.v ?? 10} min=${2} max=${20} onChange=${(x) => set({ v: x || 10 })} />`)}`;
    case 'rangedOk': return html`${v(html`<${Chips} options=${[{ value: 'long', label: 'kein Nachteil auf große Entfernung' }, { value: 'close', label: 'kein Nachteil mit Gegnern in 1,5 m' }, { value: 'cover', label: 'ignoriert halbe/Dreivierteldeckung' }]} value=${toArr(f.k)} onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('gilt für')}<${Select} value=${f.on || 'all'} options=${[{ value: 'all', label: 'alle Fernkampfangriffe' }, { value: 'weapon', label: 'Waffenangriffe' }, { value: 'ranged', label: 'Fernkampfwaffen' }, { value: 'spell', label: 'Zauberangriffe' }]} onChange=${(x) => set({ on: x })} />`)}`;
    case 'autoCrit': return html`<div class="rb-act"><div class="rb-act-row">${v(html`${lab('gegen')}<${Select} value=${f.vsCond || ''} options=${[{ value: '', label: 'Ziele laut Bedingungen unten' }, { value: 'surprised', label: 'überraschte Kreaturen' }, ...condRefOpts().filter((o) => o.value)]} onChange=${(x) => set({ vsCond: x || undefined })} />`)}</div><${Filters} f=${{ ...f, vsCond: f.vsCond === 'surprised' ? undefined : f.vsCond }} set=${set} types=${false} /></div>`;
    case 'hitOpt': return html`<${HitOptParams} f=${f} set=${set} v=${v} lab=${lab} />`;
    case 'spellList': return html`${v(html`${lab('ganze Liste')}<${Select} value=${f.cls || ''} options=${[{ value: '', label: '– keine –' }, ...CG.CLASSES.map((c) => ({ value: c.key, label: c.name }))]} onChange=${(x) => set({ cls: x || undefined })} />`)}
      ${v(html`${lab('+ einzelne Zauber')}<${TextIn} value=${toArr(f.k).join(', ')} placeholder="Feuerball, Nebelschritt" list="rb-spellnames" onChange=${(x) => set({ k: x.split(',').map((s) => s.trim()).filter(Boolean) })} />`)}`;
    case 'sculpt': return v(html`${lab('nur Zauber der Schule')}<${Select} value=${f.school || ''} options=${[{ value: '', label: 'alle Zauber' }, ...Object.entries(SCHOOLS).map(([value, label]) => ({ value, label }))]} onChange=${(x) => set({ school: x || undefined })} />`);
    case 'resInit': return v(html`<${TextIn} value=${f.k} placeholder="Ressource, z. B. Überlegenheitswürfel" list="rb-resnames" onChange=${(x) => set({ k: x })} />${lab('+')}<${NumIn} value=${f.v} min=${1} max=${10} onChange=${(x) => set({ v: x || 1 })} />`);
    default: return null;
  }
}
// Treffer-Option: Zusatzschaden und Reiter gegen Kosten – angeboten beim Schadenswurf nach einem Treffer
function HitOptParams({ f, set, v, lab }) {
  const cost = f.slot ? 'slot' : f.charge ? 'charge' : f.pool ? 'pool' : f.uses && f.uses !== 'will' ? 'uses' : 'free';
  const setCost = (c) => set({ slot: c === 'slot' || undefined, charge: c === 'charge' ? f.charge || 1 : undefined, pool: c === 'pool' ? f.pool || 'Überlegenheitswürfel' : undefined, poolCost: c === 'pool' ? f.poolCost || 1 : undefined, uses: c === 'uses' ? f.uses || '1' : undefined, rest: c === 'uses' ? f.rest || 'short' : undefined, slotDice: c === 'slot' ? f.slotDice || '1d8' : undefined });
  return html`<div class="rb-act">
    <div class="rb-act-row">${v(html`<${TextIn} value=${f.k || ''} placeholder="Name, z. B. Stoßangriff" onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('+ Schaden')}<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="[Überlegenheitswürfel]" onChange=${(x) => set({ dice: x.replace(/[Ww](?=\d)/g, 'd') || undefined })} /><${Select} value=${f.type || ''} options=${DMG_ANY} onChange=${(x) => set({ type: x || undefined })} /><${Info} text=${INFO.hitOpt} />`)}</div>
    <div class="rb-act-row">${v(html`${lab('kostet')}<${Select} value=${cost} options=${[{ value: 'free', label: 'nichts (nur Bedingungen)' }, { value: 'pool', label: 'Punkte einer Ressource' }, { value: 'uses', label: 'begrenzte Nutzungen' }, { value: 'charge', label: 'Ladungen des Gegenstands' }, { value: 'slot', label: 'einen Zauberplatz' }]} onChange=${setCost} />`)}
      ${cost === 'pool' ? v(html`<${TextIn} value=${f.pool || ''} placeholder="Überlegenheitswürfel" list="rb-resnames" onChange=${(x) => set({ pool: x || undefined })} />${lab('×')}<${NumIn} value=${f.poolCost} min=${1} max=${10} placeholder="1" onChange=${(x) => set({ poolCost: x || undefined })} />`) : null}
      ${cost === 'uses' ? v(html`<${Select} value=${f.uses || '1'} options=${ACT_USES.filter((o) => o.value !== 'will')} onChange=${(x) => set({ uses: x })} />${lab('pro')}<${Select} value=${f.rest || 'short'} options=${RESTS} onChange=${(x) => set({ rest: x })} />`) : null}
      ${cost === 'charge' ? v(html`<${NumIn} value=${f.charge} min=${1} max=${10} onChange=${(x) => set({ charge: x || 1 })} />${lab('Ladung(en)')}`) : null}
      ${cost === 'slot' ? v(html`${lab('+ je Grad')}<${TextIn} cls="rb-dice" value=${f.slotDice || ''} placeholder="1W8" onChange=${(x) => set({ slotDice: x.replace(/[Ww](?=\d)/g, 'd') || undefined })} />${lab('ab Grad')}<${NumIn} value=${f.slotMin} min=${1} max=${9} placeholder="1" onChange=${(x) => set({ slotMin: x || undefined })} />`) : null}</div>
    <div class="rb-act-row">${v(html`${lab('Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />`)}
      ${v(html`<${Select} value=${f.save || ''} options=${SAVE_OPTS} onChange=${(x) => set({ save: x || undefined })} />`)}
      ${f.save ? v(html`${lab('SG')}<${NumIn} value=${f.dc} placeholder="8+ÜB+STÄ/GES" onChange=${(x) => set({ dc: x || undefined })} /><${Select} value=${f.ab || ''} options=${[{ value: '', label: 'bestes aus STÄ/GES' }, ...AB_OPTS]} onChange=${(x) => set({ ab: x || undefined })} />`) : null}
      ${f.inflict ? v(html`${lab('Runden')}<${NumIn} value=${f.condDur} min=${0} max=${100} placeholder="–" onChange=${(x) => set({ condDur: x || undefined })} />`) : null}
      ${v(html`${lab('Stoß')}<${MIn} value=${f.push} onChange=${(x) => set({ push: x || undefined })} />`)}
      ${v(html`<${Check} checked=${!!f.drain} label="du heilst in Höhe dieses Schadens" onChange=${(x) => set({ drain: x || undefined })} />`)}
      ${v(html`${lab('temp. TP für dich')}<${TextIn} cls="rb-dice" value=${f.temp || ''} placeholder="–" onChange=${(x) => set({ temp: x || undefined })} />`)}</div>
    <${Filters} f=${f} set=${set} /></div>`;
}
// Eigene Aktion: Art, Kosten, Würfel, Rettungswurf, Fläche, Reiter, Nutzungen, Stärkungen
function ActionParams({ f, set, v, lab }) {
  const kind = f.kind || 'attack';
  const up = f.up || {};
  const dmgKinds = ['attack', 'weapon', 'save'].includes(kind);
  const riders = ['attack', 'weapon', 'save'].includes(kind);
  return html`<div class="rb-act">
    <div class="rb-act-row">${v(html`<${TextIn} value=${f.k} placeholder="Name, z. B. Odemwaffe" onChange=${(x) => set({ k: x })} />`)}
      ${v(html`${lab('ersetzt')}<${TextIn} value=${f.replaces || ''} placeholder="–" onChange=${(x) => set({ replaces: x || undefined })} /><${Info} text=${INFO.replaces} />`)}
      ${v(html`<${Select} value=${kind} options=${ACT_KIND} onChange=${(x) => set({ kind: x })} />`)}
      ${kind === 'react' ? null : v(html`<${Select} value=${f.cost || 'action'} options=${ACT_COST} onChange=${(x) => set({ cost: x })} />`)}<${Info} text=${INFO.actKind} /></div>
    ${kind === 'react' ? html`<div class="rb-act-row">
      ${v(html`${lab('Auslöser')}<${Select} value=${f.trigger || 'hit'} options=${Object.entries(REACT_TRIG).map(([value, label]) => ({ value, label }))} onChange=${(x) => set({ trigger: x, ...(REACT_OK[x] && !REACT_OK[x].includes(f.effect || 'reduce') ? { effect: REACT_OK[x][0] } : {}) })} />`)}
      ${v(html`<${Select} value=${f.effect || 'reduce'} options=${(REACT_OK[f.trigger || 'hit'] || Object.keys(REACT_EFF)).map((value) => ({ value, label: REACT_EFF[value] }))} onChange=${(x) => set({ effect: x })} />`)}
      ${['ally', 'allyAttacked', 'allyFailSave'].includes(f.trigger) || f.effect === 'penalty' ? v(html`${lab(f.effect === 'penalty' ? 'Reichweite zum Angreifer' : 'Reichweite')}<${MIn} value=${f.range} placeholder=${f.effect === 'penalty' ? '18' : f.trigger === 'allyFailSave' ? '9' : '1,5'} onChange=${(x) => set({ range: x || undefined })} />`) : null}
      ${['penalty', 'bonus'].includes(f.effect) ? v(html`${lab(f.effect === 'penalty' ? 'abziehen' : 'Würfel')}<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder=${f.effect === 'penalty' ? '[Inspiration]' : '1W4'} onChange=${(x) => set({ dice: x.replace(/[Ww](?=d)/g, 'd') || undefined })} />`) : null}
      ${['bonus', 'reroll', 'success'].includes(f.effect) ? v(html`${lab('nur bei (leer = alle)')}<${Chips} options=${AB_OPTS} value=${toArr(f.saves)} onChange=${(x) => set({ saves: x.length ? x : undefined })} />`) : null}
      ${f.effect === 'selfCond' ? v(html`${lab('Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />${lab('Runden')}<${NumIn} value=${f.condDur} min=${1} max=${100} placeholder="1" onChange=${(x) => set({ condDur: x || undefined })} />`) : null}
      ${v(html`<${Check} checked=${!!f.free} label="braucht keine Reaktion" onChange=${(x) => set({ free: x || undefined })} />`)}
      ${f.effect === 'riposte' ? v(html`${lab('+ Zusatzwürfel')}<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="–" onChange=${(x) => set({ dice: x.replace(/[Ww](?=\d)/g, 'd') || undefined })} />`) : null}
      ${(f.effect || 'reduce') === 'reduce' ? html`${v(html`<${Check} checked=${!!f.half} label="halbieren" onChange=${(x) => set({ half: x || undefined })} />`)}${f.half ? null : v(html`<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="1W12" onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') })} />${lab('+')}<${Select} value=${f.addMod || ''} options=${[{ value: '', label: '–' }, ...AB_OPTS.map((o) => ({ ...o, label: `${o.label}-Mod.` }))]} onChange=${(x) => set({ addMod: x || undefined })} />`)}` : null}
      ${f.effect === 'ac' ? v(html`${lab('RK +')}<${ValIn} value=${f.v ?? 'pb'} dice=${false} onChange=${(x) => set({ v: x })} />${lab('oder Würfel')}<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="–" onChange=${(x) => set({ dice: x.replace(/[Ww](?=d)/g, 'd') || undefined })} />`) : null}
      ${f.effect === 'strike' ? html`${v(html`<${TextIn} cls="rb-dice" value=${f.dice || ''} placeholder="2W4" onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') || undefined })} /><${Select} value=${f.type || 'force'} options=${DMG} onChange=${(x) => set({ type: x })} />`)}
        ${v(html`<${Select} value=${f.save || ''} options=${SAVE_OPTS} onChange=${(x) => set({ save: x || undefined })} />`)}${v(html`${lab('Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />`)}` : null}
    </div>` : null}
    ${dmgKinds || kind === 'heal' || kind === 'temp' || kind === 'mark' ? html`<div class="rb-act-row">
      ${v(html`${lab(kind === 'heal' ? 'Heilung' : kind === 'temp' ? 'Temp. TP' : kind === 'mark' ? 'Zusatzschaden' : kind === 'weapon' ? 'Extra-Schaden' : 'Schaden')}<${TextIn} value=${f.dice} placeholder=${kind === 'weapon' ? '1W6 (optional)' : '2W6'} cls="rb-dice" onChange=${(x) => set({ dice: x.replace(/[Ww]/g, 'd') })} /><${Info} text=${INFO.actDice} />`)}
      ${kind === 'heal' ? v(html`<${Check} checked=${f.addMod !== false} label="+ Attributsmod." onChange=${(x) => set({ addMod: x ? undefined : false })} /><${Check} checked=${!!f.addLevel} label="+ Stufe" onChange=${(x) => set({ addLevel: x || undefined })} />`)
        : kind === 'temp' || kind === 'mark' ? null : v(html`<${Select} value=${f.type || ''} options=${kind === 'weapon' ? DMG_ANY : DMG} onChange=${(x) => set({ type: x || undefined })} />`)}
      ${dmgKinds ? v(html`<${Check} checked=${!!f.addPb} label="+ Übungsbonus" onChange=${(x) => set({ addPb: x || undefined })} />`) : null}
      ${kind === 'mark' ? v(html`<${Check} checked=${!!f.adv} label="Vorteil gegen das Ziel" onChange=${(x) => set({ adv: x || undefined })} />${lab('+ fest')}<${ValIn} value=${f.flat ?? 0} dice=${false} onChange=${(x) => set({ flat: x || undefined })} />${lab('kritisch gegen das Ziel ab')}<${Select} value=${String(f.crit || 0)} options=${[{ value: '0', label: '20' }, { value: '1', label: '19' }, { value: '2', label: '18' }]} onChange=${(x) => set({ crit: Number(x) || undefined })} />`) : null}
      ${kind !== 'weapon' ? v(html`${lab('Attribut')}<${Select} value=${f.ab || 'con'} options=${AB_OPTS} onChange=${(x) => set({ ab: x })} /><${Info} text=${INFO.actAb} />`) : null}</div>` : null}
    ${kind === 'save' ? html`<div class="rb-act-row">
      ${v(html`${lab('Rettungswurf')}<${Select} value=${f.save || 'dex'} options=${AB_OPTS} onChange=${(x) => set({ save: x })} />`)}
      ${v(html`<${Check} checked=${f.half !== false} label="halber Schaden bei Erfolg" onChange=${(x) => set({ half: x ? undefined : false })} />`)}
      ${v(html`${lab('Fläche')}<${Select} value=${f.area?.shape || ''} options=${ACT_AREA} onChange=${(x) => set({ area: x ? { shape: x, size: f.area?.size || 4.5 } : undefined })} />`)}
      ${f.area?.shape ? v(html`<${MIn} value=${f.area.size} onChange=${(x) => set({ area: { ...f.area, size: x || 1.5 } })} />`) : null}
      ${v(html`${lab('nur gegen')}<${TextIn} value=${f.vs || ''} placeholder="z. B. Untote" list="rb-ctypes" onChange=${(x) => set({ vs: x || undefined })} />`)}</div>` : null}
    ${kind === 'buff' ? html`<div class="rb-act-row">
      ${v(html`${lab('Dauer')}<${Select} value=${f.dur || 'rounds'} options=${[{ value: 'rounds', label: 'Runden' }, { value: 'conc', label: 'Konzentration' }, { value: 'toggle', label: 'bis wieder ausgeschaltet' }]} onChange=${(x) => set({ dur: x === 'rounds' ? undefined : x })} />`)}
      ${f.dur === 'toggle' ? null : v(html`<${NumIn} value=${f.rounds} min=${1} max=${6000} placeholder="10" onChange=${(x) => set({ rounds: x || undefined })} />${lab('Runden (10 = 1 Minute)')}`)}
      ${v(html`${lab('für')}<${Select} value=${f.target || 'self'} options=${[{ value: 'self', label: 'dich' }, { value: 'ally', label: 'eine berührte Kreatur' }]} onChange=${(x) => set({ target: x === 'self' ? undefined : x })} />`)}
      ${v(html`${lab('temp. TP')}<${TextIn} cls="rb-dice" value=${f.temp || ''} placeholder="–" onChange=${(x) => set({ temp: x || undefined })} />`)}
      ${v(html`${lab('Effekt')}<${Select} value=${f.eff || ''} options=${[{ value: '', label: '–' }, ...Object.entries(ENGINE_EFFECTS).map(([k, l]) => ({ value: k, label: l }))]} onChange=${(x) => set({ eff: x || undefined })} />`)}
      ${f.eff === 'rage' ? v(html`${lab('Schadensbonus')}<${ValIn} value=${f.effV ?? 2} dice=${false} onChange=${(x) => set({ effV: x })} />`) : null}</div>
      <div class="rb-act-sub"><div class="small muted">Wirkungen, solange die Stärkung anhält (z. B. Resistenz, +2 Schaden im Nahkampf, Bewegung verdoppelt):</div>
        <${FxEditor} value=${f.fx} onChange=${(x) => set({ fx: x.length ? x : undefined })} /></div>` : null}
    ${kind === 'summon' ? html`<div class="rb-act-row">
      ${v(html`${lab('Kreaturenart')}<${Chips} options=${['Tier', 'Elementar', 'Feenwesen', 'Unhold', 'Untoter', 'Himmlisch', 'Konstrukt', 'Pflanze', 'Drache', 'Monstrosität'].map((t) => ({ value: t, label: t }))} value=${toArr(f.types)} onChange=${(x) => set({ types: x.length ? x : undefined })} />`)}</div>
      <div class="rb-act-row">${v(html`${lab('oder genau')}<${TextIn} value=${toArr(f.names).join(', ')} placeholder="z. B. Wolf, Schreckenswolf" onChange=${(x) => set({ names: x.split(/\s*,\s*/).filter(Boolean).length ? x.split(/\s*,\s*/).filter(Boolean) : undefined })} />`)}
      ${v(html`${lab('bis HG')}<${ValIn} value=${f.cr ?? 1} dice=${false} onChange=${(x) => set({ cr: x })} />`)}
      ${v(html`${lab('Anzahl')}<${NumIn} value=${f.n} min=${1} max=${8} placeholder="1" onChange=${(x) => set({ n: x || undefined })} />`)}
      ${v(html`${lab('Dauer')}<${Select} value=${f.dur || 'perm'} options=${[{ value: 'perm', label: 'bis besiegt / entlassen' }, { value: 'conc', label: 'Konzentration' }]} onChange=${(x) => set({ dur: x === 'perm' ? undefined : x })} /><${Check} checked=${!!f.keep} label="bleibt bei 0 TP liegen" onChange=${(x) => set({ keep: x || undefined })} />`)}
      ${v(html`${lab('Reichweite')}<${MIn} value=${f.range} placeholder="9" onChange=${(x) => set({ range: x || undefined })} />`)}</div>` : null}
    ${kind === 'form' ? html`<div class="rb-act-row">
      ${v(html`${lab('Gestalten')}<${Chips} options=${['Tier', 'Elementar', 'Pflanze', 'Monstrosität', 'Feenwesen'].map((t) => ({ value: t, label: t }))} value=${toArr(f.types).length ? toArr(f.types) : ['Tier']} onChange=${(x) => set({ types: x.length ? x : undefined })} />`)}</div>
      <div class="rb-act-row">${v(html`${lab('bis HG')}<${ValIn} value=${f.cr ?? 1} dice=${false} onChange=${(x) => set({ cr: x, crDiv: undefined })} />${lab('oder Stufe ÷')}<${NumIn} value=${f.crDiv} min=${1} max=${6} placeholder="–" onChange=${(x) => set({ crDiv: x || undefined })} />`)}
      ${v(html`${lab('Fliegen ab Stufe')}<${NumIn} value=${f.flyAt} min=${1} max=${20} placeholder="immer" onChange=${(x) => set({ flyAt: x || undefined })} />${lab('Schwimmen ab')}<${NumIn} value=${f.swimAt} min=${1} max=${20} placeholder="immer" onChange=${(x) => set({ swimAt: x || undefined })} />`)}
      ${v(html`<${Select} value=${f.mode || 'replace'} options=${[{ value: 'replace', label: 'TP der Gestalt (Regeln 2014)' }, { value: 'temp', label: 'eigene TP + temporäre TP (Regeln 2024)' }]} onChange=${(x) => set({ mode: x === 'replace' ? undefined : x })} />${f.mode === 'temp' ? html`${lab('temp. TP')}<${ValIn} value=${f.temp ?? 'level'} dice=${false} level onChange=${(x) => set({ temp: x })} />` : null}`)}</div>` : null}
    ${kind === 'restore' ? html`<div class="rb-act-row">
      ${v(html`<${Select} value=${f.what || 'slot'} options=${[{ value: 'slot', label: 'einen Zauberplatz' }, { value: 'res', label: 'Nutzungen einer Ressource' }]} onChange=${(x) => set({ what: x })} />`)}
      ${f.what === 'res' ? v(html`<${TextIn} value=${f.res || ''} placeholder="z. B. Ki-Punkte" list="rb-resnames" onChange=${(x) => set({ res: x })} />${lab('+')}<${NumIn} value=${f.n} min=${1} placeholder="1" onChange=${(x) => set({ n: x || undefined })} />`)
        : v(html`${lab('bis Grad')}<${NumIn} value=${f.lvMax} min=${1} max=${9} placeholder="9" onChange=${(x) => set({ lvMax: x || undefined })} />`)}</div>` : null}
    ${riders ? html`<div class="rb-act-row">
      ${v(html`${lab(kind === 'save' ? 'bei Misserfolg Zustand' : 'bei Treffer Zustand')}<${Select} value=${f.inflict || ''} options=${condRefOpts()} onChange=${(x) => set({ inflict: x || undefined })} />`)}
      ${f.inflict && kind !== 'save' ? v(html`<${Select} value=${f.condSaveAb || ''} options=${SAVE_OPTS} onChange=${(x) => set({ condSaveAb: x || undefined })} />`) : null}
      ${f.inflict ? v(html`${lab('Runden')}<${NumIn} value=${f.condDur} min=${0} placeholder="–" onChange=${(x) => set({ condDur: x || undefined })} /><${Check} checked=${f.condSave === 'end'} label="neuer Wurf am Zugende" onChange=${(x) => set({ condSave: x ? 'end' : undefined })} />`) : null}
      ${v(html`${lab('Stoß')}<${MIn} value=${f.push} onChange=${(x) => set({ push: x || undefined })} />`)}
      ${v(html`${lab('Rückschlag')}<${TextIn} cls="rb-dice" value=${f.selfDmg || ''} placeholder="–" onChange=${(x) => set({ selfDmg: x.replace(/[Ww]/g, 'd') || undefined })} />`)}
      ${v(html`${lab('du heilst')}<${TextIn} cls="rb-dice" value=${f.selfHeal || ''} placeholder="–" onChange=${(x) => set({ selfHeal: x.replace(/[Ww]/g, 'd') || undefined })} />`)}</div>` : null}
    <div class="rb-act-row">
      ${['attack', 'save', 'heal', 'temp', 'mark'].includes(kind) && kind !== 'summon' ? v(html`${lab('Reichweite')}<${MIn} value=${f.range} placeholder=${kind === 'save' && f.area?.shape ? 'selbst' : '1,5'} onChange=${(x) => set({ range: x || undefined })} /><${Info} text=${INFO.actRange} />`) : null}
      ${['attack', 'weapon', 'save'].includes(kind) ? v(html`${lab('Ziele')}<${NumIn} value=${f.n} min=${1} max=${10} placeholder="1" onChange=${(x) => set({ n: x || undefined })} />`) : null}
      ${kind === 'attack' ? v(html`${lab('fester Angriffsbonus')}<${NumIn} value=${f.atkFixed} placeholder="–" onChange=${(x) => set({ atkFixed: x || undefined })} />`) : null}
      ${kind === 'save' || kind === 'weapon' || (riders && f.inflict) ? v(html`${lab('fester SG')}<${NumIn} value=${f.dcFixed} min=${5} max=${30} placeholder="8+ÜB+Mod." onChange=${(x) => set({ dcFixed: x || undefined })} />`) : null}</div>
    <div class="rb-act-row">
      ${v(html`${lab('Nutzung')}<${Select} value=${f.pool ? 'pool' : f.charge ? 'charge' : f.uses || 'will'} options=${[...ACT_USES, { value: 'pool', label: 'kostet Punkte einer Ressource' }, { value: 'charge', label: 'kostet Ladungen des Gegenstands' }]} onChange=${(x) => set(x === 'pool' ? { pool: f.pool || 'Ki-Punkte', uses: undefined, charge: undefined } : x === 'charge' ? { charge: 1, pool: undefined, uses: undefined } : { uses: x, pool: undefined, charge: undefined })} /><${Info} text=${INFO.actUses} />`)}
      ${f.pool ? v(html`<${TextIn} value=${f.pool} list="rb-resnames" onChange=${(x) => set({ pool: x })} />${lab('Kosten')}<${NumIn} value=${f.poolCost} min=${1} placeholder="1" onChange=${(x) => set({ poolCost: x || undefined })} />`) : null}
      ${f.charge ? v(html`${lab('Ladungen')}<${NumIn} value=${f.charge} min=${1} onChange=${(x) => set({ charge: x || 1 })} />`) : null}
      ${f.uses && f.uses !== 'will' && !f.pool && !f.charge ? v(html`${lab('pro')}<${Select} value=${f.rest || 'long'} options=${RESTS} onChange=${(x) => set({ rest: x })} />`) : null}</div>
    ${dmgKinds ? html`<div class="rb-act-row">${v(html`${lab('Stärker ab Stufe 5 / 11 / 17')}${[5, 11, 17].map((l) => html`<${TextIn} key=${l} cls="rb-dice" value=${up[l] || ''} placeholder=${l === 5 ? '3d6' : l === 11 ? '4d6' : '5d6'} onChange=${(x) => set({ up: { ...up, [l]: x.replace(/[Ww]/g, 'd') || undefined } })} />`)}<${Info} text=${INFO.actUp} />`)}</div>` : null}
    <div class="rb-act-row rb-act-full">${v(html`<${TextIn} value=${f.desc || ''} placeholder="Kurzbeschreibung für den Kampf (optional)" onChange=${(x) => set({ desc: x || undefined })} />`)}</div>
  </div>`;
}
// Ziele einer Auswahl („+ Übung im Rettungswurf“, „+ alle Fertigkeiten des Attributs“)
function pickInto(f, what, on) {
  const cur = new Set(toArr(f.into).length ? toArr(f.into) : ['abil']);
  if (on) cur.add(what); else cur.delete(what);
  const list = [...cur];
  return list.length === 1 && list[0] === 'abil' ? undefined : list;
}
// Eigene Optionen einer Auswahl: { key, name, desc, fx }
function OptionsEditor({ value, onChange }) {
  const list = toArr(value);
  const [open, setOpen] = useState(-1);
  const upd = (i, p) => { const n = list.map((x) => ({ ...x })); Object.assign(n[i], p); for (const k of Object.keys(n[i])) if (n[i][k] === undefined) delete n[i][k]; onChange(n); };
  return html`<div class="rb-objlist">
    ${list.map((o, i) => html`<div class=${`rb-obj${open === i ? ' open' : ''}`} key=${i}>
      <div class="rb-obj-head" onClick=${() => setOpen(open === i ? -1 : i)}>
        <${Icon} name=${open === i ? 'chevron-down' : 'chevron-right'} size=${14} /><b class="grow">${o.name || '(ohne Namen)'}</b>${o.fx?.length ? html`<span class="small muted">${o.fx.length} Wirkung${o.fx.length > 1 ? 'en' : ''}</span>` : null}
        <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${(e) => { e.stopPropagation(); onChange(list.filter((_, k) => k !== i)); }} />
      </div>
      ${open === i ? html`<div class="rb-obj-body stack sm">
        <${TextIn} value=${o.name} placeholder="Name, z. B. Präzisionsangriff" onChange=${(x) => upd(i, { name: x, key: !o.key || o.key === slugify(o.name || '') ? slugify(x) : o.key })} />
        <${FxArea} rows=${2} value=${o.desc} name=${o.name} placeholder="Regeltext der Option" onChange=${(x) => upd(i, { desc: x || undefined })} />
        <${FxEditor} value=${o.fx} onChange=${(x) => upd(i, { fx: x.length ? x : undefined })} />
      </div>` : null}
    </div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => { onChange([...list, { key: '', name: '' }]); setOpen(list.length); }}>Option hinzufügen<//>
  </div>`;
}
function FxEditor({ value, onChange, lvlLabel = 'ab Stufe' }) {
  const list = toArr(value);
  const spells = useSpells('2024');
  const upd = (i, patch) => {
    const n = list.map((x) => ({ ...x }));
    Object.assign(n[i], patch);
    for (const k of Object.keys(n[i])) if (n[i][k] === undefined) delete n[i][k];
    onChange(n);
  };
  const addMenu = (e) => {
    const items = [];
    let g = '';
    for (const t of FX_TYPES) {
      if (t.group !== g) { g = t.group; items.push({ header: true, label: g }); }
      items.push({ label: t.label, onClick: () => onChange([...list, { t: t.t, ...structuredClone(FX_NEW[t.t] || {}) }]) });
    }
    openMenu(e, items);
  };
  return html`<div class="rb-fxlist">
    ${list.map((f, i) => html`<div class="rb-fxrow" key=${i}>
      <div class="rb-fxhead">
        <b>${FX_BY[f.t]?.label || f.t}</b>
        <span class="grow small muted ellipsis">${fxLabel(f, fxNames)}</span>
        <label class="rb-fxlvl" title="Gilt erst ab dieser Stufe">${lvlLabel}<input class="input" type="number" min="0" max="20" value=${f.lvl || ''} placeholder="1" onInput=${(e) => upd(i, { lvl: Number(e.target.value) || undefined })} /></label>
        <${Select} value=${f.cond || ''} options=${condOpts()} onChange=${(x) => upd(i, { cond: x || undefined })} />
        <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => onChange(list.filter((_, k) => k !== i))} />
      </div>
      <div class="rb-fxbody"><${FxParams} f=${f} spells=${spells} set=${(p) => upd(i, p)} /></div>
    </div>`)}
    <div class="row" style="gap:6px"><${Btn} size="sm" icon="plus" onClick=${addMenu}>Wirkung hinzufügen<//>${list.length ? null : html`<span class="small faint">z. B. Flugbewegung, Resistenz, Zusatzschaden, „Bei Treffer“, Zauber aus Gegenständen, Auswahl für Spieler, eigene Aktionen</span>`}</div>
  </div>`;
}

// Ressourcen einer Klasse: { name, max, reset, from, info }
function ResourcesEditor({ value, onChange }) {
  const list = toArr(value);
  const upd = (i, p) => { const n = list.map((x) => ({ ...x })); Object.assign(n[i], p); onChange(n); };
  return html`<div class="stack sm">
    ${list.map((r, i) => {
      const mode = Array.isArray(r.max) ? 'table' : typeof r.max === 'number' || r.max == null ? 'num' : r.max;
      return html`<div class="rb-pair" key=${i}><div class="grow stack sm">
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <${TextIn} value=${r.name} placeholder="Name, z. B. Kampfrausch" onChange=${(x) => upd(i, { name: x })} />
          <${Select} value=${mode} options=${[{ value: 'num', label: 'feste Zahl' }, { value: 'table', label: 'je Stufe' }, ...RES_V.slice(1)]} onChange=${(x) => upd(i, { max: x === 'num' ? 1 : x === 'table' ? Array(20).fill(1) : x })} />
          ${mode === 'num' ? html`<${NumIn} value=${r.max} min=${1} onChange=${(x) => upd(i, { max: x || 1 })} />` : null}
          <span class="small muted">frischt auf nach</span><${Select} value=${r.reset || 'long'} options=${RESTS} onChange=${(x) => upd(i, { reset: x })} />
          <span class="small muted">ab Stufe</span><${NumIn} value=${r.from} min=${1} max=${20} placeholder="1" onChange=${(x) => upd(i, { from: x })} />
        </div>
        ${mode === 'table' ? html`<${LevelRow} value=${r.max} onChange=${(x) => upd(i, { max: x })} />` : null}
        <${TextIn} value=${r.info} placeholder="Kurzerklärung (erscheint beim Antippen im Bogen)" onChange=${(x) => upd(i, { info: x })} />
      </div><${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => onChange(list.filter((_, k) => k !== i))} /></div>`;
    })}
    <${Btn} size="sm" icon="plus" onClick=${() => onChange([...list, { name: '', max: 2, reset: 'long' }])}>Ressource hinzufügen<//>
  </div>`;
}
// Eigene Tabellenspalten: { name, values[20] }
function ColumnsEditor({ value, onChange }) {
  const list = toArr(value);
  const upd = (i, p) => { const n = list.map((x) => ({ ...x })); Object.assign(n[i], p); onChange(n); };
  return html`<div class="stack sm">
    ${list.map((c, i) => html`<div class="rb-pair" key=${i}><div class="grow stack sm">
      <${TextIn} value=${c.name} placeholder="Spaltenname, z. B. Wutschaden" onChange=${(x) => upd(i, { name: x })} />
      <${LevelRow} text value=${c.values} onChange=${(x) => upd(i, { values: x })} presets=${[['+2 → +4 (Wutschaden)', ['+2', '+2', '+2', '+2', '+2', '+2', '+2', '+2', '+3', '+3', '+3', '+3', '+3', '+3', '+3', '+4', '+4', '+4', '+4', '+4']], ['W6 → W12', ['W6', 'W6', 'W6', 'W6', 'W8', 'W8', 'W8', 'W8', 'W8', 'W8', 'W10', 'W10', 'W10', 'W10', 'W10', 'W10', 'W12', 'W12', 'W12', 'W12']], ['1W6 je 2 Stufen', Array.from({ length: 20 }, (_, k) => `${Math.ceil((k + 1) / 2)}W6`)]]} />
    </div><${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => onChange(list.filter((_, k) => k !== i))} /></div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => onChange([...list, { name: '', values: Array(20).fill('') }])}>Spalte hinzufügen<//>
  </div>`;
}
// Stufe → Liste von Namen (Unterklassen-Zauber, Expertise)
function LevelNames({ value, onChange, placeholder = 'Zauber, durch Komma getrennt' }) {
  const rows = Object.entries(value || {}).map(([l, v]) => [Number(l), toArr(v)]).sort((a, b) => a[0] - b[0]);
  const write = (r) => { const o = {}; for (const [l, v] of r) if (l && v.length) o[l] = v; onChange(Object.keys(o).length ? o : undefined); };
  return html`<div class="stack sm">
    ${rows.map(([l, v], i) => html`<div class="row nowrap" key=${i} style="gap:6px">
      <label class="rb-lvl"><span>Stufe</span><input class="input" type="number" min="1" max="20" value=${l} onInput=${(e) => { rows[i][0] = Number(e.target.value) || 1; write(rows); }} /></label>
      <input class="input grow" list="rb-spellnames" value=${v.join(', ')} placeholder=${placeholder} onInput=${(e) => { rows[i][1] = e.target.value.split(/\s*,\s*/).filter(Boolean); write(rows); }} />
      <${IconBtn} icon="trash" size=${14} onClick=${() => write(rows.filter((_, k) => k !== i))} /></div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => write([...rows, [rows.length ? Math.min(20, rows[rows.length - 1][0] + 2) : 3, ['']]])}>Stufe hinzufügen<//>
  </div>`;
}

// ───────────────────────── Formulare ─────────────────────────
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
    case 'textarea': input = f.fx ? html`<${FxArea} rows=${f.rows || 4} value=${val} name=${obj.name || ''} placeholder=${f.placeholder} onChange=${set} />` : html`<${Area} rows=${f.rows || 4} value=${val} placeholder=${f.placeholder} onChange=${set} />`; break;
    case 'equip': input = html`<${EquipArea} value=${val} onChange=${set} />`; break;
    case 'number': input = html`<${NumIn} value=${val} min=${f.min} max=${f.max} step=${f.step} placeholder=${f.placeholder} onChange=${set} />`; break;
    case 'dist': input = html`<${DistIn} value=${val} onChange=${set} />`; break;
    case 'select': input = html`<${Select} value=${val ?? ''} options=${opts} onChange=${(v) => set(v === '' ? undefined : f.num ? Number(v) : v)} />`; break;
    case 'chips': input = html`<${Chips} options=${opts} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'abilities': input = html`<${Chips} options=${AB_OPTS} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'skills': input = html`<${Chips} options=${SKILL_OPTS} value=${val} max=${f.max} onChange=${set} />`; break;
    case 'damage': input = html`<${Chips} options=${DMG} value=${val} onChange=${set} />`; break;
    case 'abmap': input = html`<${AbMap} value=${val} onChange=${set} />`; break;
    case 'pairs': input = html`<${PairList} value=${val} onChange=${set} addLabel=${f.add} />`; break;
    case 'bool': input = html`<${Toggle} checked=${!!val} onChange=${(v) => set(v || undefined)} label=${f.toggle || ''} />`; break;
    case 'levels': input = html`<${LevelRow} value=${val} presets=${f.presets || []} onChange=${set} />`; break;
    case 'fx': input = html`<${FxEditor} value=${val} onChange=${set} lvlLabel=${f.lvlLabel || 'ab Stufe'} />`; break;
    case 'custom': input = f.render(obj, ctx, set); break;
    default: input = html`<${TextIn} value=${val} placeholder=${f.placeholder} list=${f.list} mono=${f.mono} onChange=${set} />`;
  }
  const sug = f.suggest ? SUG[f.suggest]?.(obj, ctx) : null;
  const label = f.fx || f.type === 'pairs' ? html`<span class="rb-lab">${f.label}${f.info ? html`<${Info} text=${f.info} />` : null}<${Info} wide><${FxHelp} /><//></span>` : Lab(f.label, f.info);
  return html`<${Field} label=${label} hint=${f.hint} class=${f.wide ? 'rb-wide' : ''}>${input}${sug ? html`<${Suggest} items=${sug} value=${val} onPick=${set} />` : null}<//>`;
}
function Form({ fields, obj, ctx }) {
  return html`<div class="rb-form">${fields.map((f) => html`<${FieldView} key=${f.k || f.label} f=${f} obj=${obj} ctx=${ctx} />`)}</div>`;
}
function Section({ title, icon, info, children, open = true }) {
  return html`<details class="rb-sec" open=${open}><summary><${Icon} name=${icon || 'chevron-right'} size=${15} /><b>${title}</b>${info ? html`<${Info} text=${info} />` : null}</summary><div class="rb-sec-body">${children}</div></details>`;
}

// ───────────────────────── Feldbeschreibungen je Kategorie ─────────────────────────
const edField = { k: 'ed', label: 'Regelstand', type: 'select', info: INFO.ed, options: ED_OPTS };
const nameField = (info, keyProp = 'key') => ({
  k: 'name', label: 'Name', info,
  set: (o, v) => {
    const auto = !o[keyProp] || o[keyProp] === slugify(o.name || '');
    o.name = v;
    if (auto) o[keyProp] = slugify(v);
  },
});
const keyField = { k: 'key', label: 'Kennung', mono: true, info: INFO.key };
const sizeField = { k: 'size', label: 'Größe', info: INFO.size, type: 'custom', render: (o, c, set) => {
  const cur = String(o.size || 'Mittelgroß').split(/\s+oder\s+/).filter(Boolean);
  return html`<${Chips} options=${SIZE_LIST.map((s) => ({ value: s, label: s }))} value=${cur} onChange=${(v) => set(SIZE_LIST.filter((s) => v.includes(s)).reverse().join(' oder ') || 'Mittelgroß')} />`;
} };
const speedsField = { k: 'speeds', label: 'Weitere Bewegungsarten', info: INFO.speeds, type: 'custom', wide: true, render: (o, c, set) => html`<div class="rb-speeds">${Object.entries(MOVE_DE).map(([k, l]) => {
  const v = o.speeds?.[k];
  const put = (x) => { const s = { ...(o.speeds || {}) }; if (x == null || x === 0) delete s[k]; else s[k] = x; set(Object.keys(s).length ? s : undefined); };
  return html`<label key=${k}><span>${l}</span><div class="row nowrap" style="gap:6px">${v === 'walk' ? html`<span class="small">= Bewegung</span>` : html`<${DistIn} value=${v} onChange=${put} />`}<${Check} checked=${v === 'walk'} label="= Bew." onChange=${(x) => put(x ? 'walk' : undefined)} /></div></label>`;
})}</div>` };
const sensesField = { k: 'senses', label: 'Besondere Sinne', info: INFO.senses, type: 'custom', wide: true, render: (o, c, set) => html`<div class="rb-speeds">${['blind', 'tremor', 'true'].map((k) => {
  const put = (x) => { const s = { ...(o.senses || {}) }; if (!x) delete s[k]; else s[k] = x; set(Object.keys(s).length ? s : undefined); };
  return html`<label key=${k}><span>${SENSE_DE[k]}</span><${DistIn} value=${o.senses?.[k]} onChange=${put} /></label>`;
})}</div>` };
const langsField = { k: 'langs', label: 'Sprachen', info: INFO.langs, type: 'custom', wide: true, render: (o, c, set) => html`<div class="stack sm">
  <${Chips} options=${[...new Set([...CG.LANGUAGES, ...toArr(o.langs)])].map((l) => ({ value: l, label: l }))} value=${o.langs} onChange=${set} />
  <div class="row" style="gap:6px"><input class="input" style="max-width:220px" placeholder="+ eigene Sprache (Eingabe)" onKeyDown=${(e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); set([...new Set([...toArr(o.langs), e.target.value.trim()])]); e.target.value = ''; } }} />
    <span class="small muted">frei wählbar</span><${NumIn} value=${o.langAny} min=${0} max=${5} placeholder="0" onChange=${(v) => { if (v) o.langAny = v; else delete o.langAny; c.touch(); }} /></div>
</div>` };
const skillChoiceField = { k: 'skillChoice', label: 'Fertigkeit aus einer Liste', info: INFO.skillChoice, type: 'custom', wide: true, render: (o, c, set) => html`<div class="stack sm">
  <div class="row" style="gap:6px"><${TextIn} value=${o.skillChoice?.label} placeholder="Bezeichnung, z. B. Scharfe Sinne" onChange=${(v) => set(v || o.skillChoice?.list?.length ? { n: 1, list: [], ...(o.skillChoice || {}), label: v } : undefined)} /></div>
  <${Chips} options=${SKILL_OPTS} value=${o.skillChoice?.list} onChange=${(v) => set(v.length ? { n: 1, label: o.skillChoice?.label || 'Auswahl', ...(o.skillChoice || {}), list: v } : undefined)} />
</div>` };
const fxField = (info = INFO.fx, lvlLabel) => ({ k: 'fx', label: 'Weitere Wirkungen', type: 'fx', wide: true, info, lvlLabel });

const SUB_FIELDS = [
  nameField(), { k: 'asi', label: 'Attributsboni', type: 'abmap', info: INFO.asi }, { k: 'speed', label: 'Bewegungsrate (abweichend)', type: 'dist', info: INFO.speed, suggest: 'speed' },
  { k: 'dark', label: 'Dunkelsicht (abweichend)', type: 'dist', info: INFO.dark, suggest: 'dark' },
  { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0, info: INFO.hpPerLevel, suggest: 'hpPerLevel' }, { k: 'resist', label: 'Resistenzen', type: 'damage', info: INFO.resist },
  { k: 'skills', label: 'Feste Fertigkeiten', type: 'skills', info: INFO.skills }, { k: 'skillAny', label: 'Frei wählbare Fertigkeiten', type: 'number', min: 0, max: 4, info: INFO.skillAny, suggest: 'skillAny' },
  speedsField, sensesField, langsField,
  { k: 'traits', label: 'Merkmale', type: 'pairs', wide: true, info: INFO.traits }, fxField(),
];
const OPTION_FIELDS = [
  nameField(), { k: 'note', label: 'Kurzbeschreibung', type: 'textarea', fx: true, rows: 2, wide: true, info: 'Erscheint bei der Auswahl. Erkannte Formulierungen wirken, z. B. „Dunkelsicht 36 m“ oder „Resistenz gegen Feuerschaden“.' },
  { k: 'resist', label: 'Resistenzen', type: 'damage', info: INFO.resist }, { k: 'dark', label: 'Dunkelsicht (abweichend)', type: 'dist', info: INFO.dark, suggest: 'dark' },
  { k: 'speed', label: 'Bewegungsrate (abweichend)', type: 'dist', info: INFO.speed, suggest: 'speed' }, speedsField, fxField(),
];

const FIELDS = {
  species: [
    nameField('So erscheint die Spezies im Charakter-Assistenten.'), keyField, edField,
    { k: 'type', label: 'Kreaturentyp', type: 'select', info: INFO.type, options: [{ value: '', label: 'Humanoide (Standard)' }, ...CREATURE_TYPES.slice(1).map((t) => ({ value: t, label: t }))] },
    sizeField,
    { k: 'speed', label: 'Bewegungsrate', type: 'dist', info: INFO.speed, suggest: 'speed' },
    { k: 'dark', label: 'Dunkelsicht', type: 'dist', info: INFO.dark, suggest: 'dark' },
    speedsField, sensesField,
    { k: 'asi', label: 'Attributsboni (Regeln 2014)', type: 'abmap', info: INFO.asi, show: (o, c) => has14(o, c.pack) },
    { k: 'asiChoice', label: 'Frei verteilbare Boni (Regeln 2014)', type: 'custom', info: INFO.asiChoice, show: (o, c) => has14(o, c.pack), render: (o, c, set) => html`<div class="row" style="gap:8px">
      <${NumIn} value=${o.asiChoice?.n} min=${0} max=${6} placeholder="Anzahl" onChange=${(n) => set(n ? { ...(o.asiChoice || { amount: 1 }), n } : undefined)} />
      <span class="small muted">Attribute um je</span>
      <${NumIn} value=${o.asiChoice?.amount} min=${1} max=${2} placeholder="1" onChange=${(a) => set(o.asiChoice ? { ...o.asiChoice, amount: a || 1 } : undefined)} />
    </div>` },
    { k: 'skills', label: 'Feste Fertigkeiten', type: 'skills', info: INFO.skills },
    { k: 'skillAny', label: 'Frei wählbare Fertigkeiten', type: 'number', min: 0, max: 4, info: INFO.skillAny, suggest: 'skillAny' },
    skillChoiceField, langsField,
    { k: 'resist', label: 'Resistenzen', type: 'damage', info: INFO.resist },
    { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0, info: INFO.hpPerLevel, suggest: 'hpPerLevel' },
    { k: 'luck', label: 'Glück', type: 'bool', toggle: 'Natürliche 1 bei W20-Würfen neu würfeln', info: INFO.luck },
    { k: 'originFeat', label: 'Herkunftstalent', type: 'bool', toggle: 'Erhält ein zusätzliches Herkunftstalent', info: INFO.originFeat, show: (o, c) => has24(o, c.pack) },
    { k: 'feat', label: 'Talent auf Stufe 1', type: 'bool', toggle: 'Erhält auf Stufe 1 ein Talent', info: INFO.feat, show: (o, c) => has14(o, c.pack) },
    { k: 'traits', label: 'Merkmale', type: 'pairs', wide: true, add: 'Merkmal hinzufügen', info: INFO.traits },
    fxField(),
    { k: 'option', label: 'Auswahl (z. B. Abstammung, Erbe, Ahnen)', info: INFO.option, type: 'custom', wide: true, render: (o, c) => html`<div class="stack sm">
      <${TextIn} value=${o.option?.label} placeholder="Bezeichnung der Auswahl, z. B. „Abstammung“" onChange=${(v) => { o.option = { ...(o.option || { list: [] }), label: v }; if (!v && !o.option.list.length) delete o.option; c.touch(); }} />
      <${ObjList} value=${o.option?.list} ctx=${c} fields=${OPTION_FIELDS} addLabel="Möglichkeit hinzufügen" titleOf=${(x) => x.name}
        make=${() => ({ key: '', name: '' })} onChange=${(list) => { o.option = { label: o.option?.label || 'Auswahl', list }; if (!list.length && !o.option.label) delete o.option; c.touch(); }} />
    </div>` },
    { k: 'subs', label: 'Unterarten (Regeln 2014)', info: INFO.subs, type: 'custom', wide: true, show: (o, c) => has14(o, c.pack), render: (o, c, set) => html`<${ObjList} value=${o.subs} ctx=${c} fields=${SUB_FIELDS}
      addLabel="Unterart hinzufügen" titleOf=${(x) => x.name} make=${() => ({ key: '', name: '', traits: [] })} onChange=${(list) => set(list.length ? list : undefined)} />` },
  ],
  subspecies: [
    { k: 'species', label: 'Gehört zur Spezies', type: 'select', info: 'Die Spezies, die diese Unterart ergänzt – auch eine aus dem Grundbestand.', options: (o, c) => [{ value: '', label: '– wählen –' }, ...c.speciesOpts] },
    edField, ...SUB_FIELDS,
  ],
  backgrounds: [
    nameField(), keyField, edField,
    { k: 'abilities', label: 'Attributswerte zur Auswahl (Regeln 2024)', type: 'abilities', max: 3, info: INFO.abilities, show: (o, c) => has24(o, c.pack) },
    { k: 'feat', label: 'Talent des Hintergrunds', type: 'select', info: INFO.bgFeat, options: (o, c) => [{ value: '', label: '– keines –' }, ...c.featOpts(has24(o, c.pack) ? 'origin' : null)] },
    { k: 'featChoice', label: 'Oder: Talent zur Wahl aus', type: 'chips', wide: true, info: INFO.bgFeatChoice, options: (o, c) => c.featOpts(null) },
    { k: 'skills', label: 'Fertigkeiten', type: 'skills', max: 4, info: INFO.skills },
    { k: 'skillAny', label: 'Frei wählbare Fertigkeiten', type: 'number', min: 0, max: 4, info: INFO.skillAny, suggest: 'skillAny' },
    { k: 'tool', label: 'Werkzeug', placeholder: 'z. B. Diebeswerkzeug', info: INFO.tool },
    { k: 'languages', label: 'Zusätzliche Sprachen', type: 'number', min: 0, max: 4, info: INFO.languages, suggest: 'languages', show: (o, c) => has14(o, c.pack) },
    langsField,
    { k: 'feature', label: 'Hintergrundmerkmal (Name)', info: INFO.feature },
    { k: 'featureDesc', label: 'Hintergrundmerkmal (Regeltext)', type: 'textarea', fx: true, rows: 3, wide: true, info: INFO.featureDesc },
    { k: 'desc', label: 'Beschreibung', type: 'textarea', fx: true, wide: true, info: 'Hintergrundgeschichte und Stimmung. Erscheint im Assistenten.' },
    { k: 'equip', label: 'Ausrüstung', type: 'equip', wide: true, info: INFO.equip },
    { k: 'goldAlt', label: 'Stattdessen Gold (Regeln 2024)', type: 'number', min: 0, info: INFO.goldAlt, suggest: 'goldAlt', show: (o, c) => has24(o, c.pack) },
    fxField(),
  ],
  feats: [
    nameField(), keyField, { k: 'cat', label: 'Art', type: 'select', options: FEAT_CATS, info: INFO.featCat }, edField,
    { k: 'desc', label: 'Regeltext', type: 'textarea', fx: true, rows: 6, wide: true, info: 'Der volle Regeltext. Erkannte Formulierungen wirken im Bogen.' },
    { k: 'a24', label: 'Attribut +1 zur Wahl (Regeln 2024)', type: 'abilities', info: INFO.featAsi, show: (o, c) => has24(o, c.pack) },
    { k: 'a14', label: 'Attribut +1 zur Wahl (Regeln 2014)', type: 'abilities', info: INFO.featAsi, show: (o, c) => has14(o, c.pack) },
    { k: 'repeatable', label: 'Mehrfach wählbar', type: 'bool', toggle: 'Darf mehrmals genommen werden', info: INFO.repeatable },
    { k: 'hpPerLevel', label: 'Zusätzliche TP pro Stufe', type: 'number', min: 0, info: INFO.hpPerLevel, suggest: 'hpPerLevel' },
    { k: 'grantSkills', label: 'Fertigkeiten nach Wahl', type: 'number', min: 0, max: 6, info: INFO.grantSkills, suggest: 'grantSkills' },
    { k: 'req', label: 'Voraussetzungen', type: 'custom', wide: true, info: INFO.req, render: (o, c, set) => html`<${ReqEditor} value=${o.req} ctx=${c} onChange=${set} />` },
    { k: 'prereq', label: 'Weitere Voraussetzung (Text)', placeholder: 'z. B. Mitglied einer Gilde', info: INFO.prereq },
    fxField(),
  ],
  subclasses: [
    { k: 'cls', label: 'Klasse', type: 'select', info: 'Zu welcher Klasse die Unterklasse gehört – auch eine eigene Klasse aus diesem Regelwerk.', options: (o, c) => [{ value: '', label: '– wählen –' }, ...c.classOpts] },
    { k: 'name', label: 'Name' }, edField,
    { k: 'desc', label: 'Beschreibung', type: 'textarea', rows: 5, wide: true, info: INFO.subDesc },
    { k: 'caster', label: 'Zauberwirken', type: 'custom', info: INFO.subCaster, render: (o, c) => html`<div class="stack sm">
      <${Toggle} checked=${o.caster === 'third'} label="Wirkt Zauber (Drittelzauberer)" onChange=${(v) => { if (v) { o.caster = 'third'; o.ability = o.ability || 'int'; o.list = o.list || 'magier'; } else { delete o.caster; delete o.ability; delete o.list; } c.touch(); }} />
      ${o.caster === 'third' ? html`<div class="row" style="gap:8px"><span class="small muted">Attribut</span><${Select} value=${o.ability || 'int'} options=${AB_OPTS} onChange=${(v) => { o.ability = v; c.touch(); }} />
        <span class="small muted">Zauberliste</span><${Select} value=${o.list || 'magier'} options=${c.classOpts} onChange=${(v) => { o.list = v; c.touch(); }} /></div>` : null}
    </div>` },
    { k: 'features', label: 'Merkmale je Stufe', type: 'custom', wide: true, info: INFO.subFeatures, render: (o, c) => html`<${SubFeatures} obj=${o} ctx=${c} />` },
    { k: 'spells', label: 'Immer vorbereitete Zauber', type: 'custom', wide: true, info: INFO.subSpells, render: (o, c, set) => html`<${LevelNames} value=${o.spells} onChange=${set} />` },
  ],
  weapons: [
    nameField(), keyField, { k: 'cat', label: 'Kategorie', type: 'select', info: INFO.weaponCat, options: [{ value: 'simple', label: 'Einfache Waffe' }, { value: 'martial', label: 'Kriegswaffe' }] },
    { k: 'dmg', label: 'Schaden', placeholder: '1d8', mono: true, info: INFO.dmg }, { k: 'vers', label: 'Zweihändig (vielseitig)', placeholder: '1d10', mono: true, info: INFO.dmg },
    { k: 'type', label: 'Schadensart', type: 'select', options: WEAPON_TYPES },
    { k: 'p', label: 'Eigenschaften', type: 'custom', wide: true, info: 'Finesse: STÄ oder GES · leicht: für den Kampf mit zwei Waffen · schwer: Nachteil für Kleine · Reichweite: 3 m statt 1,5 m · Wurfwaffe/Munition: Fernkampf mit Reichweite · Laden: ein Schuss pro Aktion.', render: (o, c) => html`<div class="rb-chips">${PROPS.map(([p, l]) => html`<button type="button" key=${p} class=${`rb-chip${(o.p || '').includes(p) ? ' on' : ''}`}
      onClick=${() => { o.p = (o.p || '').includes(p) ? o.p.replace(p, '') : `${o.p || ''}${p}`; c.touch(); }}>${l}</button>`)}</div>` },
    { k: 'range', label: 'Reichweite (normal / weit)', type: 'custom', info: INFO.range, show: (o) => /[at]/.test(o.p || ''), render: (o, c, set) => html`<div class="row nowrap" style="gap:6px">
      <${NumIn} value=${o.range?.[0]} min=${1.5} step=${1.5} onChange=${(v) => set(v ? [v, o.range?.[1] || v * 4] : undefined)} /><span>/</span><${NumIn} value=${o.range?.[1]} min=${1.5} step=${1.5} onChange=${(v) => set(o.range ? [o.range[0], v || o.range[0] * 4] : undefined)} /><span>m</span></div>` },
    { k: 'm', label: 'Meisterschaft (Regeln 2024)', type: 'select', info: INFO.mastery, options: [{ value: '', label: '– keine –' }, ...MASTERY.map(([n, d]) => ({ value: n, label: n, title: d }))] },
    { k: 'magic', label: 'Magischer Bonus', type: 'number', min: 0, max: 3, info: INFO.magic },
    { k: 'extraDmg', label: 'Zusatzschaden', placeholder: 'z. B. 1d6', mono: true, info: INFO.extraDmg },
    { k: 'extraType', label: 'Art des Zusatzschadens', type: 'select', options: [{ value: '', label: '–' }, ...WEAPON_TYPES.map((t) => ({ value: t, label: t }))] },
    { k: 'ability', label: 'Angriffsattribut (abweichend)', type: 'select', info: INFO.wAbility, options: [{ value: '', label: 'üblich' }, ...AB_OPTS, { value: 'spell', label: 'Zauberattribut' }] },
    { k: 'rarity', label: 'Seltenheit', type: 'select', options: [{ value: '', label: '– nicht magisch –' }, ...CG.RARITIES.map((r) => ({ value: r, label: r }))] },
    { k: 'attune', label: 'Einstimmung', type: 'bool', toggle: 'Erfordert Einstimmung', info: INFO.attune },
    { k: 'attuneBy', label: 'Einstimmung nur durch', type: 'chips', wide: true, info: INFO.attuneBy, show: (o) => !!o.attune, options: (o, c) => [...c.classOpts, ...c.speciesOpts] },
    { k: 'alwaysProf', label: 'Übung', type: 'bool', toggle: 'Träger gilt immer als geübt', info: INFO.alwaysProf },
    { k: 'weight', label: 'Gewicht (kg)', type: 'number', min: 0, step: 0.1, info: INFO.weight }, { k: 'cost', label: 'Preis (GM)', type: 'number', min: 0, info: INFO.cost },
    { k: 'special', label: 'Besonderheit', type: 'textarea', fx: true, rows: 2, wide: true, info: 'Alles, was die Waffe sonst noch kann – erscheint im Detail der Waffe. Erkannte Formulierungen wirken (z. B. „zusätzlich 1W6 Feuerschaden“).' },
    { k: 'charges', label: 'Ladungen', type: 'custom', wide: true, info: INFO.charges, render: (o, c, set) => html`<${ChargesEditor} value=${o.charges} onChange=${set} />` },
    fxField(INFO.itemFx),
  ],
  armor: [
    nameField(), keyField, { k: 'type', label: 'Art', type: 'select', info: INFO.armorType, options: [{ value: 'light', label: 'Leichte Rüstung' }, { value: 'medium', label: 'Mittelschwere Rüstung' }, { value: 'heavy', label: 'Schwere Rüstung' }, { value: 'clothing', label: 'Kleidung' }, { value: 'shield', label: 'Schild' }] },
    { k: 'ac', label: 'Rüstungsklasse', type: 'number', min: 0, max: 25, info: INFO.armorAc, show: (o) => o.type !== 'clothing' },
    { k: 'bonus', label: 'RK-Bonus', type: 'number', min: 0, max: 5, info: 'Zusätzlicher Bonus auf die RK (bei Kleidung der ganze Schutz, sonst z. B. magisch +1).' },
    { k: 'dexCap', label: 'Höchster GES-Bonus', type: 'number', min: 0, max: 10, info: INFO.dexCap, show: (o) => ['light', 'medium', 'heavy'].includes(o.type || 'light') },
    { k: 'str', label: 'Stärke-Voraussetzung', type: 'number', min: 0, max: 20, info: INFO.strReq, show: (o) => o.type !== 'clothing' && o.type !== 'shield' },
    { k: 'stealth', label: 'Heimlichkeit', type: 'bool', toggle: 'Nachteil auf Heimlichkeit' },
    { k: 'rarity', label: 'Seltenheit', type: 'select', options: [{ value: '', label: '– nicht magisch –' }, ...CG.RARITIES.map((r) => ({ value: r, label: r }))] },
    { k: 'attune', label: 'Einstimmung', type: 'bool', toggle: 'Erfordert Einstimmung', info: INFO.attune },
    { k: 'attuneBy', label: 'Einstimmung nur durch', type: 'chips', wide: true, info: INFO.attuneBy, show: (o) => !!o.attune, options: (o, c) => [...c.classOpts, ...c.speciesOpts] },
    { k: 'alwaysProf', label: 'Übung', type: 'bool', toggle: 'Träger gilt immer als geübt', info: INFO.alwaysProf },
    { k: 'weight', label: 'Gewicht (kg)', type: 'number', min: 0, step: 0.1, info: INFO.weight }, { k: 'cost', label: 'Preis (GM)', type: 'number', min: 0, info: INFO.cost },
    { k: 'special', label: 'Besonderheit', type: 'textarea', fx: true, rows: 2, wide: true, info: 'Erkannte Formulierungen wirken, z. B. „Du erleidest 1 weniger Stichschaden“ oder „+1 auf GES-Rettungswürfe“.' },
    { k: 'charges', label: 'Ladungen', type: 'custom', wide: true, info: INFO.charges, render: (o, c, set) => html`<${ChargesEditor} value=${o.charges} onChange=${set} />` },
    fxField(INFO.itemFx),
  ],
  // Gegenstände: Amulette, Ringe, Umhänge, Stiefel, Handschuhe, Kopfbedeckungen, Gürtel, Tränke …
  items: [
    nameField(), keyField,
    { k: 'slot', label: 'Art / Platz', type: 'select', info: INFO.itemSlot, options: Object.entries(CG.ITEM_SLOTS).map(([value, label]) => ({ value, label })) },
    { k: 'rarity', label: 'Seltenheit', type: 'select', options: CG.RARITIES.map((r) => ({ value: r, label: r })) },
    { k: 'attune', label: 'Einstimmung', type: 'bool', toggle: 'Erfordert Einstimmung', info: INFO.attune },
    { k: 'attuneBy', label: 'Einstimmung nur durch', type: 'chips', wide: true, info: INFO.attuneBy, show: (o) => !!o.attune, options: (o, c) => [...c.classOpts, ...c.speciesOpts] },
    { k: 'consumable', label: 'Verbrauch', type: 'bool', toggle: 'Verbraucht sich beim Benutzen (Trank, Öl, Munition)', show: (o) => o.slot !== 'potion' },
    { k: 'weight', label: 'Gewicht (kg)', type: 'number', min: 0, step: 0.05, info: INFO.weight }, { k: 'cost', label: 'Preis (GM)', type: 'number', min: 0, info: INFO.cost },
    { k: 'desc', label: 'Beschreibung', type: 'textarea', fx: true, rows: 4, wide: true, info: 'Regeltext des Gegenstands. Erkannte Formulierungen wirken, z. B. „+1 RK“, „Vorteil bei Rettungswürfen gegen Zauber“, „Stärke wird auf 19 gesetzt“.' },
    { k: 'charges', label: 'Ladungen', type: 'custom', wide: true, info: INFO.charges, render: (o, c, set) => html`<${ChargesEditor} value=${o.charges} onChange=${set} />` },
    fxField(INFO.itemFx),
  ],
  // Eigene Zustände (BG3: Brennend, Blutend, Nass, Schwung …; Daggerheart: Verwundbar, Versteckt …)
  conditions: [
    nameField(INFO.status), keyField,
    { k: 'desc', label: 'Regeltext', type: 'textarea', rows: 3, wide: true, info: 'Erscheint am Token und im Protokoll.' },
    { k: 'rounds', label: 'Standarddauer (Runden)', type: 'number', min: 0, max: 100, info: 'Wie lange der Zustand hält, wenn die Aktion nichts anderes sagt. 0 = bis er endet.' },
    { k: 'stack', label: 'Stapelbar bis', type: 'number', min: 0, max: 20, info: 'Wie oft sich der Zustand stapeln lässt (Zahlenwerte und Schaden pro Zug vervielfachen sich). 0 = nicht stapelbar.' },
    { k: 'dot', label: 'Schaden pro Zug', type: 'custom', wide: true, info: 'Schaden zu Beginn oder Ende jedes Zuges des Betroffenen (je Stapel).', render: (o, c, set) => html`<div class="row" style="gap:6px;flex-wrap:wrap">
      <${TextIn} cls="rb-dice" value=${o.dot?.dice || ''} placeholder="1W4" onChange=${(v) => set(v ? { type: 'fire', at: 'start', ...(o.dot || {}), dice: v.replace(/[Ww]/g, 'd') } : undefined)} />
      <${Select} value=${o.dot?.type || 'fire'} options=${DMG} onChange=${(v) => o.dot && set({ ...o.dot, type: v })} />
      <${Select} value=${o.dot?.at || 'start'} options=${[{ value: 'start', label: 'zu Zugbeginn' }, { value: 'end', label: 'am Zugende' }]} onChange=${(v) => o.dot && set({ ...o.dot, at: v })} /></div>` },
    { k: 'save', label: 'Endet mit Rettungswurf', type: 'custom', wide: true, info: 'Am Ende jedes Zuges darf der Betroffene würfeln – bei Erfolg endet der Zustand.', render: (o, c, set) => html`<div class="row" style="gap:6px">
      <${Select} value=${o.save?.ab || ''} options=${SAVE_OPTS} onChange=${(v) => set(v ? { at: 'end', ...(o.save || {}), ab: v } : undefined)} />
      ${o.save ? html`<span class="small muted">SG</span><${NumIn} value=${o.save.dc} placeholder="wie die Quelle" onChange=${(v) => set({ ...o.save, dc: v || undefined })} />` : null}</div>` },
    { k: 'noHeal', label: 'Heilung', type: 'bool', toggle: 'Kann nicht geheilt werden' },
    { k: 'base', label: 'Zählt als', type: 'custom', wide: true, info: INFO.statusBase, render: (o, c, set) => html`<${Chips} options=${FX_CONDS.map((x) => ({ value: x, label: x }))} value=${toArr(o.base)} onChange=${(v) => set(v.length ? v : undefined)} />` },
    { k: 'fx', label: 'Wirkungen auf den Betroffenen', type: 'fx', wide: true, info: 'Z. B. RK −2, Anfälligkeit gegen Blitz, Nachteil bei Angriffen, Bewegung −3 m, Angriffe gegen ihn im Vorteil.' },
  ],
};
// Ladungen: { max, rest, regain }
function ChargesEditor({ value, onChange }) {
  const c = value || null;
  return html`<div class="row" style="gap:6px;flex-wrap:wrap">
    <${NumIn} value=${c?.max} min=${0} max=${100} placeholder="keine" onChange=${(v) => onChange(v ? { rest: 'dawn', ...(c || {}), max: v } : undefined)} />
    ${c ? html`<span class="small muted">zurück</span><${Select} value=${c.rest || 'dawn'} options=${[{ value: 'dawn', label: 'im Morgengrauen (Würfel)' }, { value: 'long', label: 'alle nach langer Rast' }, { value: 'short', label: 'alle nach kurzer Rast' }, { value: 'never', label: 'nie (verbraucht)' }]} onChange=${(v) => onChange({ ...c, rest: v })} />
      ${c.rest === 'dawn' || !c.rest ? html`<${TextIn} cls="rb-dice" value=${c.regain || ''} placeholder="1W6+1" onChange=${(v) => onChange({ ...c, regain: v.replace(/[Ww]/g, 'd') })} />` : null}` : null}
  </div>`;
}

// Voraussetzungen eines Talents
function ReqEditor({ value, onChange, ctx }) {
  const r = value || {};
  const put = (p) => { const n = { ...r, ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === false || (Array.isArray(n[k]) && !n[k].length) || (k === 'abil' && !Object.keys(n.abil || {}).length)) delete n[k]; onChange(Object.keys(n).length ? n : undefined); };
  return html`<div class="rb-req">
    <label><span>ab Stufe</span><${NumIn} value=${r.level} min=${1} max=${20} placeholder="–" onChange=${(v) => put({ level: v })} /></label>
    <label><span>Mindestwerte</span><div class="rb-abmap">${AB.map((k) => html`<label key=${k}><span>${CG.AB_SHORT[k]}</span><${NumIn} value=${r.abil?.[k]} min=${1} max=${30} placeholder="–"
      onChange=${(n) => { const a = { ...(r.abil || {}) }; if (!n) delete a[k]; else a[k] = n; put({ abil: a }); }} /></label>`)}</div>
      <${Check} checked=${!!r.abilAny} label="einer davon genügt" onChange=${(v) => put({ abilAny: v || undefined })} /></label>
    <label><span>Übung</span><${Select} value=${r.armor || ''} options=${[{ value: '', label: '–' }, { value: 'light', label: 'leichte Rüstung' }, { value: 'medium', label: 'mittelschwere Rüstung' }, { value: 'heavy', label: 'schwere Rüstung' }, { value: 'shield', label: 'Schilde' }]} onChange=${(v) => put({ armor: v || undefined })} /></label>
    <label><span>Zauber</span><${Check} checked=${!!r.spellcasting} label="kann Zauber wirken" onChange=${(v) => put({ spellcasting: v || undefined })} /></label>
    <label class="wide"><span>Nur für Spezies</span><${Chips} options=${ctx.speciesOpts} value=${r.species} onChange=${(v) => put({ species: v })} /></label>
    <label class="wide"><span>Nur für Klassen</span><${Chips} options=${ctx.classOpts} value=${r.classes} onChange=${(v) => put({ classes: v })} /></label>
  </div>`;
}

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
        <${FxArea} rows=${2} value=${x.f.desc} name=${x.f.name} muted=${!!x.f.fx?.length} placeholder="Was das Merkmal bewirkt" onChange=${(v) => { x.f.desc = v; write(flat); }} />
        <details class="rb-subfx" open=${!!x.f.fx?.length}><summary class="small">Wirkungen${x.f.fx?.length ? ` (${x.f.fx.length})` : ''} <${Info} text=${INFO.featFx} /></summary>
          <${FxEditor} value=${x.f.fx} lvlLabel="ab Klassenstufe" onChange=${(v) => { if (v.length) x.f.fx = v; else delete x.f.fx; write(flat); }} /></details></div>
      <${IconBtn} icon="trash" size=${14} title="Entfernen" onClick=${() => write(flat.filter((_, k) => k !== i))} />
    </div>`)}
    <${Btn} size="sm" icon="plus" onClick=${() => write([...flat, { l: subLevels.find((l) => !flat.some((y) => y.l === l)) || subLevels[0] || 3, f: { name: '', desc: '' } }])}>Merkmal hinzufügen<//>
  </div>`;
}

// ───────────────────────── Klassen ─────────────────────────
const FULL_CAST = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
const PRESET_PREP = [['Vollzauberer', [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]], ['Halbzauberer', [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]], ['Paktmagie', [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]], ['Drittelzauberer', [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]]];
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
  const expertise = perEd(obj, 'expertise', ed) || {};
  const F = (f) => html`<${FieldView} f=${f} obj=${obj} ctx=${ctx} />`;
  return html`<div class="stack">
    ${packEd === 'beide' ? html`<div class="row"><span class="small muted">Werte je Regelstand:</span><${Segmented} value=${ed} onChange=${setEd} options=${[{ value: '2024', label: 'Regeln 2024' }, { value: '2014', label: 'Regeln 2014' }]} /></div>` : null}
    <${Section} title="Grundlagen" icon="shield">
      <div class="rb-form">
        ${F(nameField())}${F(keyField)}
        ${F({ k: 'desc', label: 'Kurzbeschreibung', placeholder: 'Erscheint bei der Klassenwahl', wide: true })}
        ${F({ k: 'hd', label: 'Trefferwürfel', type: 'select', num: true, info: INFO.hd, options: [4, 6, 8, 10, 12].map((n) => ({ value: n, label: `W${n}` })) })}
        ${F({ k: 'primary', label: 'Primärattribut', type: 'abilities', max: 2, info: INFO.primary })}
        ${F({ k: 'saves', label: 'Rettungswürfe', type: 'abilities', max: 3, info: INFO.saves })}
        ${F({ k: 'subLabel', label: 'Bezeichnung der Unterklasse', placeholder: 'z. B. Pfad, Schule, Eid', info: INFO.subLabel })}
        <${Field} label=${Lab('Unterklasse ab Stufe', INFO.subLevel)}><${NumIn} value=${perEd(obj, 'subLevel', ed)} min=${1} max=${20} onChange=${(n) => { setPerEd(obj, 'subLevel', ed, n || 3); t(); }} />
          <${Suggest} items=${[{ label: '1', v: 1 }, { label: '2', v: 2 }, { label: '3', v: 3 }]} value=${perEd(obj, 'subLevel', ed)} onPick=${(v) => { setPerEd(obj, 'subLevel', ed, v); t(); }} /><//>
      </div>
    <//>
    <${Section} title="Übungen" icon="check">
      <div class="rb-form">
        <${Field} label=${Lab('Fertigkeiten', INFO.classSkills)} class="rb-wide">
          <div class="stack sm"><div class="row" style="gap:8px"><${NumIn} value=${skills.n} min=${0} max=${6} onChange=${(n) => { obj.skills = { ...skills, n: n || 0 }; t(); }} /><span class="small muted">aus</span></div>
            <${Chips} options=${SKILL_OPTS} value=${skillList === 'any' ? [] : skillList} onChange=${(v) => { const s = { ...skills }; setPerEd(s, 'list', ed, v.length ? v : 'any'); obj.skills = s; t(); }} /></div>
        <//>
        <${Field} label=${Lab('Rüstung', INFO.armor)}><${Chips} options=${[{ value: 'light', label: 'leicht' }, { value: 'medium', label: 'mittelschwer' }, { value: 'heavy', label: 'schwer' }, { value: 'shield', label: 'Schilde' }]} value=${armor}
          onChange=${(v) => { if (Array.isArray(obj.armor) || !obj.armor) obj.armor = v; else setPerEd(obj, 'armor', ed, v); t(); }} /><//>
        <${Field} label=${Lab('Waffen', INFO.weapons)}><div class="stack sm">
          <${Chips} options=${[{ value: 'simple', label: 'einfache' }, { value: 'martial', label: 'Kriegswaffen' }, { value: 'martial-light', label: 'leichte Kriegswaffen' }, { value: 'martial-finesse', label: 'Kriegswaffen mit Finesse' }]} value=${weapons} onChange=${(v) => { setPerEd(obj, 'weapons', ed, [...v, ...weapons.filter((w) => !['simple', 'martial', 'martial-light', 'martial-finesse'].includes(w))]); t(); }} />
          <${Select} value="" options=${[{ value: '', label: '+ einzelne Waffe' }, ...CG.WEAPONS.map((w) => ({ value: w.key, label: w.name }))]} onChange=${(k) => { if (k && !weapons.includes(k)) { setPerEd(obj, 'weapons', ed, [...weapons, k]); t(); } }} />
          ${weapons.filter((w) => !['simple', 'martial', 'martial-light', 'martial-finesse'].includes(w)).length ? html`<div class="rb-chips">${weapons.filter((w) => !['simple', 'martial', 'martial-light', 'martial-finesse'].includes(w)).map((w) => html`<button type="button" class="rb-chip on" key=${w} title="Entfernen"
            onClick=${() => { setPerEd(obj, 'weapons', ed, weapons.filter((x) => x !== w)); t(); }}>${CG.findWeapon?.(w)?.name || w} ×</button>`)}</div>` : null}
        </div><//>
        ${F({ k: 'tools', label: 'Werkzeuge', info: 'Werkzeuge und Instrumente als Text, z. B. „Diebeswerkzeug“ oder „Drei Musikinstrumente“.' })}
        <${Field} label=${Lab('Mehrklassen: Voraussetzung', INFO.mcReq)}><${Chips} options=${AB_OPTS} value=${obj.mc?.req?.[0] || []} onChange=${(v) => { obj.mc = { ...(obj.mc || { gain: '' }), req: v.length ? [v] : [] }; t(); }} /><//>
        <${Field} label=${Lab('Mehrklassen: erhält', INFO.mcGain)}><${TextIn} value=${obj.mc?.gain} placeholder="z. B. leichte Rüstung, einfache Waffen" onChange=${(v) => { obj.mc = { ...(obj.mc || { req: [] }), gain: v }; t(); }} /><//>
      </div>
    <//>
    <${Section} title="Verteidigung & Kampf" icon="swords">
      <div class="rb-form">
        <${Field} label=${Lab('Ungerüstete Verteidigung', INFO.unarmored)}><div class="row nowrap" style="gap:6px">
          <${NumIn} value=${obj.unarmoredBase ?? (obj.unarmored ? 10 : '')} min=${0} max=${20} placeholder="10" onChange=${(v) => { if (v == null) delete obj.unarmoredBase; else obj.unarmoredBase = v; t(); }} /><span class="small muted">+ GES +</span>
          <${Select} value=${obj.unarmored || ''} options=${[{ value: '', label: 'keine' }, ...AB_OPTS.filter((a) => a.value !== 'dex')]} onChange=${(v) => { if (v) obj.unarmored = v; else delete obj.unarmored; t(); }} /></div>
          ${obj.unarmored ? html`<${Check} checked=${!obj.unarmoredNoShield} label="Schild erlaubt" onChange=${(v) => { if (v) delete obj.unarmoredNoShield; else obj.unarmoredNoShield = true; t(); }} />` : null}<//>
        ${F({ k: 'style', label: 'Kampfstil ab Stufe', type: 'number', min: 0, max: 20, info: INFO.style })}
        <${Field} label=${Lab('Expertise', INFO.expertise)} class="rb-wide"><div class="row" style="gap:10px;flex-wrap:wrap">${[1, 2, 3, 6, 9, 10, 14].map((l) => html`<label class="rb-lvl" key=${l}><span>Stufe ${l}</span>
          <input class="input" type="number" min="0" max="6" value=${expertise[l] || ''} placeholder="0" onInput=${(e) => { const x = { ...expertise }; const n = Number(e.target.value) || 0; if (n) x[l] = n; else delete x[l]; setPerEd(obj, 'expertise', ed, x); t(); }} /></label>`)}</div><//>
      </div>
    <//>
    <${Section} title="Ausrüstung" icon="backpack">
      <div class="rb-form">
        <${Field} label=${Lab('Startausrüstung', `${INFO.classEquip} ${INFO.equip}`)} class="rb-wide"><${EquipArea} value=${perEd(obj, 'equip', ed)} onChange=${(v) => { setPerEd(obj, 'equip', ed, v); t(); }} /><//>
        <${Field} label=${Lab('Startgold', INFO.gold)}><${TextIn} value=${perEd(obj, 'gold', ed)} placeholder="z. B. 100 oder 5d4×10" onChange=${(v) => { setPerEd(obj, 'gold', ed, /^\d+$/.test(v) ? Number(v) : v); t(); }} /><//>
      </div>
    <//>
    <${Section} title="Zauberwirken" icon="sparkles" info=${INFO.cast}>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <${Select} value=${cast?.type || 'none'} options=${[{ value: 'none', label: 'Wirkt keine Zauber' }, { value: 'full', label: 'Vollzauberer' }, { value: 'half', label: 'Halbzauberer' }, { value: 'third', label: 'Drittelzauberer' }, { value: 'pact', label: 'Paktmagie' }]}
          onChange=${(v) => { if (v === 'none') delete obj.cast; else obj.cast = { mode: 'prepare', ability: 'int', cantrips: [...FULL_CAST], prep: [...PRESET_PREP[v === 'full' ? 0 : v === 'pact' ? 2 : v === 'third' ? 3 : 1][1]], ...(cast || {}), type: v }; t(); }} />
        ${cast ? html`<span class="small muted">Attribut</span><${Select} value=${cast.ability} options=${AB_OPTS} onChange=${(v) => { cast.ability = v; t(); }} />
          <${Select} value=${cast.mode || 'prepare'} options=${[{ value: 'prepare', label: 'bereitet vor' }, { value: 'known', label: 'kennt feste Zauber' }, { value: 'book', label: 'Zauberbuch' }]} onChange=${(v) => { cast.mode = v; t(); }} /><${Info} text=${INFO.castMode} />
          <${Check} checked=${!!cast.ritual} label="Rituale" onChange=${(v) => { if (v) cast.ritual = true; else delete cast.ritual; t(); }} />` : null}
      </div>
      ${cast ? html`<${Field} label="Zaubertricks je Stufe"><${LevelRow} value=${cast.cantrips} presets=${PRESET_CANTRIPS} onChange=${(v) => { cast.cantrips = v; t(); }} /><//>
        <${Field} label=${cast.mode === 'known' ? 'Bekannte Zauber je Stufe' : 'Vorbereitete Zauber je Stufe'} hint="Die Zauberplätze ergeben sich aus der Art (voll, halb, Drittel, Pakt).">
          <${LevelRow} value=${cast.prep ?? cast.prep24 ?? cast.known14} presets=${PRESET_PREP} onChange=${(v) => { cast.prep = v; delete cast.prep24; delete cast.known14; delete cast.prep14; t(); }} /><//>
        <div class="small muted">Welche Zauber die Klasse nutzen darf, legst du bei den Zaubern fest (Feld „Klassen“) – eigene Klassen stehen dort zur Auswahl. So lassen sich auch Themenlisten („Domänen“) bauen.</div>` : null}
    <//>
    <${Section} title="Ressourcen" icon="zap" info=${INFO.resources}><${ResourcesEditor} value=${obj.resources} onChange=${(v) => { if (v.length) obj.resources = v; else delete obj.resources; t(); }} /><//>
    <${Section} title="Tabellenspalten" icon="list" info=${INFO.columns}><${ColumnsEditor} value=${obj.columns} onChange=${(v) => { if (v.length) obj.columns = v; else delete obj.columns; t(); }} /><//>
    <${Section} title="Wirkungen der Klasse" icon="star" info=${INFO.classFx}><${FxEditor} value=${obj.fx} lvlLabel="ab Klassenstufe" onChange=${(v) => { if (v.length) obj.fx = v; else delete obj.fx; t(); }} /><//>
    <${Section} title="Merkmale je Stufe" icon="list-ordered" info=${INFO.featTable}><${ClassTable} obj=${obj} ed=${ed} ctx=${ctx} table=${table} /><//>
  </div>`;
}

// Tabelle der Klassenmerkmale: je Stufe Merkmale (Name + Text), dazu Attributswerterhöhung, Unterklasse, Epische Gabe
function ClassTable({ obj, ed, ctx, table }) {
  const [editing, setEditing] = useState(null);
  const rows = Array.from({ length: 20 }, (_, i) => toArr(table[i + 1]));
  const write = (lvl, list) => {
    const t = { ...table, [lvl]: list };
    setPerEd(obj, 'feat', ed, t);
    ctx.touch();
  };
  const special = [['@asi', 'Attributswerterhöhung'], ['@sub', 'Unterklasse'], ['@boon', 'Epische Gabe']];
  const featVal = (n) => ctx.pack.features?.[n] ?? CG.FEATURE_INFO[n] ?? '';
  const featDesc = (n) => { const v = featVal(n); return v && typeof v === 'object' ? v.desc || '' : v; };
  const featFx = (n) => { const v = ctx.pack.features?.[n]; return v && typeof v === 'object' ? toArr(v.fx) : CG.FEATURE_FX[n] || []; };
  const setFeat = (n, p) => {
    const cur = { desc: featDesc(n), fx: featFx(n), ...p };
    ctx.pack.features = { ...(ctx.pack.features || {}), [n]: cur.fx.length ? { desc: cur.desc, fx: cur.fx } : cur.desc };
    ctx.touch();
  };
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
              <button type="button" title="Text und Wirkungen bearbeiten" onClick=${() => setEditing(editing === n ? null : n)}>${n}${featDesc(n) ? '' : ' ·'}${featFx(n).length ? ' ⚡' : ''}</button>
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
          ${named.includes(editing) ? html`<div class="rb-featdesc"><b>${editing}</b><${FxArea} rows=${3} value=${featDesc(editing)} name=${editing} muted=${featFx(editing).length > 0} placeholder="Was das Merkmal bewirkt (erscheint im Bogen und beim Stufenaufstieg)"
            onChange=${(v) => setFeat(editing, { desc: v })} />
            <div class="small muted rb-lab">Wirkungen<${Info} text=${INFO.featFx} /></div>
            <${FxEditor} value=${featFx(editing)} lvlLabel="ab Klassenstufe" onChange=${(x) => setFeat(editing, { fx: x })} /></div>` : null}
        </div>
      </div>`;
    })}
    <div class="small muted">Eingabetaste fügt ein Merkmal hinzu; ein Klick auf den Namen öffnet Text und Wirkungen. „·“ = noch ohne Text, „⚡“ = mit Wirkungen.</div>
  </div>`;
}

// ───────────────────────── Zauber ─────────────────────────
const TIMES = [['action', 'Aktion'], ['bonus', 'Bonusaktion'], ['reaction', 'Reaktion'], ['1 Minute', '1 Minute'], ['10 Minuten', '10 Minuten'], ['1 Stunde', '1 Stunde'], ['8 Stunden', '8 Stunden'], ['12 Stunden', '12 Stunden'], ['24 Stunden', '24 Stunden']];
const DURATIONS = ['Unmittelbar', '1 Runde', '1 Minute', '10 Minuten', '1 Stunde', '8 Stunden', '24 Stunden', '7 Tage', '10 Tage', '30 Tage', 'Bis gebannt', 'Bis gebannt oder ausgelöst', 'Speziell'];
function scale(dice, k) {
  const m = /^(\d+)d(\d+)(.*)$/i.exec(String(dice).trim());
  return m ? `${Number(m[1]) * k}d${m[2]}${m[3] || ''}` : dice;
}
function addDice(dice, up, times) {
  const a = /^(\d+)d(\d+)$/i.exec(String(dice).trim());
  const b = /^(\d+)d(\d+)$/i.exec(String(up || '').trim());
  if (!times || !b) return dice;
  if (a && a[2] === b[2]) return `${Number(a[1]) + Number(b[1]) * times}d${a[2]}`;
  return `${dice}+${Number(b[1]) * times}d${b[2]}`;
}
function SpellEditor({ obj, ctx }) {
  const t = ctx.touch;
  const set = (k, v) => { if (v === undefined || v === '' || v === false) delete obj[k]; else obj[k] = v; t(); };
  const fx = obj.fx || {};
  const setFx = (p) => { const n = { ...fx, ...p }; for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === '' || n[k] === false) delete n[k]; if (Object.keys(n).length) obj.fx = n; else delete obj.fx; t(); };
  const dmg = obj.damage || null;
  const baseDice = dmg ? (dmg.slots ? dmg.slots[obj.level] || Object.values(dmg.slots)[0] : dmg.char ? dmg.char[1] || Object.values(dmg.char)[0] : '') : '';
  // Schaden für alle Grade (mit „je höherem Grad“) bzw. Zaubertricks auf Stufe 1/5/11/17
  const setDamage = (dice, type = dmg?.type || 'fire', up = dmg?.up || '') => {
    if (!dice) { delete obj.damage; t(); return; }
    const lv = Number(obj.level) || 0;
    if (lv) {
      const slots = {};
      for (let g = lv; g <= 9; g++) slots[g] = up ? addDice(dice, up, g - lv) : dice;
      obj.damage = { type, slots, ...(up ? { up } : {}) };
    } else obj.damage = { type, char: { 1: dice, 5: scale(dice, 2), 11: scale(dice, 3), 17: scale(dice, 4) } };
    t();
  };
  const heal = obj.heal || null;
  const setHeal = (p) => {
    const h = { ...(heal || { dice: '1d8', mod: true }), ...p };
    const lv = Number(obj.level) || 1;
    if (h.up) { h.slots = {}; for (let g = lv; g <= 9; g++) h.slots[g] = `${addDice(h.dice, h.up, g - lv)}${h.mod ? ' + MOD' : ''}`; } else delete h.slots;
    obj.heal = h;
    t();
  };
  const comps = String(obj.comps || 'V, G').split(/\s*,\s*/).filter(Boolean);
  const kind = obj.attack ? 'attack' : obj.save ? 'save' : obj.heal ? 'heal' : fx.use === 'buff' ? 'buff' : 'none';
  const timeVal = obj.action && obj.action !== 'long' ? obj.action : obj.time || 'action';
  return html`<div class="stack">
    <${Section} title="Grunddaten" icon="sparkles">
      <div class="rb-form">
        <${FieldView} f=${nameField(null, 'id')} obj=${obj} ctx=${ctx} />
        <${Field} label="Grad"><${Select} value=${obj.level ?? 1} options=${Array.from({ length: 10 }, (_, i) => ({ value: i, label: i ? `${i}. Grad` : 'Zaubertrick' }))} onChange=${(v) => { obj.level = Number(v); if (dmg) setDamage(baseDice, dmg.type, dmg.up); else t(); }} /><//>
        <${Field} label="Schule"><${Select} value=${obj.school || 'evocation'} options=${Object.entries(SCHOOL_ART).map(([k, v]) => ({ value: k, label: v.name }))} onChange=${(v) => set('school', v)} /><//>
        <${FieldView} f=${edField} obj=${obj} ctx=${ctx} />
        <${Field} label=${Lab('Klassen', INFO.spellClasses)} class="rb-wide"><${Chips} options=${ctx.classOpts} value=${obj.classes} onChange=${(v) => { obj.classes = v; t(); }} /><//>
        <${Field} label="Zeitaufwand"><div class="stack sm"><${Select} value=${timeVal} options=${TIMES.map(([v, l]) => ({ value: v, label: l }))}
          onChange=${(v) => { if (['action', 'bonus', 'reaction'].includes(v)) { obj.action = v; obj.time = { action: 'Aktion', bonus: 'Bonusaktion', reaction: 'Reaktion' }[v]; } else { obj.action = 'long'; obj.time = v; } t(); }} />
          ${obj.action === 'reaction' ? html`<${TextIn} value=${obj.trigger} placeholder="Auslöser, z. B. wenn du getroffen wirst" onChange=${(v) => set('trigger', v)} />` : null}</div><//>
        <${Field} label="Reichweite"><div class="row" style="gap:6px"><${Select} value=${obj.rangeKind || 'dist'} options=${[{ value: 'dist', label: 'Entfernung' }, { value: 'self', label: 'Selbst' }, { value: 'touch', label: 'Berührung' }, { value: 'sight', label: 'Sicht' }, { value: 'unl', label: 'unbegrenzt' }]}
          onChange=${(v) => { obj.rangeKind = v; delete obj.range; t(); }} />${(obj.rangeKind || 'dist') === 'dist' ? html`<div class="rb-unit"><${NumIn} value=${obj.rangeM} min=${0} step=${1.5} onChange=${(v) => { obj.rangeM = v; delete obj.range; t(); }} /><span>m</span></div>` : null}</div>
          <${Suggest} items=${[[1.5, '1,5 m'], [9, '9 m'], [18, '18 m'], [36, '36 m'], [45, '45 m'], [90, '90 m']].map(([v, l]) => ({ label: l, v }))} value=${obj.rangeM} onPick=${(v) => { obj.rangeKind = 'dist'; obj.rangeM = v; delete obj.range; t(); }} /><//>
        <${Field} label=${Lab('Komponenten', INFO.comps)}><${Chips} options=${[{ value: 'V', label: 'V (verbal)' }, { value: 'G', label: 'G (Geste)' }, { value: 'M', label: 'M (Material)' }]} value=${comps} onChange=${(v) => set('comps', ['V', 'G', 'M'].filter((x) => v.includes(x)).join(', '))} /><//>
        ${comps.includes('M') ? html`<${Field} label=${Lab('Material', INFO.material)}><div class="stack sm"><${TextIn} value=${obj.material} placeholder="z. B. ein Diamant" onChange=${(v) => set('material', v)} />
          <div class="row" style="gap:6px"><span class="small muted">Preis</span><${NumIn} value=${obj.matCost} min=${0} placeholder="–" onChange=${(v) => set('matCost', v)} /><span class="small muted">GM</span><${Check} checked=${!!obj.matUsed} label="wird verbraucht" onChange=${(v) => set('matUsed', v)} /></div></div><//>` : null}
        <${Field} label=${Lab('Wirkungsdauer', INFO.duration)}><div class="stack sm"><${TextIn} value=${obj.duration} placeholder="Unmittelbar" list="rb-durations" onChange=${(v) => set('duration', v)} />
          <div class="row" style="gap:10px"><${Check} checked=${obj.conc} label="Konzentration" onChange=${(v) => set('conc', v)} /><${Check} checked=${obj.ritual} label="Ritual" onChange=${(v) => set('ritual', v)} /></div></div><//>
        <${Field} label="Beschreibung" class="rb-wide" hint="Leerzeile = neuer Absatz"><${Area} rows=${5} value=${toArr(obj.desc).join('\n\n')} onChange=${(v) => { obj.desc = v.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean); t(); }} /><//>
        <${Field} label=${Lab('Auf höheren Graden', INFO.higher)} class="rb-wide"><${Area} rows=${2} value=${toArr(obj.higher).join('\n\n')} placeholder="z. B. Der Schaden steigt um 1W6 für jeden Grad über dem 1." onChange=${(v) => { if (v.trim()) obj.higher = [v.trim()]; else delete obj.higher; t(); }} /><//>
      </div>
    <//>
    <${Section} title="Wirkung im Kampf" icon="swords" info=${INFO.combat}>
      <div class="rb-form">
        <${Field} label="Art"><${Select} value=${kind} options=${[{ value: 'none', label: 'nur Text' }, { value: 'attack', label: 'Zauberangriff' }, { value: 'save', label: 'Rettungswurf' }, { value: 'heal', label: 'Heilung' }, { value: 'buff', label: 'Stärkung (Verbündete)' }]}
          onChange=${(v) => { delete obj.attack; delete obj.save; delete obj.heal; const f2 = { ...fx }; delete f2.use; delete f2.eff; if (v === 'attack') obj.attack = 'ranged'; if (v === 'save') obj.save = 'dex'; if (v === 'heal') { obj.heal = { dice: '1d8', mod: true }; delete obj.damage; } if (v === 'buff') { f2.use = 'buff'; f2.t = 'ally'; f2.eff = { k: 'ac', name: obj.name || 'Stärkung', data: { bonus: 1 }, dur: obj.conc ? 'conc' : 10 }; } if (Object.keys(f2).length) obj.fx = f2; else delete obj.fx; t(); }} /><//>
        ${obj.attack ? html`<${Field} label="Angriff"><${Select} value=${obj.attack} options=${[{ value: 'ranged', label: 'Fernkampf' }, { value: 'melee', label: 'Nahkampf' }]} onChange=${(v) => set('attack', v)} /><//>` : null}
        ${obj.save ? html`<${Field} label="Rettungswurf"><div class="stack sm"><${Select} value=${obj.save} options=${AB_OPTS} onChange=${(v) => set('save', v)} /><${Check} checked=${!!fx.half} label="bei Erfolg halber Schaden" onChange=${(v) => setFx({ half: v || undefined })} /></div><//>` : null}
        ${obj.attack || obj.save ? html`<${Field} label=${obj.level ? `Schaden auf dem ${obj.level}. Grad` : 'Schaden (steigt auf 5/11/17)'}><div class="row" style="gap:6px"><${TextIn} mono value=${baseDice} placeholder="z. B. 3d6" onChange=${(v) => setDamage(v)} />
          <${Select} value=${dmg?.type || 'fire'} options=${DMG} onChange=${(v) => setDamage(baseDice || '1d6', v)} /></div><//>
          ${obj.level ? html`<${Field} label=${Lab('+ Schaden je höherem Grad', INFO.up)}><${TextIn} mono value=${dmg?.up} placeholder="z. B. 1d6" onChange=${(v) => setDamage(baseDice || '1d6', dmg?.type || 'fire', v)} /><//>` : null}` : null}
        ${obj.heal ? html`<${Field} label="Heilung"><div class="row" style="gap:6px"><${TextIn} mono value=${heal.dice} onChange=${(v) => setHeal({ dice: v })} /><${Check} checked=${heal.mod} label="+ Attributsmodifikator" onChange=${(v) => setHeal({ mod: v })} /></div><//>
          <${Field} label=${Lab('+ Heilung je höherem Grad', INFO.up)}><${TextIn} mono value=${heal.up} placeholder="z. B. 1d8" onChange=${(v) => setHeal({ up: v || undefined })} /><//>` : null}
        ${fx.use === 'buff' ? html`<${Field} label="Stärkung" class="rb-wide"><div class="row" style="gap:6px;flex-wrap:wrap">
          <${Select} value=${fx.eff?.k || 'ac'} options=${[{ value: 'ac', label: 'RK-Bonus' }, { value: 'speedAdd', label: 'Bewegung (Meter)' }, { value: 'resist', label: 'Resistenz' }]}
            onChange=${(v) => setFx({ eff: { ...(fx.eff || {}), k: v, data: v === 'ac' ? { bonus: 1 } : v === 'speedAdd' ? { m: 3 } : { types: ['fire'] } } })} />
          ${fx.eff?.k === 'resist' ? html`<${Chips} options=${DMG} value=${fx.eff?.data?.types} onChange=${(v) => setFx({ eff: { ...fx.eff, data: { types: v } } })} />`
            : html`<${NumIn} value=${fx.eff?.k === 'speedAdd' ? fx.eff?.data?.m : fx.eff?.data?.bonus} onChange=${(v) => setFx({ eff: { ...fx.eff, data: fx.eff?.k === 'speedAdd' ? { m: v || 0 } : { bonus: v || 0 } } })} />`}
          <span class="small muted">Dauer</span><${Select} value=${String(fx.eff?.dur ?? 10)} options=${[{ value: 'conc', label: 'Konzentration' }, { value: '1', label: '1 Runde' }, { value: '10', label: '1 Minute' }, { value: '100', label: '10 Minuten' }, { value: '600', label: '1 Stunde' }]}
            onChange=${(v) => setFx({ eff: { ...fx.eff, dur: v === 'conc' ? 'conc' : Number(v) } })} /></div><//>` : null}
        ${kind !== 'none' ? html`<${Field} label=${Lab('Ziele', INFO.targets)}><div class="row" style="gap:6px;flex-wrap:wrap">
          <${Select} value=${fx.t || ''} options=${[{ value: '', label: 'automatisch' }, { value: 'enemy', label: 'ein Gegner' }, { value: 'ally', label: 'ein Verbündeter' }, { value: 'creature', label: 'eine Kreatur' }, { value: 'self', label: 'selbst' }, { value: 'multi', label: 'mehrere' }, { value: 'point', label: 'Fläche (Punkt)' }]} onChange=${(v) => setFx({ t: v || undefined })} />
          ${fx.t === 'multi' ? html`<${NumIn} value=${fx.n} min=${1} placeholder="Anzahl" onChange=${(v) => setFx({ n: v })} /><span class="small muted">+</span><${NumIn} value=${fx.up} min=${0} placeholder="0" onChange=${(v) => setFx({ up: v || undefined })} /><span class="small muted">je Grad</span>` : null}</div><//>` : null}
        ${obj.save || obj.attack ? html`<${Field} label="Fläche"><div class="row" style="gap:6px"><${Select} value=${obj.area?.shape || ''} options=${[{ value: '', label: 'ein Ziel' }, { value: 'sphere', label: 'Kugel' }, { value: 'cone', label: 'Kegel' }, { value: 'cube', label: 'Würfel' }, { value: 'line', label: 'Linie' }, { value: 'cylinder', label: 'Zylinder' }, { value: 'emanation', label: 'Ausströmung' }]}
          onChange=${(v) => { if (v) obj.area = { shape: v, size: obj.area?.size || 6 }; else delete obj.area; t(); }} />${obj.area ? html`<div class="rb-unit"><${NumIn} value=${obj.area.size} min=${1.5} step=${1.5} onChange=${(v) => { obj.area = { ...obj.area, size: v || 1.5 }; t(); }} /><span>m</span></div>` : null}</div><//>` : null}
        ${obj.save || obj.attack ? html`<${Field} label=${Lab('Zustand', INFO.cond)} class="rb-wide"><div class="row" style="gap:6px;flex-wrap:wrap">
          <${Select} value=${fx.cond?.n || ''} options=${[{ value: '', label: 'keiner' }, ...FX_CONDS.filter((c) => c !== 'Erschöpft').map((c) => ({ value: c, label: c }))]} onChange=${(v) => setFx({ cond: v ? { ...(fx.cond || { dur: obj.conc ? 'conc' : 10 }), n: v } : undefined })} />
          ${fx.cond ? html`<span class="small muted">Dauer</span><${Select} value=${String(fx.cond.dur ?? 10)} options=${[{ value: 'conc', label: 'Konzentration' }, { value: 'srcNextEnd', label: 'bis Ende deines nächsten Zuges' }, { value: '1', label: '1 Runde' }, { value: '10', label: '1 Minute' }, { value: 'long', label: 'länger (von Hand beenden)' }]}
              onChange=${(v) => setFx({ cond: { ...fx.cond, dur: ['conc', 'srcNextEnd', 'long'].includes(v) ? v : Number(v) } })} />
            <${Check} checked=${fx.cond.save === 'end'} label="Rettungswurf am Zugende" onChange=${(v) => setFx({ cond: { ...fx.cond, save: v ? 'end' : undefined } })} />
            <${Check} checked=${!!fx.cond.endOnDamage} label="endet bei Schaden" onChange=${(v) => setFx({ cond: { ...fx.cond, endOnDamage: v || undefined } })} />` : null}
        </div><//>` : null}
      </div>
    <//>
  </div>`;
}

// ───────────────────────── Vorschau ─────────────────────────
function Preview({ cat, e, pack }) {
  if (!e) return null;
  const ed = edOf(e, pack);
  const chips = [];
  let body = null;
  let extra = null;
  const fxChips = Array.isArray(e.fx) ? e.fx.map((f) => fxLabel(f, fxNames)) : [];
  if (cat === 'species' || cat === 'subspecies') {
    if (e.size) chips.push(e.size);
    if (e.type) chips.push(e.type);
    if (e.speed != null) chips.push(`Bewegung ${fmtM(e.speed)}`);
    for (const [k, v] of Object.entries(e.speeds || {})) chips.push(`${MOVE_DE[k]} ${v === 'walk' ? '= Bewegung' : fmtM(v)}`);
    if (e.dark) chips.push(`Dunkelsicht ${fmtM(e.dark)}`);
    for (const [k, v] of Object.entries(e.senses || {})) chips.push(`${SENSE_DE[k]} ${fmtM(v)}`);
    if (e.asi) chips.push(Object.entries(e.asi).map(([k, v]) => `${CG.AB_SHORT[k]} ${v > 0 ? '+' : ''}${v}`).join(', '));
    if (e.resist?.length) chips.push(`Resistenz: ${e.resist.map((k) => DAMAGE_ART[k]?.name || k).join(', ')}`);
    if (e.langs?.length || e.langAny) chips.push(`Sprachen: ${[...toArr(e.langs), e.langAny ? `+${e.langAny} nach Wahl` : ''].filter(Boolean).join(', ')}`);
    extra = html`${toArr(e.traits).map(([n, d], i) => html`<p key=${i}><b>${n}.</b> <${FxText} text=${d} name=${n} /></p>`)}
      ${e.option?.list?.length ? html`<p><b>${e.option.label}:</b> ${e.option.list.map((o) => o.name).join(', ')}</p>` : null}
      ${e.subs?.length ? html`<p><b>Unterarten:</b> ${e.subs.map((o) => o.name).join(', ')}</p>` : null}`;
  } else if (cat === 'backgrounds') {
    if (e.abilities?.length) chips.push(e.abilities.map((k) => CG.AB_SHORT[k]).join(' · '));
    if (e.feat) chips.push(`Talent: ${CG.findFeat(e.feat)?.name || e.feat}`);
    if (e.skills?.length) chips.push(e.skills.map(CG.skillName).join(', '));
    if (e.tool) chips.push(e.tool);
    body = html`${e.desc ? html`<p><${FxText} text=${e.desc} name=${e.name} /></p>` : null}
      ${e.feature || e.featureDesc ? html`<p><b>${e.feature || 'Merkmal'}.</b> <${FxText} text=${e.featureDesc || ''} name=${e.feature} /></p>` : null}
      ${e.equip ? html`<p><b>Ausrüstung:</b> <${FxText} text=${e.equip} /></p>` : null}`;
  } else if (cat === 'feats') {
    chips.push(CAT_LABEL[e.cat] || 'Talent');
    const pr = CG.prereqText(e);
    if (pr) chips.push(`Voraussetzung: ${pr}`);
    if (e.repeatable) chips.push('mehrfach wählbar');
    body = html`<p><${FxText} text=${e.desc || ''} name=${e.name} /></p>`;
  } else if (cat === 'subclasses') {
    chips.push(CG.findClass(e.cls)?.name || e.cls || 'Klasse?');
    body = e.desc ? html`<p>${e.desc}</p>` : null;
    extra = html`${Object.entries(e.features || {}).sort((a, b) => a[0] - b[0]).flatMap(([l, list]) => toArr(list).map((f, i) => html`<p key=${`${l}-${i}`}><b>Stufe ${l} – ${f.name}.</b> <${FxText} text=${f.desc} name=${f.name} /></p>`))}
      ${Object.keys(e.spells || {}).length ? html`<p><b>Immer vorbereitet:</b> ${Object.entries(e.spells).map(([l, v]) => `St. ${l}: ${toArr(v).join(', ')}`).join(' · ')}</p>` : null}`;
  } else if (cat === 'classes') {
    chips.push(`W${e.hd || 8}`, `Rettungswürfe: ${toArr(e.saves).map((k) => CG.AB_SHORT[k]).join(', ') || '–'}`);
    if (e.cast?.type && e.cast.type !== 'none') chips.push(`Zauber: ${CG.AB_SHORT[e.cast.ability] || ''}`);
    for (const r of toArr(e.resources)) chips.push(r.name);
    body = e.desc ? html`<p>${e.desc}</p>` : null;
    const tb = perEd(e, 'feat', ed || '2024') || {};
    const cols = toArr(e.columns);
    extra = html`<div class="rb-prev-table">${Array.from({ length: 20 }, (_, i) => toArr(tb[i + 1])).map((l, i) => (l.length || cols.length ? html`<div key=${i}><b>${i + 1}</b><span>${[...cols.map((c) => `${c.name} ${toArr(c.values)[i] ?? ''}`), ...l.map((x) => ({ '@asi': 'Attributswerterhöhung', '@sub': e.subLabel || 'Unterklasse', '@boon': 'Epische Gabe' }[x] || x))].join(', ')}</span></div>` : null))}</div>`;
  } else if (cat === 'spells') {
    chips.push(e.level ? `${e.level}. Grad` : 'Zaubertrick', SCHOOL_ART[e.school]?.name || e.school);
    if (e.conc) chips.push('Konzentration');
    if (e.ritual) chips.push('Ritual');
    if (e.damage?.slots || e.damage?.char) chips.push(`${Object.values(e.damage.slots || e.damage.char)[0]} ${DAMAGE_ART[e.damage.type]?.name || ''}`);
    if (e.fx?.cond?.n) chips.push(e.fx.cond.n);
    body = html`${toArr(e.desc).map((p, i) => html`<p key=${i}>${p}</p>`)}${toArr(e.higher).map((p, i) => html`<p key=${`h${i}`}><b>Auf höheren Graden.</b> ${p}</p>`)}`;
  } else if (cat === 'weapons') {
    chips.push(e.cat === 'martial' ? 'Kriegswaffe' : 'Einfache Waffe', `${e.dmg || '?'} ${e.type || ''}`);
    if (e.magic) chips.push(`+${e.magic}`);
    if (e.extraDmg) chips.push(`+${e.extraDmg} ${e.extraType || ''}`);
    if (e.m) chips.push(e.m);
    body = html`<p>${[...(e.p || '')].map((p) => CG.PROP_NAMES[p]).filter(Boolean).join(', ')}${e.range ? ` · ${e.range.join('/')} m` : ''}</p>${e.special ? html`<p>${e.special}</p>` : null}${e.m ? html`<p><b>${e.m}.</b> ${MASTERY.find(([n]) => n === e.m)?.[1] || ''}</p>` : null}`;
  } else if (cat === 'items') {
    chips.push(CG.ITEM_SLOTS[e.slot] || 'Gegenstand', e.rarity || '');
    if (e.attune) chips.push('Einstimmung');
    if (e.charges?.max) chips.push(`${e.charges.max} Ladungen`);
    body = e.desc ? html`<p><${FxText} text=${e.desc} name=${e.name} /></p>` : null;
  } else if (cat === 'conditions') {
    if (e.rounds) chips.push(`${e.rounds} Runden`);
    if (e.stack) chips.push(`stapelbar bis ${e.stack}`);
    if (e.dot?.dice) chips.push(`${String(e.dot.dice).replace(/d/g, 'W')} ${DAMAGE_ART[e.dot.type]?.name || ''} pro Zug`);
    if (e.save?.ab) chips.push(`endet: ${CG.AB_SHORT[e.save.ab]}-Rettungswurf`);
    for (const b of toArr(e.base)) chips.push(`zählt als ${b}`);
    body = e.desc ? html`<p>${e.desc}</p>` : null;
  } else if (cat === 'armor') {
    chips.push(CG.ARMOR_TYPE[e.type] || e.type, e.type === 'shield' ? `RK +${(Number(e.ac) || 2) + (Number(e.bonus) || 0)}` : e.type === 'clothing' ? `RK +${Number(e.bonus) || 0}` : `RK ${e.ac}${e.bonus ? ` +${e.bonus}` : ''}`);
    if (e.stealth) chips.push('Nachteil auf Heimlichkeit');
    body = e.special ? html`<p>${e.special}</p>` : null;
  }
  return html`<div class="rb-preview">
    <div class="rb-prev-h"><b>${e.name || '(ohne Namen)'}</b>${ed ? html`<span class="badge">Regeln ${ed}</span>` : null}</div>
    ${chips.length ? html`<div class="rb-prev-chips">${chips.map((c, i) => html`<span key=${i}>${c}</span>`)}</div>` : null}
    ${body ? html`<div class="rb-prev-body">${body}</div>` : null}
    ${extra}
    ${fxChips.length ? html`<div class="rb-prev-fx"><b>Wirkungen:</b> ${fxChips.join(' · ')}</div>` : null}
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
    case 'items': return { key: '', name: '', slot: 'ring', rarity: 'ungewöhnlich', desc: '', fx: [] };
    case 'conditions': return { key: '', name: '', desc: '', rounds: 2, fx: [] };
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
  armor: () => (e.type === 'clothing' ? 'Kleidung' : e.type === 'shield' ? 'Schild' : `RK ${e.ac ?? '?'}`),
  items: () => [CG.ITEM_SLOTS[e.slot] || '', e.rarity || ''].filter(Boolean).join(' · '),
  conditions: () => [e.dot?.dice ? 'Schaden pro Zug' : '', e.stack ? 'stapelbar' : ''].filter(Boolean).join(' · '),
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
    onPick=${(obj, mode) => { const o = plain(obj); delete o._pack; delete o._srd; delete o._gear; if (mode === 'copy') { o.name = `${o.name} (eigene Fassung)`; if (cat === 'spells') o.id = ''; else if (cat !== 'subclasses') o.key = ''; } add(o); close(); }} />`, { title: `${catOf(cat).label} aus dem Grundbestand`, icon: 'book', size: 'lg' });
  const fields = FIELDS[cat];
  return html`<div class="rb-cat">
    <div class="rb-cat-list">
      <div class="row nowrap" style="gap:6px"><input class="input grow" placeholder=${`${catOf(cat).label} durchsuchen`} value=${q} onInput=${(ev) => setQ(ev.target.value)} /></div>
      <div class="row" style="gap:6px">
        <${Btn} size="sm" kind="primary" icon="plus" onClick=${() => add(newEntry(cat, pack, ctx))}>Neu<//>
        <${Btn} size="sm" icon="copy" onClick=${fromBase}>Aus Grundbestand<//>
        <${Info} text="„Neu“ legt einen leeren Eintrag an. „Aus Grundbestand“ übernimmt einen Eintrag aus dem SRD: „Ersetzen“ behält die Kennung (deine Fassung gilt statt der Grundfassung), „Als Vorlage“ legt einen eigenständigen neuen Eintrag an." />
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
          <${IconBtn} icon="trash" title="Eintrag löschen" onClick=${async () => { if (await confirmDialog(`„${e.name || 'Eintrag'}“ aus dem Regelwerk löschen?`, { danger: true, ok: 'Löschen' })) { list.splice(sel, 1); setSel(Math.min(sel, list.length - 1)); touch(); } }} />
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
  // Zauber, magische Gegenstände und Zustände werden erst hier geladen
  const [list, setList] = useState(() => (['spells', 'items', 'conditions', 'weapons', 'armor'].includes(cat) ? null : baseEntries(cat, ed)));
  useEffect(() => { let alive = true; loadBase(cat, ed).then((l) => alive && setList(l)).catch(() => alive && setList([])); return () => { alive = false; }; }, [cat, ed]);
  const ql = q.trim().toLowerCase();
  const shown = (list || []).filter((x) => !ql || `${x.name} ${entryMeta(cat, x)}`.toLowerCase().includes(ql)).slice(0, 400);
  // Nur als Vorlage: eigene Zustände, magische Gegenstände und Ausrüstung (sie ersetzen nichts im Grundbestand)
  const tmpl = (x) => TEMPLATE_ONLY.has(cat) || cat === 'items' || x._srd || x._gear;
  return html`<div class="modal-body stack">
    <div class="small muted">„Ersetzen“ übernimmt den Eintrag mit gleicher Kennung – deine Fassung gilt dann statt des Grundbestands. „Als Vorlage“ legt einen neuen, eigenständigen Eintrag an.</div>
    <input class="input" placeholder="Suchen" value=${q} onInput=${(e) => setQ(e.target.value)} autoFocus />
    <div class="rb-baselist">${list == null ? html`<div class="empty"><span class="spinner" /></div>` : null}
      ${shown.map((x, i) => html`<div class="rb-baserow" key=${i}><div class="grow"><b>${x.name}</b> <span class="small muted">${entryMeta(cat, x)}${x._srd ? ' · SRD-Magie' : x._gear ? ' · Ausrüstung' : ''}</span></div>
      ${tmpl(x) ? html`<${Btn} size="sm" onClick=${() => onPick(x, 'take')}>Übernehmen<//>` : html`<${Btn} size="sm" onClick=${() => onPick(x, 'override')}>Ersetzen<//><${Btn} size="sm" kind="ghost" onClick=${() => onPick(x, 'copy')}>Als Vorlage<//>`}</div>`)}
      ${list && !shown.length ? html`<div class="small faint">Nichts gefunden.</div>` : null}</div>
    <div class="modal-foot"><${Btn} onClick=${() => close()}>Schließen<//></div>
  </div>`;
}

// ───────────────────────── Grundregeln & Ausblenden ─────────────────────────
const RES_NAMES = ['Kampfrausch', 'Ki-Punkte', 'Fokuspunkte', 'Zaubereipunkte', 'Überlegenheitswürfel', 'Göttliche Macht fokussieren', 'Bardische Inspiration', 'Tiergestalt', 'Glückspunkte', 'Hoffnung', 'Stress'];
// Fertigkeiten der Welt: [{ key, name, ability }]
function SkillsRule({ value, onChange }) {
  const list = toArr(value).length ? toArr(value) : SKILLS.map((x) => ({ ...x }));
  const custom = toArr(value).length > 0;
  const upd = (i, p) => { const n = list.map((x) => ({ ...x })); Object.assign(n[i], p); onChange(n); };
  return html`<div class="stack sm">
    ${custom ? null : html`<div class="small muted">Es gelten die 18 Fertigkeiten des Grundbestands. Änderst du eine, gilt ab dann deine Liste.</div>`}
    <div class="rb-skills">${list.map((x, i) => html`<div class="rb-skill" key=${x.key}>
      <input class="input" value=${x.name} onInput=${(e) => upd(i, { name: e.target.value })} />
      <${Select} value=${x.ability} options=${AB_OPTS} onChange=${(v) => upd(i, { ability: v })} />
      <${IconBtn} icon="trash" size=${13} title="Fertigkeit entfernen" onClick=${() => onChange(list.filter((_, k) => k !== i))} />
    </div>`)}</div>
    <div class="row" style="gap:6px">
      <input class="input" style="max-width:240px" placeholder="+ eigene Fertigkeit (Eingabetaste)" onKeyDown=${(e) => { const n = e.target.value.trim(); if (e.key === 'Enter' && n) { e.preventDefault(); onChange([...list, { key: slugify(n), name: n, ability: 'int' }]); e.target.value = ''; } }} />
      ${custom ? html`<${Btn} size="sm" kind="ghost" icon="refresh" onClick=${() => onChange(undefined)}>Grundbestand<//>` : null}
    </div>
  </div>`;
}
const PROF_PRESETS = [['5E (+2 → +6)', [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]], ['langsam (+2 → +4)', [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4]], ['schnell (+2 → +7)', [2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7]], ['kurze Kampagne (10 Stufen)', [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]]];
function RulesTab({ pack, touch }) {
  const base = CG.baseRules();
  const r = (pack.rules ||= {});
  const set = (k, v) => { if (v === undefined || v === null) delete r[k]; else r[k] = v; touch(); };
  const cost = r.pointCost || base.pointCost;
  const arr = r.standardArray || base.standardArray;
  const names = r.abilityNames || {};
  const trackers = toArr(r.trackers);
  const setTr = (i, p) => { const n = trackers.map((x) => ({ ...x })); Object.assign(n[i], p); set('trackers', n); };
  return html`<div class="stack lg rb-rules">
    <div class="small muted">Leer gelassene Werte bleiben beim Grundbestand. Die Grundregeln gelten für alle Charaktere der Kampagne, sobald dieses Regelwerk aktiv ist.</div>
    <${Section} title="Attribute" icon="user">
      <div class="rb-form">
        <${Field} label=${Lab('Punkte beim Punktekauf', 'Wie viele Punkte Spieler beim Punktekauf verteilen. 5E: 27.')}><${NumIn} value=${r.pointBudget} placeholder=${base.pointBudget} min=${0} max=${60} onChange=${(v) => set('pointBudget', v)} />
          <${Suggest} items=${[{ label: '27 (Standard)', v: 27 }, { label: '32 (heroisch)', v: 32 }, { label: '22 (hart)', v: 22 }]} value=${r.pointBudget} onPick=${(v) => set('pointBudget', v)} /><//>
        <${Field} label=${Lab('Höchster Attributswert', 'Obergrenze für Attributswerte bei Erschaffung und Aufstieg (ohne Epische Gaben). 5E: 20.')}><${NumIn} value=${r.abilityMax} placeholder=${base.abilityMax} min=${10} max=${30} onChange=${(v) => set('abilityMax', v)} /><//>
        <${Field} label=${Lab('Würfelmethode', 'Wie beim Auswürfeln der Attributswerte gewürfelt wird.')}><${Select} value=${r.rollMethod || '4d6kh3'} options=${CG.ROLL_METHODS.map((m) => ({ value: m.value, label: m.label }))} onChange=${(v) => set('rollMethod', v === '4d6kh3' ? undefined : v)} /><//>
      </div>
      <${Field} label=${Lab('Standardwerte (sechs Werte zum Verteilen)', 'Die Reihe für die Methode „Standardwerte“. 5E: 15, 14, 13, 12, 10, 8.')}><div class="rb-abmap">${arr.map((n, i) => html`<label key=${i}><span>${i + 1}.</span><input class="input" type="number" value=${n}
        onInput=${(e) => { const a = [...arr]; a[i] = Number(e.target.value) || 0; set('standardArray', a); }} /></label>`)}</div><//>
      <${Field} label=${Lab('Kosten beim Punktekauf (Wert → Punkte)', 'Was ein Attributswert beim Punktekauf kostet. Der niedrigste Wert ist der Startwert.')}><div class="rb-abmap">${Object.entries(cost).map(([k, v]) => html`<label key=${k}><span>${k}</span><input class="input" type="number" value=${v}
        onInput=${(e) => set('pointCost', { ...cost, [k]: Number(e.target.value) || 0 })} /></label>`)}</div>
        <div class="row" style="gap:6px;margin-top:6px">
          <${Btn} size="sm" kind="ghost" icon="plus" onClick=${() => { const ks = Object.keys(cost).map(Number); const hi = Math.max(...ks); set('pointCost', { ...cost, [hi + 1]: (cost[hi] || 0) + 2 }); }}>Höheren Wert erlauben<//>
          <${Btn} size="sm" kind="ghost" onClick=${() => { const ks = Object.keys(cost).map(Number); if (ks.length <= 2) return; const c = { ...cost }; delete c[Math.max(...ks)]; set('pointCost', c); }}>Höchsten Wert entfernen<//>
        </div><//>
      <${Field} label=${Lab('Eigene Attributsnamen', 'Nur die Anzeige: Die sechs Attribute behalten ihre Rolle (Stärke für Nahkampf usw.), heißen aber z. B. „Finesse“ oder „Instinkt“. Leer = Standardname.')}>
        <div class="rb-abnames">${AB.map((k) => html`<label key=${k}><span>${({ str: 'Stärke', dex: 'Geschicklichkeit', con: 'Konstitution', int: 'Intelligenz', wis: 'Weisheit', cha: 'Charisma' })[k]}</span>
          <input class="input" value=${names[k]?.name || ''} placeholder="Name" onInput=${(e) => { const n = { ...names, [k]: { ...(names[k] || {}), name: e.target.value } }; set('abilityNames', n); }} />
          <input class="input rb-short" value=${names[k]?.short || ''} placeholder="Kürzel" maxLength="4" onInput=${(e) => { const n = { ...names, [k]: { ...(names[k] || {}), short: e.target.value } }; set('abilityNames', n); }} /></label>`)}</div><//>
    <//>
    <${Section} title="Stufen & Trefferpunkte" icon="heart">
      <div class="rb-form">
        <${Field} label=${Lab('Höchste Stufe', 'Bis zu welcher Stufe Charaktere aufsteigen. 5E: 20; für kurze Kampagnen oder Systeme mit 10 Stufen weniger.')}><${NumIn} value=${r.maxLevel} placeholder="20" min=${1} max=${20} onChange=${(v) => set('maxLevel', v)} />
          <${Suggest} items=${[{ label: '20', v: undefined }, { label: '10', v: 10 }, { label: '12', v: 12 }, { label: '15', v: 15 }]} value=${r.maxLevel} onPick=${(v) => set('maxLevel', v)} /><//>
        <${Field} label=${Lab('Trefferpunkte auf Stufe 1', 'Maximum des Trefferwürfels (5E) oder dessen Durchschnitt.')}><${Select} value=${r.hpFirst || 'max'} options=${[{ value: 'max', label: 'Maximum des Trefferwürfels' }, { value: 'avg', label: 'Durchschnitt' }]} onChange=${(v) => set('hpFirst', v === 'max' ? undefined : v)} /><//>
        <${Field} label=${Lab('Trefferpunkte beim Aufstieg', 'Spieler wählen zwischen Wurf und Durchschnitt (5E), müssen würfeln oder bekommen immer das Maximum.')}><${Select} value=${r.hpLevel || 'avg'} options=${[{ value: 'avg', label: 'Wurf oder Durchschnitt (Wahl)' }, { value: 'roll', label: 'immer würfeln' }, { value: 'max', label: 'immer Maximum' }]} onChange=${(v) => set('hpLevel', v === 'avg' ? undefined : v)} /><//>
      </div>
      <${Field} label=${Lab('Übungsbonus je Stufe', 'Übungsbonus auf den Stufen 1–20. Leer = 5E (+2 bis +6).')}><${LevelRow} value=${r.profTable || PROF_PRESETS[0][1]} presets=${PROF_PRESETS} onChange=${(v) => set('profTable', JSON.stringify(v) === JSON.stringify(PROF_PRESETS[0][1]) ? undefined : v)} /><//>
    <//>
    <${Section} title="Optionen" icon="settings">
      <div class="rb-form">
        <${Field} label=${Lab('Talente', 'Ohne Talente gibt es bei jeder Attributswerterhöhung nur Attributspunkte.')}><${Toggle} checked=${r.feats !== false} label="Talente statt Attributswerterhöhung erlaubt" onChange=${(v) => set('feats', v ? undefined : false)} /><//>
        <${Field} label=${Lab('Mehrklassen', 'Ob Charaktere beim Stufenaufstieg eine weitere Klasse beginnen dürfen.')}><${Toggle} checked=${r.multiclass !== false} label="Mehrklassen erlaubt" onChange=${(v) => set('multiclass', v ? undefined : false)} /><//>
        <${Field} label=${Lab('Kritische Treffer', 'Standard: Schadenswürfel verdoppeln. Hausregel: Maximum der Würfel plus normaler Wurf – kritische Treffer fühlen sich verlässlich stark an.')}><${Select} value=${r.critRule || 'dice'} options=${[{ value: 'dice', label: 'Würfel verdoppeln' }, { value: 'max', label: 'Maximum + Wurf' }]} onChange=${(v) => set('critRule', v === 'dice' ? undefined : v)} /><//>
        <${Field} label=${Lab('Einstimmung', INFO.attuneMax)}><${NumIn} value=${r.attuneMax} placeholder="3" min=${0} max=${12} onChange=${(v) => set('attuneMax', v === 3 || v == null ? undefined : v)} />
          <${Suggest} items=${[{ label: '3 (5E)', v: undefined }, { label: 'unbegrenzt', v: 0 }, { label: '5', v: 5 }]} value=${r.attuneMax} onPick=${(v) => set('attuneMax', v)} /><//>
      </div>
      <${Field} label=${Lab('Fertigkeiten', INFO.skillsRule)}><${SkillsRule} value=${r.skills} onChange=${(v) => set('skills', v)} /><//>
      <${Field} label=${Lab('Sprachen der Welt', 'Eigene Sprachen, die im Assistenten und im Editor zur Auswahl stehen (z. B. Sprachen deiner Welt).')}><div class="stack sm">
        <${Chips} options=${toArr(r.languages).map((l) => ({ value: l, label: `${l} ×` }))} value=${[]} onChange=${(v) => set('languages', toArr(r.languages).filter((x) => !v.includes(x)))} />
        <input class="input" style="max-width:260px" placeholder="+ Sprache (Eingabetaste)" onKeyDown=${(e) => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); set('languages', [...new Set([...toArr(r.languages), e.target.value.trim()])]); e.target.value = ''; } }} />
      </div><//>
    <//>
    <${Section} title="Zähler für alle Charaktere" icon="zap" info="Werte, die jeder Charakter mitführt – z. B. „Hoffnung“ (0–6), „Stress“ oder „Heldenpunkte“. Sie erscheinen bei den Ressourcen im Bogen. „nie“ = wird nicht durch Rasten aufgefrischt.">
      ${trackers.map((tr, i) => html`<div class="rb-pair" key=${i}><div class="grow stack sm"><div class="row" style="gap:6px;flex-wrap:wrap">
        <${TextIn} value=${tr.name} placeholder="Name, z. B. Hoffnung" onChange=${(v) => setTr(i, { name: v })} />
        <span class="small muted">Höchstwert</span><${Select} value=${typeof tr.max === 'number' || tr.max == null ? 'num' : tr.max} options=${RES_V} onChange=${(v) => setTr(i, { max: v === 'num' ? 3 : v })} />
        ${typeof tr.max === 'number' || tr.max == null ? html`<${NumIn} value=${tr.max} min=${1} onChange=${(v) => setTr(i, { max: v || 1 })} />` : null}
        <span class="small muted">aufgefrischt</span><${Select} value=${tr.reset || 'long'} options=${[...RESTS, { value: 'none', label: 'nie' }]} onChange=${(v) => setTr(i, { reset: v })} /></div>
        <${TextIn} value=${tr.info} placeholder="Kurzerklärung" onChange=${(v) => setTr(i, { info: v })} /></div>
        <${IconBtn} icon="trash" size=${14} onClick=${() => set('trackers', trackers.filter((_, k) => k !== i))} /></div>`)}
      <${Btn} size="sm" icon="plus" onClick=${() => set('trackers', [...trackers, { name: '', max: 3, reset: 'long' }])}>Zähler hinzufügen<//>
    <//>
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
    ['weapons', 'Waffen', baseEntries('weapons', ed).map((e) => [e.key, e.name])],
    ['armor', 'Rüstungen', baseEntries('armor', ed).map((e) => [e.key, e.name])],
  ];
  const toggle = (k, id, v) => { const s = new Set(toArr(rm[k])); if (v) s.add(id); else s.delete(id); rm[k] = [...s]; if (!rm[k].length) delete rm[k]; touch(); };
  return html`<div class="stack">
    <div class="small muted">Angehakte Einträge verschwinden in Kampagnen mit diesem Regelwerk – z. B. wenn es in deiner Welt keine Elfen gibt. Bestehende Charaktere behalten ihre Werte.</div>
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
      <${Field} label=${Lab('Regelstand', 'Für welchen Regelstand das Regelwerk gedacht ist. „Beide“: jeder Eintrag kann über „Regelstand“ einem Stand zugeordnet werden.')}><${Segmented} value=${pack.edition} options=${EDITIONS} onChange=${(v) => { pack.edition = v; touch(); }} /><//>
      <${Field} label="Beschreibung" class="rb-wide"><${Area} rows=${3} value=${pack.description} placeholder="Wofür ist dieses Regelwerk gedacht?" onChange=${(v) => { pack.description = v; touch(); }} /><//>
    </div>
    <div class="rb-counts">${[...CATEGORIES.map((c) => [c.key, c.label, chk.counts[c.key] || 0]), ['rules', 'Grundregeln', Object.keys(pack.rules || {}).length], ['remove', 'Ausgeblendet', Object.values(pack.remove || {}).reduce((t, l) => t + toArr(l).length, 0)]]
      .map(([k, l, n]) => html`<button type="button" key=${k} class="rb-count" onClick=${() => setTab(k)}><b>${n}</b><span>${l}</span></button>`)}</div>
    ${chk.errors.length || chk.warnings.length || errors.length ? html`<div class="card stack sm">
      ${[...chk.errors, ...errors].map((x, i) => html`<div key=${`e${i}`} class="small danger-text">✖ ${x}</div>`)}
      ${chk.warnings.map((x, i) => html`<div key=${`w${i}`} class="small rb-warn">⚠ ${x}</div>`)}
    </div>` : html`<div class="small success-text">✔ Keine Probleme gefunden.</div>`}
    <div class="callout callout-blue"><div class="callout-title"><${Icon} name="info" size=${16} />So wirken Regelwerke</div><div class="callout-content small" style="line-height:1.6">
      Die App bringt nur den frei lizenzierten Grundbestand mit (SRD 5.1 für Regeln 2014, SRD 5.2.1 für Regeln 2024). Ein Regelwerk legt sich darüber: neue Einträge kommen dazu, Einträge mit gleicher Kennung ersetzen den Grundbestand, ausgeblendete verschwinden. Je Kampagne gilt genau ein Regelwerk – für dich und deine Mitspieler.<br />
      Beschreibungen werden gelesen: Formulierungen wie <b class="fx-hl">+3 m Bewegung</b>, <b class="fx-hl">Resistenz gegen Feuerschaden</b> oder <b class="fx-hl">Übung in Heimlichkeit</b> wirken direkt im Charakterbogen (Symbol „i“ neben jeder Beschreibung). Was sich nicht in einem Satz sagen lässt, legst du unter „Weitere Wirkungen“ fest.<br />
      Über „Exportieren“ teilst du ein Regelwerk als Datei mit anderen Spielleitungen. Für Inhalte, die du selbst einträgst oder importierst, bist du verantwortlich – übernimm nur, was du selbst geschrieben hast oder nutzen darfst.
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
    ${exists ? html`<${Segmented} value=${mode} onChange=${setMode} options=${[{ value: 'replace', label: 'Vorhandenes ersetzen' }, { value: 'new', label: 'Als neues Regelwerk' }]} />` : null}
    <div class="small muted">Nur Inhalte importieren, die du nutzen darfst. Das Regelwerk gilt nur dort, wo du es aktivierst.</div>
    <div class="modal-foot">
      <${Btn} onClick=${() => close(null)}>Abbrechen<//>
      <${Btn} icon="archive" disabled=${chk.errors.length > 0} onClick=${() => close({ mode, activate: false })}>In meine Bibliothek<//>
      ${inCampaign ? html`<${Btn} kind="primary" icon="check" disabled=${chk.errors.length > 0} onClick=${() => close({ mode, activate: true })}>Speichern & in dieser Kampagne verwenden<//>` : null}
    </div>
  </div>`;
}
// Regelstand passt nicht zur Kampagne
function EditionDialog({ pack, campEd, close }) {
  return html`<div class="modal-body stack">
    <div>„${pack.name}“ ist für <b>Regeln ${pack.edition}</b> gebaut, die Kampagne nutzt <b>Regeln ${campEd}</b>.</div>
    <div class="small muted">Stellst du den Regelstand um, gilt er für alle Mitspieler: Charakterbögen bleiben erhalten, Zauberlisten und Klassenmerkmale richten sich danach.</div>
    <div class="modal-foot">
      <${Btn} onClick=${() => close(null)}>Abbrechen<//>
      <${Btn} onClick=${() => close('keep')}>Trotzdem verwenden<//>
      <${Btn} kind="primary" icon="refresh" onClick=${() => close('switch')}>Auf Regeln ${pack.edition} umstellen<//>
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
  const spellNames = useSpells(campEd);

  const entries = useMemo(() => {
    const m = new Map();
    for (const d of lib || []) m.set(d.id, { id: d.id, name: d.name, edition: d.edition, counts: d.counts || {}, lib: d, camp: null });
    for (const d of camp || []) {
      const e = m.get(d.id) || { id: d.id, name: d.name, edition: d.edition, counts: d.counts || {}, lib: null };
      e.camp = d;
      m.set(d.id, e);
    }
    return [...m.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
  }, [lib, camp]);
  const activeId = activeDoc(camp || [])?.id || null;
  const pack = ed.current.pack;
  CUR_PACK = pack;
  SKILL_OPTS.splice(0, SKILL_OPTS.length, ...SKILLS.map((x) => ({ value: x.key, label: x.name })));
  const cur = pack ? entries.find((x) => x.id === pack.id) : null;

  if (!gm) {
    return html`<${ViewFrame} tabId=${tabId} title="Regelwerk"><div class="page narrow">
      <${Empty} icon="book" title="Regelwerk der Kampagne">Die Spielleitung legt fest, welches Regelwerk gilt.${rs.packs.length ? ` Aktiv: ${rs.packs.map((p) => p.name).join(', ')}.` : ' Es gilt der Grundbestand.'}<//>
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
    } catch (x) { toast(`Regelwerk lässt sich nicht öffnen: ${x.message || x}`, 'error'); }
  };
  const create = async () => {
    if (!(await confirmLeave())) return;
    const name = await promptDialog('Name des neuen Regelwerks', '', { title: 'Neues Regelwerk', placeholder: 'z. B. Völker von Arkonis', ok: 'Anlegen' });
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
    if (chk.errors.length && !(await confirmDialog(`Das Regelwerk hat ${chk.errors.length} Fehler (siehe Überblick). Trotzdem speichern? Fehlerhafte Einträge werden beim Anwenden übersprungen.`, { ok: 'Trotzdem speichern' }))) return;
    setBusy(true);
    try {
      p.updated = now();
      if (!cur || cur.lib || !cur.camp) await saveToLibrary(me, p);
      if (cur?.camp && cid) await saveToCampaign(cid, p);
      ed.current.dirty = false;
      toast(cur?.camp && activeId === p.id ? 'Gespeichert – gilt jetzt in dieser Kampagne' : 'Gespeichert', 'success');
    } catch (x) { toast(`Speichern fehlgeschlagen: ${x.message || x}`, 'error'); }
    setBusy(false);
    force((n) => n + 1);
  };
  // Genau ein Regelwerk je Kampagne – Regelstand prüfen, ggf. umstellen
  const activate = async (e) => {
    if (!cid) return;
    try {
      if (!e) { await activateOnly(cid, null, camp); toast('Es gilt jetzt nur der Grundbestand (SRD).', 'success'); return; }
      const p = packFromDoc(e.lib || e.camp);
      if (p.edition !== 'beide' && p.edition !== campEd) {
        const ch = await openModal(({ close }) => html`<${EditionDialog} pack=${p} campEd=${campEd} close=${close} />`, { title: 'Regelstand passt nicht', icon: 'alert' });
        if (!ch) return;
        if (ch === 'switch') await updateCampaign({ settings: { ...(app.get().campaign?.settings || {}), rulesVersion: p.edition } });
      }
      if (!e.camp) await saveToCampaign(cid, p, { active: false });
      await activateOnly(cid, e.id, camp);
      toast(`„${e.name}“ gilt jetzt in dieser Kampagne`, 'success');
    } catch (x) { toast(x.message || String(x), 'error'); }
  };
  const doImport = async (text = null) => {
    const packs = text ? (() => { try { return [readPack(text)]; } catch (x) { toast(x.message || String(x), 'error'); return []; } })() : await readFiles();
    for (const p of packs) {
      const exists = entries.some((x) => x.id === p.id);
      const res = await openModal(({ close }) => html`<${ImportDialog} pack=${p} exists=${exists} inCampaign=${!!cid} close=${close} />`, { title: 'Regelwerk importieren', icon: 'upload', size: 'lg' });
      if (!res) continue;
      if (res.mode === 'new' && exists) p.id = `rp-${uid(10)}`;
      await saveToLibrary(me, p);
      if (res.activate && cid) await activate({ id: p.id, name: p.name, lib: { id: p.id, json: JSON.stringify(p) }, camp: null });
      else toast(`„${p.name}“ in deiner Bibliothek gespeichert`, 'success');
    }
  };
  const pasteImport = async () => {
    const t = await promptDialog('Inhalt der Regelwerksdatei (JSON) einfügen', '', { title: 'Regelwerk einfügen', multiline: true, ok: 'Prüfen' });
    if (t) doImport(t);
  };
  const entryMenu = (ev, e) => openMenu(ev, [
    { label: 'Bearbeiten', icon: 'pencil', onClick: () => open(e) },
    cid && activeId !== e.id ? { label: 'In dieser Kampagne verwenden', icon: 'check', onClick: () => activate(e) } : null,
    { label: 'Exportieren (Datei)', icon: 'download', onClick: () => exportPack(packFromDoc(e.lib || e.camp)) },
    { label: 'Duplizieren', icon: 'copy', onClick: async () => { const p = packFromDoc(e.lib || e.camp); p.id = `rp-${uid(10)}`; p.name = `${p.name} (Kopie)`; await saveToLibrary(me, p); toast('Kopie angelegt', 'success'); } },
    !e.lib ? { label: 'In meine Bibliothek übernehmen', icon: 'archive', onClick: async () => { await saveToLibrary(me, packFromDoc(e.camp)); toast('In deiner Bibliothek gespeichert', 'success'); } } : null,
    e.camp ? { label: 'Aus dieser Kampagne entfernen', icon: 'x', onClick: async () => { if (await confirmDialog(e.lib ? `„${e.name}“ aus dieser Kampagne entfernen? In deiner Bibliothek bleibt es erhalten.` : `„${e.name}“ liegt nur in dieser Kampagne. Entfernen löscht es endgültig – vorher exportieren oder in deine Bibliothek übernehmen?`, { ok: 'Entfernen', danger: true })) await removeFromCampaign(cid, e.id); } } : null,
    e.lib ? { label: 'Aus meiner Bibliothek löschen', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog(`„${e.name}“ aus deiner Bibliothek löschen?${e.camp ? ' In dieser Kampagne bleibt die Kopie bestehen.' : ''}`, { ok: 'Löschen', danger: true })) { await removeFromLibrary(me, e.id); if (pack?.id === e.id && !e.camp) ed.current = { pack: null, dirty: false }; force((n) => n + 1); } } } : null,
  ].filter(Boolean));

  const ctx = pack ? {
    pack, touch,
    classOpts: CG.CLASSES.map((c) => ({ value: c.key, label: c.name })).concat((pack.content.classes || []).filter((c) => c.key && !CG.CLASSES.some((x) => x.key === c.key)).map((c) => ({ value: c.key, label: c.name }))),
    speciesOpts: [...new Map([...CG.SPECIES[pack.edition === '2014' ? 2014 : 2024], ...(pack.content.species || [])].filter((s) => s.key).map((s) => [s.key, { value: s.key, label: s.name }])).values()],
    featOpts: (cat) => [...new Map([...CG.FEATS, ...(pack.content.feats || [])].filter((f) => f.key && (!cat || f.cat === cat)).map((f) => [f.key, { value: f.key, label: f.name }])).values()],
  } : null;
  const counts = pack ? checkPack(pack).counts : {};
  const packErrors = pack ? rs.errors.filter((x) => x.startsWith(`${pack.name}:`)) : [];
  const total = (e) => Object.values(e.counts || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  const packCard = (e) => {
    const on = activeId === e.id;
    return html`<div key=${e.id} class=${`rb-pk${pack?.id === e.id ? ' open' : ''}${on ? ' on' : ''}`}>
      ${cid ? html`<button type="button" class=${`rb-radio${on ? ' on' : ''}`} title=${on ? 'Gilt in dieser Kampagne' : 'In dieser Kampagne verwenden'} onClick=${() => !on && activate(e)}><i></i></button>` : null}
      <button type="button" class="rb-pk-main" onClick=${() => open(e)} title=${e.name}>
        <b class="rb-pk-name">${e.name}</b>
        <span class="rb-pk-meta"><span class="badge">${EDITIONS.find((x) => x.value === e.edition)?.label || ''}</span>${total(e) ? html`<span>${total(e)} Einträge</span>` : null}${e.lib ? null : html`<span class="faint">nur Kampagne</span>`}</span>
      </button>
      <${IconBtn} icon="more-vertical" size=${15} title="Mehr" onClick=${(ev) => entryMenu(ev, e)} />
    </div>`;
  };

  return html`<${ViewFrame} tabId=${tabId} title="Regelwerk-Editor">
    <div class="page wide rb">
      <div class="page-head head-tools"><h1><${Icon} name="layers" size=${24} />Regelwerk-Editor</h1><span class="grow"></span>
        <div class="head-tools-btns"><${ViewToggle} value="rulebuilder" options=${[{ value: 'rules', label: 'Regeln', icon: 'book', view: 'rules' }, { value: 'rulebuilder', label: 'Regelwerk-Editor', icon: 'layers', view: 'rulebuilder' }]} /></div></div>
      <datalist id="rb-spellnames">${(spellNames || []).map((s) => html`<option key=${s.id} value=${s.name} />`)}</datalist>
      <datalist id="rb-ctypes">${[...CREATURE_TYPES, 'Untote, Unholde', 'groß+', 'riesig+', 'klein'].map((t) => html`<option key=${t} value=${t} />`)}</datalist>
      <datalist id="rb-resnames">${RES_NAMES.map((t) => html`<option key=${t} value=${t} />`)}</datalist>
      <datalist id="rb-colnames">${[...new Set(['Wutschaden', 'Kampfkunst', 'Hinterhältiger Angriff', ...CG.CLASSES.flatMap((c) => toArr(c.columns).map((x) => x.name)), ...(pack?.content?.classes || []).flatMap((c) => toArr(c.columns).map((x) => x.name))].filter(Boolean))].map((t) => html`<option key=${t} value=${t} />`)}</datalist>
      <datalist id="rb-durations">${DURATIONS.map((d) => html`<option key=${d} value=${d} />`)}</datalist>
      <div class="rb-layout">
        <aside class="rb-side">
          <div class="rb-side-btns">
            <${Btn} kind="primary" icon="plus" onClick=${create}>Neu<//>
            <${Btn} icon="upload" onClick=${() => doImport()}>Importieren<//>
            <${IconBtn} icon="more-horizontal" title="Weitere Möglichkeiten" onClick=${(e) => openMenu(e, [{ label: 'JSON einfügen …', icon: 'clipboard', onClick: pasteImport }])} />
          </div>
          ${cid ? html`<div class="rb-side-h">Regelwerk dieser Kampagne <span class="badge">Regeln ${campEd}</span><${Info} text="Je Kampagne gilt genau ein Regelwerk – oder nur der Grundbestand. Wählst du ein anderes, gilt es sofort für dich und alle Mitspieler. Mit dem Namen öffnest du ein Regelwerk zum Bearbeiten." /></div>
            <div class="rb-packs">
              <div class=${`rb-pk base${!activeId ? ' on' : ''}`}>
                <button type="button" class=${`rb-radio${!activeId ? ' on' : ''}`} title="Nur den Grundbestand verwenden" onClick=${() => activeId && activate(null)}><i></i></button>
                <div class="rb-pk-main static"><b class="rb-pk-name">Nur Grundbestand (SRD)</b><span class="rb-pk-meta"><span>frei lizenzierte Grundregeln</span></span></div>
              </div>
              ${entries.filter((e) => e.camp).map(packCard)}
            </div>` : null}
          <div class="rb-side-h">${cid ? 'Weitere Regelwerke (Bibliothek)' : 'Meine Regelwerke'}</div>
          ${lib === null ? html`<div class="empty"><span class="spinner" /></div>` : entries.filter((e) => !cid || !e.camp).length ? html`<div class="rb-packs">${entries.filter((e) => !cid || !e.camp).map(packCard)}</div>`
            : html`<div class="small faint">${entries.length ? 'Alle deine Regelwerke liegen schon in dieser Kampagne.' : 'Noch keine Regelwerke. Lege eins an oder importiere eine Datei.'}</div>`}
          ${rs.errors.length ? html`<div class="card stack sm"><b class="small">Beim Anwenden übersprungen</b>${rs.errors.slice(0, 8).map((x, i) => html`<div key=${i} class="tiny danger-text">${x}</div>`)}</div>` : null}
        </aside>
        <main class="rb-main">
          ${pack ? html`
            <div class="rb-head">
              <input class="input rb-title" value=${pack.name} onInput=${(e) => { pack.name = e.target.value; touch(); }} />
              <span class="badge">${EDITIONS.find((x) => x.value === pack.edition)?.label}</span>
              ${activeId === pack.id ? html`<span class="badge success">aktiv in dieser Kampagne</span>` : null}
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
              Baue Regelwerke mit eigenen Spezies, Hintergründen, Talenten, Klassen, Unterklassen, Zaubern und Ausrüstung – oder ändere die Grundregeln. Das aktive Regelwerk gilt für diese Kampagne und alle Mitspieler; über Export und Import tauschst du Regelwerke mit anderen Spielleitungen.
            <//>`}
        </main>
      </div>
    </div>
  <//>`;
}
