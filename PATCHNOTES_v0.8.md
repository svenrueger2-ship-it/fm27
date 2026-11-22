# FUSSBALL MANAGER 2027 © BAKUSA – Patch 0.8.0
**Datum:** 21.11.2026 · **Titel:** Pokale, Sportdirektor, Jugend & Auto-Update

## Neu
- **Nationale Pokale:**
  - DFB-Pokal und FA Cup mit 64 Teams. Im DFB-Pokal haben die Unterklassigen Heimrecht.
  - Copa del Rey, Coppa Italia und Coupe de France mit 32 Teams.
  - Verlängerung, Elfmeterschießen und Prämien pro Runde.
- **Europapokal:** Champions League und Europa League mit je 16 Teams.
  - Die Qualifikation läuft über die Vorjahrestabelle, in der ersten Saison über das Renommee.
  - Hin- und Rückspiel bis zum Finale.
- **Pokal-Bildschirm „Pokale & Europa"** mit Turnierbaum, Ergebnissen und Siegern. Die Vereinszentrale zeigt das nächste Pokalspiel.
- **Sportdirektor-Modus:** Du wählst ihn beim Spielstart.
  - Ein KI-Trainer stellt auf, wählt Taktik und Formation und wechselt im Spiel aus.
  - Du machst Kader, Transfers und Finanzen.
  - Den Trainer kannst du feuern (Abfindung) und einen neuen einstellen.
  - Der Trainer beeinflusst auch das Training.
- **U19-Nachwuchs** (Kader → Tab „🌱 U19"):
  - 12+ Talente mit Potenzial, die sich jede Woche entwickeln.
  - Das Nachwuchszentrum-Level bestimmt Stärke, Potenzial und Größe des Jahrgangs.
  - „Hochziehen" bringt einen Spieler in den Profikader (3-Jahres-Vertrag, max. 32 Profis), „✕" entlässt ihn.
  - Am Saisonende gibt es eine U19-Liga-Platzierung, einen neuen Jahrgang und eine News. Wer 20 wird, verlässt die U19.
- **Auto-Update-Launcher:**
  - Die Windows-Version gibt es jetzt auch als Installer.
  - Er prüft beim Start (und alle 4 h) auf GitHub nach neuen Versionen, lädt sie im Hintergrund und installiert sie beim Neustart.
  - Unten im Spiel erscheint eine Leiste mit dem Button „Jetzt neu starten".

## Verbessert
- **Marktwerte:** Sie hängen jetzt von Alter, Potenzial, Liga, Position, Vertragslaufzeit, Form/Statistik und Verletzungen ab und werden wöchentlich neu berechnet. Beispiele:
  - Haaland ≈ 188 Mio.
  - Wirtz ≈ 163 Mio.
  - Yamal ≈ 146 Mio.
  - Kane (33) ≈ 50 Mio.
  - Neuer (40) ≈ 6,5 Mio.
  - Median Bundesliga ≈ 5,4 Mio., 2. Liga ≈ 0,7 Mio., 3. Liga ≈ 0,1 Mio.
- **Ablösesummen** basieren auf dem neuen Marktwert, auslaufende Verträge machen Spieler günstig.
- **3. Liga:** 2 direkte Aufsteiger plus Relegation.

## Behoben
- Nachwuchsspieler landeten direkt im Profikader (der Kader wurde jedes Jahr größer).
- Die Vereinszentrale zeigte „Manager: Manager". Jetzt steht dort „Du" bzw. „Sportdirektor · Trainer: …".
- Die Auto-Aufstellung im Taktik-Bildschirm konnte im Sonderfall einen Fehler auslösen.
- In der Pokalsieger-News stimmten die Artikel nicht („den DFB-Pokal" / „die Champions League").

## Getestet
- Unit-Tests: 2 komplette Saisons laufen durch.
- Pokale: alle 7 Wettbewerbe haben einen Sieger.
- Klicktest über alle Screens ohne Fehler.
- U19-Saisontest mit Bayern und Schalke.

---

## So richtest du den Auto-Update-Launcher ein (einmalig)
1. Leg auf GitHub ein Repo an (z. B. `fussball-manager-2027`) und lade den Projektordner hoch.
2. Trag dein Repo ein: `node tools/setRepo.mjs DEINNAME/fussball-manager-2027`
3. Neue Version veröffentlichen:
   - Erhöhe in `desktop/package.json` die `version` (z. B. 0.8.1).
   - Dann ausführen: `git tag v0.8.1 && git push --tags`
   - Der GitHub-Workflow (`.github/workflows/release.yml`) baut auf einem Windows-Server Installer + portable .exe und veröffentlicht sie als Release.
4. Spieler installieren einmal `FussballManager2027-BAKUSA-Setup-x.y.z.exe`. Ab dann aktualisiert sich das Spiel selbst.

**Hinweise:**
- Die portable .exe kann sich nicht selbst aktualisieren, das geht nur mit der installierten Version.
- Spielstände bleiben bei Updates erhalten.
- Ohne Code-Signatur zeigt Windows beim ersten Installieren „Der Computer wurde durch Windows geschützt". Dann auf „Weitere Informationen → Trotzdem ausführen" klicken.
