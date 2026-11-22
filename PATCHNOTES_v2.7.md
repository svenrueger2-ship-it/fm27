# FUSSBALL MANAGER 2027 © BAKUSA – Patch 2.7.0 „Live-Updates, echte Wappen & neue Einstellungen"
**Datum:** 22.11.2026 · **Vorgänger:** 2.6.0

## Neu

### Live-Updates
Neue Versionen kommen ohne Installer, ohne Neuinstallation und ohne Klick. Das gilt auch für die portable .exe.
- **Wann geprüft wird:** beim Start des Launchers und danach alle 10 Minuten.
- **Wie es abläuft:**
  - Spiel und Launcher werden geladen. Der Fortschritt läuft live im Spielen-Knopf mit.
  - Jede Datei wird per SHA-256-Prüfsumme kontrolliert. Bei Problemen bleibt einfach die alte Version aktiv.
  - Danach lädt sich der Launcher selbst neu und zeigt „✓ Auf Version … aktualisiert".
- **Gespeichert** wird das im Benutzerordner. Es bleibt immer nur die aktuelle Version liegen.

### Update-Zwang
- **Im Launcher:** Spielen startet erst, wenn die Update-Prüfung und ein eventuelles Update fertig sind. Ein Klick während des Updates wird gemerkt, und das Spiel startet automatisch danach. Ohne Internet geht es nach spätestens 9 Sekunden trotzdem los.
- **Im laufenden Spiel:** Ein 3-Sekunden-Countdown, dann wird automatisch gespeichert, und das Spiel macht in der neuen Version an derselben Stelle weiter. Ein laufendes 3D-Spiel wird nie unterbrochen. Das Update folgt direkt nach dem Abpfiff.
- **App-Updates** (nur wenn sich die Fenster-Technik ändert) installieren sich jetzt still im Hintergrund und starten neu. Läuft gerade ein Spiel, passiert das nach dem Beenden.

### Echte Wappen
- Echte Wappen für 78 Vereine: Premier League (20), La Liga (20), Serie A (20) und Ligue 1 (18).
- Sie erscheinen in Vereinsauswahl, Tabellen, Menüs, auf Trikots und auf den Stadion-Leinwänden. Insgesamt hat das Spiel damit 114 echte Wappen.
- Der Launcher zeigt beim Weiterspielen das echte Wappen deines Vereins. Das gilt ab dem nächsten Speichern.

### Neues Einstellungsmenü im Spiel
Das Menü hat jetzt 5 Bereiche als Tabs, die Schalter sind im modernen Look.
- **Anzeige:** Vollbild umschalten, „Im Vollbild starten", Größe der Oberfläche (85–125 %), Farbschema, Hell/Dunkel, Animationen, Saison-Story, Meldungen für Erfolge und Level-Ups.
- **3D-Spiel:** Grafik, Standard-Geschwindigkeit und -Kamera sowie diese Schalter: Wiederholungen nach Toren, Wetter-Effekte, Pyrotechnik, VAR, Kommentarzeile, Bauchbinden, Konferenz-Meldungen und FPS-Anzeige.
- **Ton:** Gesamtlautstärke, Fan-Atmosphäre (0–150 %), Fangesänge, Stadionsprecher, Kommentar vorlesen.
- **Spielablauf:** Autosave, automatische Auswechslungen.
- **Daten:** Spielstand exportieren und importieren (.fm27-Datei, z. B. für einen anderen PC), Erfolge zurücksetzen, Einstellungen zurücksetzen.

## Behoben
- Vollbild startet jetzt zuverlässig, wenn es im Launcher ausgewählt ist. Unter Windows wurde es vorher vor dem Anzeigen des Fensters gesetzt und dabei ignoriert.
- Neuigkeiten im Launcher werden nicht mehr abgeschnitten. Jeder Punkt zeigt die Überschrift fett und darunter den vollständigen Text. Frühere Updates zeigen alle Punkte.

## Wichtig – einmalig
Die Live-Update-Technik steckt in der App selbst. Deshalb musst du **einmal** den Release mit Haken bei **„App neu bauen"** starten. Danach braucht es das praktisch nie wieder: Für neue Versionen reicht „Run workflow" ohne Haken, das dauert nur rund 1 Minute.

## Getestet
- In echtem Electron mit einem lokalen Test-Server:
  - Update beim Start mit langsamem Download.
  - Spielen-Klick während des Updates: Das Spiel startet automatisch danach in der neuen Version.
  - Update während das Spiel läuft: Countdown, Speichern, Neustart in der neuen Version.
- Vollbild-Start in Electron: Das Spielfenster füllt den ganzen Bildschirm.
- Offline-Start mit Update-Zwang: Spielen öffnet nach dem Timeout.
- Alle neuen Einstellungen per Screenshot geprüft. Größe und Wiederholungen werden gespeichert.
- Unit-Tests und Klicktest ohne Fehler.
- Die Wappen habe ich in allen vier Ligen per Screenshot geprüft.
- **Nicht getestet:** der Weg über den echten GitHub-Server und das stille App-Update unter Windows. Das sehen wir beim ersten echten Update.
