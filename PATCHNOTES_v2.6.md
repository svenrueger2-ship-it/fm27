# FUSSBALL MANAGER 2027 © BAKUSA – Patch 2.6.0 „Der neue Launcher"
**Datum:** 22.11.2026 · **Vorgänger:** 2.5.0

## Neu – der Launcher (Windows-Version)
Beim Start öffnet sich jetzt ein eigenes Launcher-Fenster, bevor das Spiel lädt.

**Hintergrund**
- Ein live gerendertes Nachtstadion, als einzelner Grafikkarten-Shader. Dafür werden keine Bilddateien gebraucht.
- Vier Flutlichtmasten mit schwenkenden Lichtkegeln und Staub im Licht.
- Ränge mit Handylichtern und zufälligen Blitzlichtern, Rasen mit Mähstreifen und Linien.
- Bokeh-Lichter in deinen Vereinsfarben. Das Bild bewegt sich leicht mit der Maus (Parallax).
- Bei schwacher Grafikkarte senkt sich die Auflösung automatisch. Die Animation lässt sich auch ganz abschalten.

**Vereinsfarben:** Der Launcher übernimmt die Farbe deines zuletzt gespielten Vereins. Bei sehr hellen Farben wie BVB-Gelb wird die Schrift automatisch dunkel.

**Spielen-Knopf**
- Animierter Rand und ein Lichtschein, der der Maus folgt. Der Knopf bewegt sich leicht zur Maus hin.
- Beim Klick gibt es Anpfiff: zwei kurze und ein langer Pfiff, anschwellender Jubel, Kamerafahrt ins Stadion und ein Weißblitz.

**Weiterspielen:** Der letzte Spielstand mit Wappen, Saison, Spieltag und Zeitpunkt. Ein Klick startet direkt in deinem Verein.

**Bereiche**
- **Neuigkeiten:** das aktuelle Update als Titelkarte zum Aufklappen und frühere Versionen. Unten läuft ein TV-Laufband mit allen Neuerungen.
- **Spielstände:** alle Speicherplätze mit Liga, Saison und Datum. Jeder lässt sich direkt starten.
- **Einstellungen:** Grafikqualität, Lautstärke, Vollbild beim Start, Launcher-Sounds, animierter Hintergrund und Rückkehr zum Launcher nach dem Spiel.
- **Info:** Tastenkürzel, Technik, Electron-Version und ein Link zu den Releases.

**Update-Anzeige:** Die Suche nach Updates und der Download laufen sichtbar mit.
- Der Fortschritt füllt den Spielen-Knopf.
- Ist das Update fertig, wird der Knopf golden und pulsiert: „UPDATE“. Ein Klick installiert und startet neu.

**Sonstiges**
- Statistik-Leiste mit Spielständen, Erfolgen (x/36), Manager-Level und Version.
- Eigene Fensterleiste mit Minimieren und Schließen. Enter startet das Spiel.

## Verbessert
- „Beenden" im Spiel schließt das Spielfenster und bringt dich zurück zum Launcher. Das lässt sich abschalten.
- Spielstände speichern jetzt Vereinsfarben, Kürzel, Liga und Manager-Level. Ältere Spielstände zeigen ein neutrales Wappen, bis du sie einmal neu speicherst.
- Der GitHub-Build nutzt jetzt Node 22. Die Warnung zu Node 20 ist damit weg.

## Hinweise
- Den Launcher gibt es nur in der Windows-Version. Die Browser-Version (Artifact) startet wie bisher direkt ins Spiel.
- Getestet:
  - In echtem Electron (unter Linux): Launcher öffnen, Spielen, Spielfenster, Beenden und Rückkehr zum Launcher.
  - Im Browser: alle Tabs und Zustände (Update lädt / Update bereit / Anpfiff).
  - Unit-Tests und Klicktest des Spiels ohne Fehler.
- Ob der Launcher unter Windows genauso aussieht, habe ich nicht getestet. Den Sound konnte ich nicht anhören, nur prüfen, dass er ohne Fehler läuft.
