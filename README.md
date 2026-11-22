# Ultimate Football Manager 3D – Version 0.2

Browsergame (HTML5, JavaScript-ES-Module, Three.js/WebGL, IndexedDB).

## Starten

- **Sofort spielen:** `dist/index.html` im Browser öffnen (eine einzige Datei, läuft offline und auf jedem Webserver).
- **Entwickeln:**
  ```bash
  npm install
  npm run build      # erzeugt dist/index.html
  npm test           # Headless-Test: simuliert 4 komplette 3D-Partien ohne Grafik
  node tests/press.js "Hohes Pressing" "Mauern"   # Taktikvergleich über 6 Partien
  ```

## Architektur (`src/`)

| Ordner | Inhalt |
|---|---|
| `core/` | Seed-Zufallsgenerator, Event-Bus |
| `data/` | Ligen & fiktive Vereine, Namenspools, Attribute/Positionen, Welt- & Spielergenerator |
| `manager/` | Spielplan (Hin-/Rückrunde), Tabellen, Schnellsimulation der KI-Spiele, Spieltag/Saisonwechsel, Auf-/Abstieg, Alterung, Jugendspieler |
| `match/` | **Match-Engine ohne Grafik**: Ballphysik, Spielerphysik, KI, Taktiken, Standards, Karten, Wechsel |
| `render/` | Three.js: Stadion, prozedurale Spielermodelle + Animationen, Kamerasystem, Renderer |
| `storage/` | IndexedDB-Spielstände (3 Slots + Autosave), Einstellungen |
| `ui/` | App-Shell, Bildschirme (Menü, Vereinszentrale, Kader, Spielerprofil, Taktik, Liga, Spieltag/Live-Spiel, Spielstände, Einstellungen) |

Die Match-Engine liest dieselben Spielerobjekte und Attribute wie der Managerbereich und schreibt Ergebnis, Tore, Karten, Verletzungen und Fitness zurück. Der Renderer liest nur den Engine-Zustand – die Simulation läuft identisch mit Grafik, im Hintergrund („Sofort“) oder headless in Node.

## Was funktioniert

**Manager (Phase 1):** 8 Ligen (Bundesliga, 2. Bundesliga, 3. Liga, Premier League, Championship, La Liga, Serie A, Ligue 1), 158 fiktive Vereine, ca. 3.800 generierte Spieler mit 15 Feld- und 5 Torwartattributen, Potenzial, Marktwert, Gehalt, Vertrag, Fitness, Moral, Form, Persönlichkeit und Aussehen. Vereinsauswahl, Vereinszentrale, sortierbarer Kader, Spielerprofil mit Radar, Taktik-Editor (6 Formationen, 5 Spielstile, 7 Regler, Abseitsfalle, Aufstellung per Antippen), Tabellen/Spielplan/Torjäger aller Ligen, Spieltage für alle Ligen, Saisonabschluss mit Auf-/Abstieg, Spielstände.

**3D-Spiel:** Stadion (Markierungen, Tore mit Netz, Eckfahnen, Werbebanden, Tribünen mit Zuschauern, Dächer, Flutlichtmasten, Trainerbänke, Coaching-Zonen, Spielertunnel; Größe nach Kapazität). 22 Spieler mit Trikotfarben, Nummern, Größe, Haut- und Haarfarbe, Torwartkleidung. Prozedurale, überblendete Animationen (Gehen, Laufen, Sprint, Rückwärts, Seitwärts, Dribbling, Pass, langer Ball, Flanke, Schuss, Kopfball, Tackling, Grätsche, Ballannahme, Einwurf, Paraden, Fangen, Jubel, Frust, Verletzung, Auswechslung). Ballphysik mit Luftwiderstand, Effet (Magnus), Aufsprung, Rollreibung, Pfosten/Latte, Netz, Torlinie. KI mit Formationsblock, Pressing, Deckung, Abwehrlinie/Abseitsfalle, Freilaufen, Läufen in die Tiefe, Pass-/Schuss-/Dribbelbewertung, Torwartstellung und Paraden. Standards (Anstoß, Einwurf, Ecke, Abstoß, Freistoß mit Mauer, Elfmeter), Fouls, Karten, Verletzungen, Abseits, Nachspielzeit, Halbzeit, 5 Wechsel. 6 Kameras, Zoom/Höhe/Tempo, 1x–8x, Highlights, Sofort, Vollbild, Spielerauswahl per Antippen, Taktikänderung im Spiel, 4 Grafikstufen.

## Bekannte Grenzen (bewusst für spätere Phasen)

- Statistik pro Partie im Schnitt etwa 1,5 Tore, 8 Schüsse, rund 62 % angekommene Pässe – Feintuning folgt in Phase 8.
- Spiel-Uhr läuft 9× schneller als die Physik (90 Minuten ≈ 10 Minuten bei 1x).
- Transfers, Training, Finanzen, Scouting, Jugend, Pokale: Phase 6/7 (keine Platzhalter-Buttons in der UI).
- Prozedurale Spielermodelle; `render/playerModel.js` ist austauschbar gegen glTF-Modelle mit Skinning.

## Version 0.2 (Transfer-, Trainings- & Grafik-Update)
Neu: `manager/economy.js` (Finanzen, Ausbau), `manager/training.js` (wöchentliche Entwicklung), `manager/transfers.js` (Markt, Scouting, Leihen, Verträge, KI-Transfers), `manager/migrate.js` (Spielstand-Migration), `render/kitTexture.js`, `render/menuScene.js`, Post-Processing/Wiederholungen in `render/matchView.js`, neue Screens `transfers.js`, `finance.js`, `training.js`.
Tests: `node tests/sim.test.js 8`, `node tests/season.test.js`, `node tests/economy.test.js`. Vollständige Änderungen: `PATCHNOTES_v0.2.md` (BBCode: `PATCHNOTES_v0.2_BBCode.txt`).
