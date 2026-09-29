# Lizenzprüfung – Weltenschmiede

Stand: 29.09.2026 · Anlass: möglicher Verkauf der App. Geprüft wurden alle mitgelieferten Daten, Bilder, Symbole,
Bibliotheken und sichtbaren Texte. **Keine Rechtsberatung** – vor einem Verkauf sollte eine Anwältin oder ein Anwalt
für Urheber- und Markenrecht die rot markierten Punkte und den Produktnamen bestätigen.

## Kurzfazit

| Ampel | Bereich | Zustand | Aufwand bis verkaufsfähig |
|---|---|---|---|
| 🟢 | Zauber, Monster, magische Gegenstände, Zustände | nur SRD 5.1/5.2.1 (CC-BY-4.0) | Namensnennung korrigiert (erledigt) |
| 🟢 | Monsterporträts, eigene Kartenbausteine | SDXL 1.0, lokal erzeugt | – |
| 🟢 | Texturen/3D-Modelle Karten | Poly Haven (CC0) | – |
| 🟢 | Symbole | game-icons.net (CC BY 3.0) | Namensnennung vorhanden |
| 🟢 | Bibliotheken | Preact (MIT), htm (Apache 2.0), Firebase SDK (Apache 2.0), Anthropic SDK (MIT) | in `LIZENZEN.md` gelistet |
| 🟢 | Eigene Tabellen, Vorlagen, Demo-Texte, Regelzusammenfassungen | eigene Formulierungen | – |
| 🟢 | Monsternamen-Listen und „Welten“ | Listen entfernt, neutrale Genres, eigene Namenslisten per Import | **erledigt** (29.09.2026) |
| 🟢 | Charaktererschaffung (`js/data/chargen.js`) | nur noch SRD 5.1/5.2.1; alles Weitere über Regelpakete der Spielleitung | **erledigt** (29.09.2026) |
| 🟢 | Markennennungen in der Oberfläche | ersetzt durch „5E-kompatibel“, „Regeln 2014/2024“ | **erledigt** (29.09.2026) |
| 🟡 | Produktname „Weltenschmiede“ | wird bereits anderweitig genutzt | Markenrecherche, Vorschläge unten |

Gesamtaufwand für eine verkaufsfähige Fassung: **etwa 4–6 Arbeitstage**, der größte Teil davon ist der Umbau der
Charaktererschaffung auf „SRD + eigene Inhalte“.

**Stand 29.09.2026:** Die roten Punkte sind umgesetzt. Die App liefert nur noch den SRD-Grundbestand; eigene oder
anderswo gekaufte Regeln bringen Spielleitungen als **Regelpaket** mit (Regelwerk-Editor, Import/Export im Format
`weltenschmiede-regeln`), Kreaturen und Namenslisten ebenso (`weltenschmiede-kreaturen`, `weltenschmiede-namen`).
Was Nutzer selbst eintragen oder importieren, liegt in ihrer Verantwortung – der Editor weist darauf hin. Offen ist
nur noch der Produktname (Abschnitt 4).

## 🔴 1. Monsternamen und Monster-Welten

**Befund**
- `DND_NAMES`: 1 058 deutsche und englische Monsternamen aus offiziellen Büchern **außerhalb des SRD** (Monsterhandbuch,
  Abenteuerbände – darunter benannte Figuren wie „Acererak“), abgerufen über die D3-Schnittstelle von dnddeutsch.de.
  Diese Namen sind „Product Identity“ von Wizards of the Coast und ausdrücklich nicht freigegeben; die Übersetzungen
  gehören zudem den jeweiligen Rechteinhabern.
- `WORLD_NAMES`: rund 1 300 Namen aus acht fremden Marken – The Witcher (222), Herr der Ringe (94), Elder Scrolls (245),
  Dark Souls/Elden Ring (371), Warhammer (132), Game of Thrones (36), Diablo (50), Final Fantasy (169) – aus Fan-Wikis
  (Fandom, meist CC-BY-SA: „Weitergabe unter gleichen Bedingungen“ würde die Datei selbst unter CC-BY-SA zwingen).
- `ORIGINS` bietet genau diese Marken als feste Auswahl („The Witcher“, „Warhammer“ …) im Encounter-Generator und
  als Filter im Bestiarium an.

**Umbau**
- `monsternames.js` und `tools/build-monsternames.mjs` entfernen; Namenssuche nur noch aus den SRD-Monstern und dem
  eigenen Bestiarium.
- `ORIGINS` durch eigene, markenfreie Genres ersetzen (z. B. „Klassische Fantasy“, „Dunkle Fantasy“, „Nordische
  Sagen“, „Slawische Sagen“, „Östliche Mythen“, „Grimdark-Krieg“, „Höllische Mächte“, „Eigene Kreation“). Das freie
  Textfeld bleibt – was Nutzer selbst eintippen, liegt in ihrer Verantwortung.
- Bestehende Monster mit alter Welt-Angabe behalten ihre Bezeichnung (die Farbe wird ohnehin aus dem Namen berechnet).

## 🔴 2. Charaktererschaffung

**Befund** (`js/data/chargen.js`, `js/views/charwizard.js`)

| Inhalt | in der App | davon im SRD | nicht im SRD |
|---|---|---|---|
| Unterklassen 2014 | 104 | 12 | 92 (Xanathar, Tascha, Schwertküste u. a.) |
| Unterklassen 2024 | 48 | 12 | 36 |
| Ausführliche Unterklassen-Texte (`SUBCLASS_DESC`) | 123 Texte, ~29 000 Zeichen | 12 | ~111 |
| Talente mit Regeltext | 78 (~18 000 Zeichen) | 20 | 58 |
| Hintergründe 2014 / 2024 | 13 / 16 | 1 / 4 | 12 / 12 |
| Spezies | Aasimar (2014 + 2024), Goliath (2014) | – | 3 |
| Unterarten 2014 | Waldelf, Dunkelelf, Waldgnom, Robust, Mensch (Variante), Bergzwerg | – | 6 |
| Klassen | Magieschmied (Artificer) mit 4 Unterklassen | – | 1 Klasse |
| Sonstiges | „Eigenes Volk (Tascha-Regel)“, optionale Regel „Taschas Kessel“, Kampfstile Blindkampf/Abfangen/Wurfwaffen/Waffenlos, 3 epische Gaben | – | ja |

SRD 5.1 enthält je Klasse genau **eine** Unterklasse, einen Hintergrund (Tempeldiener) und ein Talent (Ringer).
SRD 5.2.1 enthält je Klasse eine Unterklasse, neun Spezies (ohne Aasimar), vier Hintergründe (Tempeldiener,
Krimineller, Soldat, Weiser) und 17 Talente.

Spielmechanik als solche ist nicht urheberrechtlich geschützt, sehr wohl aber die Texte – und die ausführlichen
Beschreibungen hier folgen den Büchern eng. Auch die Namen vieler Unterklassen sind unverwechselbar mit Wizards
verbunden.

**Umbau (Empfehlung: „SRD + eigene Inhalte“)**
1. Die mitgelieferten Daten auf den SRD-Umfang je Regelstand kürzen (siehe Tabelle).
2. Neuer Bereich **„Eigene Inhalte“** je Kampagne (Sammlung `campaigns/{cid}/content`): Die Spielleitung kann
   Unterklassen, Talente, Hintergründe und Spezies anlegen – mit Merkmalen je Stufe, Auswahlfeldern und Text. Die
   Charaktererschaffung liest diese Einträge genauso wie die SRD-Daten (gleiche Form wie in `chargen.js`).
3. **Import/Export als Inhaltspaket** (JSON). Eure Runde kann damit alles, was ihr aus euren eigenen Büchern nutzt,
   einmal privat einspielen – mitgeliefert wird es nicht. (So machen es auch Foundry, Roll20 und Owlbear Rodeo.)
4. Bestehende Charakterbögen behalten ihre Einträge (Name und Text stehen im Bogen); fehlt die Vorlage, zeigt der
   Bogen sie als „eigener Eintrag“ an.
5. Die bisherigen Daten nicht löschen, sondern als privates Inhaltspaket außerhalb des Produkts sichern – dann
   ändert sich für eure laufende Kampagne nichts.

Alternative wäre, alle Texte in eigenen Worten neu zu schreiben und markante Namen umzubenennen. Das ist mehr Arbeit
und bleibt riskanter (Auswahl und Aufbau der Inhalte folgen weiter den Büchern) – nicht empfohlen.

## 🔴 3. Markennennungen

Die SRD-Lizenz erlaubt **außer der vorgeschriebenen Namensnennung keine weitere Nennung von Wizards** – zulässig ist
nur „kompatibel mit der fünften Edition“ bzw. „5E-kompatibel“. Betroffen (sichtbare Texte, nicht Code-Kommentare):
- „Die Werkstatt für eure D&D-Welt“ (`views/auth.js`), Beschreibung in `index.html` („D&D 5e Kampagnen-Werkstatt“)
- Regelwerk-Auswahl „D&D 5e (2014)/(2024)“ (`views/charwizard.js`, `views/encounter.js`)
- „Standard D&D (5e)“ / „D&D 5e“ (`data/origins.js`), Einladungstext „D&D-Kampagne“ (`views/campaign.js`),
  „D&D-Archiv“ (`ui/aiout.js`)
- „Spielerhandbuch 2014/2024“, „Details im Spielerhandbuch“, „Taschas Kessel“ (`views/charwizard.js`)
- KI-Porträt „im Stil klassischer D&D-Illustrationen (Monster-Handbuch)“ (`views/bestiary.js`)
- Hinweis „„Dungeons & Dragons“ ist eine Marke von Wizards of the Coast – privates Fan-Werkzeug“ (`views/settings.js`)
  – für die heutige private Nutzung sinnvoll, in der Verkaufsfassung aber zu streichen.

Ersetzen durch z. B. „5E-kompatibel“, „Regeln 2014“ / „Regeln 2024“, „Grundregeln“. Die KI-Prompts (`core/prompts.js`)
nennen „Dungeons & Dragons 5e“ nur gegenüber dem KI-Modell – rechtlich unkritischer, aber der Einheitlichkeit halber
ebenfalls auf „5E“ umstellen.

„Obsidian“ (Notizen-Import) und „Baldur's Gate 3“ (nur in Code-Kommentaren) sind unkritisch, solange sie nur
beschreiben, womit etwas kompatibel ist bzw. im Code stehen. In Werbetexten nicht mit fremden Produkten werben.

## 🟡 4. Produktname „Weltenschmiede“

Der Name wird bereits genutzt: u. a. eine andere Rollenspiel-Kampagnen-Webapp namens „Weltenschmiede“, ein
Forenbereich auf fantasy-foren.de und ein Spieleentwickler von 1990. Vor dem Verkauf im DPMA-Register und in TMview
(EUIPO) nach eingetragenen Marken in den Klassen 9, 41 und 42 suchen; ggf. einen unterscheidungskräftigeren Namen
wählen oder den Namen selbst als Marke anmelden.

**Englische Namensvorschläge** (Websuche und DNS-Abfrage am 29.09.2026 – ersetzt keine Markenrecherche in
DPMA, TMview/EUIPO, USPTO und WIPO Global Brand Database, Klassen 9, 41, 42):

| Name | Idee | Funde im Netz | Domains .com / .app / .io |
|---|---|---|---|
| **Tavernwright** | „wright“ = Handwerker; die Taverne als Treffpunkt der Gruppe | keine | alle frei |
| **Hexhearth** | Hex (Karten, Magie) + Herd (Runde am Tisch) | nur ein Instagram-Konto „Hex & Hearth“ (Briefpapier) | alle frei |
| **Sagahearth** | Sagen am Lagerfeuer | keine | alle frei |
| **Mythhearth** | Mythen am Herd | keine | alle frei |
| **Sigilwright** | Siegel-Schmied | keine; aber „Sigil“ ist auch eine Stadt eines bekannten Rollenspiel-Settings – eher meiden | alle frei |
| Realmhearth | Reich + Herd | Begriff aus einer Web-Novel | .com frei |

Bereits vergeben bzw. zu nah an bestehenden Produkten: Worldforge, Realmwright (Worldbuilding-App), Loresmith,
Lorewright, Questsmith, Sagaforge (KI-Spielleiter), Mythwright, Tomewright, Loreloom, alles mit „Anvil“ (World Anvil).

## 🟢 5. Was sauber ist – und warum

- **Zauber**: genau 319 (SRD 5.1) bzw. 339 (SRD 5.2.1) Zauber aus den offiziellen deutschen SRD-Fassungen.
- **Monster und magische Gegenstände**: 317 Monster und die magischen Gegenstände aus dem deutschen SRD 5.1
  (maschinenlesbar aufbereitet von openrpg.de).
- **Bilder**: Monsterporträts und eigene Kartenbausteine wurden lokal mit Stable Diffusion XL 1.0 (Stability AI,
  Lizenz CreativeML Open RAIL++-M) erzeugt – die Ergebnisse dürfen kommerziell genutzt werden, die Prompts nennen
  keine Künstler oder fremden Werke. Hinweis: KI-Bilder sind in der EU in der Regel nicht urheberrechtlich
  geschützt – Mitbewerber dürften sie also ebenfalls verwenden. Freistellung mit rembg/BiRefNet (MIT), Bewertung mit
  OpenAI CLIP (MIT); beide werden nicht mitgeliefert.
- **Kartenbausteine**: Poly Haven (CC0). Eigene Pakete (Forgotten Adventures, Crosshead …) werden nur lokal beim
  Nutzer gespeichert und nie mitgeliefert – so muss es bleiben.
- **Symbole**: game-icons.net, CC BY 3.0 – kommerziell erlaubt, Namensnennung (inkl. Hinweis auf Änderungen) steht
  unter Einstellungen → Über.
- **Namensnennung SRD**: seit dieser Prüfung im exakt vorgeschriebenen Wortlaut für SRD 5.1 und 5.2.1
  (`SRD51_ATTRIBUTION`, `SRD521_ATTRIBUTION` in `js/data/rules5e.js`).

## Außerhalb des Urheberrechts, aber vor einem Verkauf nötig

- Impressum und Datenschutzerklärung (DSGVO), Auftragsverarbeitungsverträge mit Google (Firebase) und Cloudflare.
- Nutzungsbedingungen (Nutzerinhalte, KI-Schlüssel der Nutzer, Haftung).
- Prüfen, ob die Firebase-Tarife und Cloudflare-Bedingungen zum geplanten Geschäftsmodell passen.

## Regeln für neue Funktionen

1. Regelinhalte nur aus SRD 5.1/5.2.1 (deutsche Fassungen) oder selbst erfunden – nie aus Spielerhandbuch,
   Monsterhandbuch, Spielleiterhandbuch, Erweiterungs- oder Abenteuerbänden, auch nicht „nur die Namen“.
2. Keine Namen, Orte, Figuren oder Begriffe aus fremden Welten und Marken (Forgotten Realms, Witcher, Warhammer …) in
   mitgelieferten Daten oder festen Auswahllisten.
3. Sichtbare Texte: „5E-kompatibel“ statt „D&D“; keine weitere Nennung von Wizards außer der Namensnennung.
4. Bilder: selbst erzeugt (SDXL lokal) oder CC0; CC-BY nur mit Namensnennung; niemals Bilder aus dem Netz,
   aus Büchern oder Spielen übernehmen, keine Künstlernamen in Prompts.
5. Neue Bibliotheken nur mit freier Lizenz (MIT, Apache, BSD, CC0) und Eintrag in `LIZENZEN.md`.
6. Daten aus Fan-Wikis (Fandom & Co.) nicht übernehmen – CC-BY-SA und fremde Marken.
