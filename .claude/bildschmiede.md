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
Die 41 Kartenobjekte aus Runde 18 wurden damit neu erzeugt: Auftrag `tools/sdxl/jobs-flux-objekte.json`, Ergebnis
`C:\Users\dorer\KI-Bilder\auftraege\2026-10-02-weltenschmiede-objekte\fertig\object\`.

## Aufträge
- Auftragslisten bleiben im Repo unter `tools/sdxl/jobs-*.json` (werden mitgesichert). Das alte Format
  (`id, name, en, look, neg, fill, kind, cat, w, h, block, rough, layer`) versteht `schmiede.py` direkt; die Zusatzfelder
  braucht `import.py`. Bei neuen Aufträgen `art`/`motiv` dürfen zusätzlich stehen.
- Porträts: `node tools/build-portrait-jobs.mjs` → `tools/sdxl/portraits.json` (look/neg/frame aus dem Werteblock,
  `SONDERFALL` für Einzelfälle) – `schmiede.py` liest die Datei direkt (`--nur id,…` für einzelne Monster).
- Was eine Szene wirklich braucht, vorher aus dem Code ableiten (z. B. welche Läden/Gebäude der Stadtgenerator setzt:
  `js/views/mapgen.js`), nicht raten.

## Sichten im Zusammenhang
Kartenobjekte werden auf Kartengrau gezeigt; vor der Freigabe zusätzlich neben vorhandenen Stempeln prüfen
(`tools/sdxl/sheet.py` oder auf einer echten Karte im Browser – Preview „weltenschmiede“, `#/offline`). Strichstärke,
Sättigung und Licht müssen zu den Poly-Haven-Stempeln und den prozeduralen `p:`-Teilen passen.

## Übernahme (nach Freigabe durch den Nutzer)
Arbeitsverzeichnis für die Import-Skripte ist `tools/sdxl` (sie schreiben `gen-assets.json` relativ dazu).
1. Kartenobjekte/Texturen: in `tools\sdxl`: `PY import.py --jobs <jobs.json> --src <ordner>\fertig [--only <ids>]` (liest
   `fertig\object\` bzw. `fertig\texture\`; ohne `--src` vorher nach `tools\sdxl\out\object|texture\` kopieren), dann
   `node tools/build-mapassets.mjs`.
   Neue Stempel: Höhe in `HOEHE` (`js/views/maprender.js`), Platz in den Generatoren (`js/views/mapgen.js`, immer über
   `ids(/^name$/)`).
2. Porträts: `<ordner>\fertig\portrait\*.png` → `tools\sdxl\out\portrait\`, dann `PY import-portraits.py --only <ids> --force`
   (erzeugt Hochformat, quadratischen Token-Ausschnitt `q/` und `js/data/portraits.js`).
3. Kommt ein Modell für ausgelieferte Bilder dazu (eingetragen sind FLUX.2 klein 4B und SDXL 1.0): `docs/LIZENZPRUEFUNG.md`
   (Tabelle + Abschnitt „Bilder“) und `LIZENZEN.md` um Modell, Lizenz und Link ergänzen.
4. Testen und veröffentlichen wie in `CLAUDE.md` beschrieben (der Nutzer hat eine Dauerfreigabe für das Veröffentlichen).
