# Projektprofil Weltenschmiede für die Bildschmiede

Gilt für den nutzerweiten Skill `bildschmiede` (Werkstatt `C:\Users\dorer\KI-Bilder`). Die Weltenschmiede soll verkäuflich
bleiben: **immer `--modus lizenzsauber`**, nie Bilder aus `KI-Bilder\privat`. Regeln: `docs/LIZENZPRUEFUNG.md` – nur SRD-
Inhalte oder Eigenes, keine Marken („D&D“, „Monster Manual“ …), keine Nicht-SRD-Wesen, keine Künstler.

```
PY = C:\Users\dorer\KI-Bilder\.venv\Scripts\python.exe
S  = C:\Users\dorer\KI-Bilder\schmiede\schmiede.py
```

## Was die App braucht

| Bedarf | Art | Modell | Stil | Übernahme |
|---|---|---|---|---|
| Kartenobjekte (Stempel) | `objekt` | **FLUX.2 klein 4B** | `karte-gemalt` – **gemalt, nie fotorealistisch** | `assets/stamps/` über `tools/sdxl/import.py` |
| Bodentexturen | `textur` | **FLUX.2 klein 4B** | `foto-material` (passt zu den Poly-Haven-Texturen), immer mit `massstab` | `assets/tex/` über `tools/sdxl/import.py` |
| Monster-, NPC-, Charakterporträts | `portraet` (3:4) | **FLUX.2 klein 4B** | **`fantasy-dunkel`** | `assets/portraits/` über `tools/sdxl/import-portraits.py` |
| Szenen, Handouts, Gegenstandsbilder | `szene` / `gegenstand` | **FLUX.2 klein 4B** | **je Auftrag** – der Nutzer will den Stil jedes Mal selbst wählen: zwei Stile zur Wahl erzeugen | noch kein fester Ort – mit dem Nutzer klären (Bestiarium/NPC: eigenes Bild `m.image` über `core/files.js`) |

Entscheidungen aus den Modellvergleichen (2026-10-02/03, `KI-Bilder\vergleiche\runde1`, `runde2`, `runde2c`), festgehalten in
`modelle.json` → `bevorzugt.lizenzsauber` und `vergleiche`: FLUX.2 klein für alles, Z-Image-Turbo nur Reserve, SDXL raus.
Damit neu erzeugt und live (2026-10-03) – seitdem liefert die App kein SDXL-Bild mehr aus:
- 41 Kartenobjekte: Auftrag `tools/sdxl/jobs-flux-objekte.json`, Ergebnis `KI-Bilder\auftraege\2026-10-02-weltenschmiede-objekte`
- 8 Bodentexturen: `tools/sdxl/jobs-flux-texturen.json` → `KI-Bilder\auftraege\2026-10-03-weltenschmiede-texturen`
- 317 Monsterporträts: `tools/sdxl/jobs-flux-portraets.json` → `KI-Bilder\auftraege\2026-10-03-weltenschmiede-portraets`
  (Wahl, Fehlerfälle, Signatur-Ersatz und Retuschen in `sichtung.json`)

## Aufträge
- Auftragslisten bleiben im Repo unter `tools/sdxl/jobs-*.json` (werden mitgesichert). Das alte Format
  (`id, name, en, look, neg, fill, kind, cat, w, h, block, rough, layer`) versteht `schmiede.py` direkt; die Zusatzfelder
  braucht `import.py`. Bei neuen Aufträgen `art`/`motiv` dürfen zusätzlich stehen.
- Porträts: `tools/sdxl/flux-portraet-auftrag.py tools/sdxl` schreibt `jobs-flux-portraets.json` – je Wesen ein eigener
  Beschreibungssatz mit Körperbau (Tabelle `L` im Skript), Bildausschnitt (`RAHMEN`: „the whole shape“, wenn der Körperbau
  das Wesen ausmacht) und Blickrichtungen (`ANSICHTEN`, Vierbeiner/Schlangen von der Seite). Korrekturen dort eintragen,
  dann neu schreiben und mit `PY S erzeugen … --nur id,… --ordner <porträtordner>` nachlaufen lassen (Kandidaten werden
  angehängt). `tools/sdxl/portraits.json` (aus `node tools/build-portrait-jobs.mjs`) liefert nur noch Namen, Typ und Größe.
  Lehren aus den Rückmeldungen des Nutzers: `KI-Bilder\schmiede\PROMPTS.md` → „Porträts“.
- Was eine Szene wirklich braucht, vorher aus dem Code ableiten (z. B. welche Läden/Gebäude der Stadtgenerator setzt:
  `js/views/mapgen.js`), nicht raten.

## Sichten im Zusammenhang
Kartenobjekte werden auf Kartengrau gezeigt; vor der Freigabe zusätzlich neben vorhandenen Stempeln prüfen
(`tools/sdxl/sheet.py` oder auf einer echten Karte im Browser – Preview „weltenschmiede“, `#/offline`). Strichstärke,
Sättigung und Licht müssen zu den Poly-Haven-Stempeln und den prozeduralen `p:`-Teilen passen.

## Übernahme (nach Freigabe durch den Nutzer)
**Nur aus dem Hauptcheckout** `C:\Users\dorer\Documents\Weltenschmiede` importieren, nie aus einem Worktree – die
Import-Skripte schreiben in das Repo, in dem sie liegen. Arbeitsverzeichnis ist dort `tools/sdxl` (sie schreiben
`gen-assets.json` relativ dazu).
1. Kartenobjekte/Texturen: in `tools\sdxl`: `PY import.py --jobs <jobs.json> --src <ordner>\fertig [--only <ids>]` (liest
   `fertig\object\` bzw. `fertig\texture\`; ohne `--src` vorher nach `tools\sdxl\out\object|texture\` kopieren), dann
   `node tools/build-mapassets.mjs`.
   Neue Stempel: Höhe in `HOEHE` (`js/views/maprender.js`), Platz in den Generatoren (`js/views/mapgen.js`, immer über
   `ids(/^name$/)`).
2. Porträts: in `tools\sdxl`: `PY import-portraits.py --jobs jobs-flux-portraets.json --src <ordner>\fertig [--only <ids>] --force`
   (liest `fertig\portrait\`, erzeugt Hochformat, quadratischen Token-Ausschnitt `q/` – bei `rahmen` „the whole shape“
   mittig statt oben – und `js/data/portraits.js` samt Cache-Fingerabdruck `PORTRAIT_V`).
3. Kommt ein Modell für ausgelieferte Bilder dazu (eingetragen ist FLUX.2 klein 4B): `docs/LIZENZPRUEFUNG.md`
   (Tabelle + Abschnitt „Bilder“) und `LIZENZEN.md` um Modell, Lizenz und Link ergänzen.
4. Testen und veröffentlichen wie in `CLAUDE.md` beschrieben (der Nutzer hat eine Dauerfreigabe für das Veröffentlichen).
