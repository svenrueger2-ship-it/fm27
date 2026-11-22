# FUSSBALL MANAGER 2027 © BAKUSA – Patch 0.9.0
**Datum:** 21.11.2026 · **Titel:** Das große KI-Update

Die KI läuft komplett offline als Spiellogik. Es gibt keine API und keine laufenden Kosten.

## 1. Vereins-KI (neu: `src/manager/clubAI.js`)
- **Philosophie pro Verein.** Jeder der 158 Vereine bekommt eine:
  - Starensemble
  - Ausbildungsverein
  - Sparkurs
  - Traditionsverein (bevorzugt eigene Landsleute)
  - Datenanalyse (unterbewertete Spieler, auslaufende Verträge)
- **Kaderanalyse wie ein Sportdirektor.** Die KI prüft:
  - Besetzung pro Mannschaftsteil
  - Qualitätslücken in der Startelf
  - alternde Stammspieler
  - auslaufende Verträge
- **Transfers.** Die KI wählt Ziele nach ihrer Philosophie aus und gibt Angebote ab. Der abgebende Verein lehnt ab, kontert oder nimmt an. Schlüsselspieler sind teurer, bei dünner Besetzung wird gar nicht verkauft.
- **Bieterwettkämpfe.** Größere Klubs schnappen Deals weg, am Deadline Day häufiger.
- **Überzählige Spieler.** Sie landen auf der Transferliste, Talente werden an kleinere Klubs verliehen.
- **Trainerkarussell.**
  - Der Druck steigt, wenn ein Verein unter seiner erwarteten Tabellenposition steht, und bei Niederlagenserien.
  - Bei zu viel Druck wird der Trainer entlassen, etwa 28 Entlassungen pro Saison.
  - Der neue Trainer bringt Spielstil und Formation mit und sorgt kurz für einen Aufschwung.
- **Trainerqualität (1–5 ★)** fließt in die simulierten Spiele ein.
- **Angebote für deine Spieler** kommen gezielt von Vereinen, die auf der Position Bedarf haben.

## 2. Match-KI (3D-Engine)
- **KI-Trainer im Spiel.** Er liest Spielstand, Minute, xG und Unterzahl. Dann:
  - wechselt er den Plan (Risiko, Brechstange, Ergebnis verwalten, kompakt stehen)
  - stellt er das System um, z. B. 4-3-3 → 4-1-4-1 bei Führung
  - wechselt er passend offensiv oder defensiv
- **Gute Trainer reagieren früher.** Im Ticker erscheint jeder Plan mit 📋.
- **Spielzustand beeinflusst die Spieler:**
  - Bei Rückstand gehen sie mehr Risiko ein und schießen öfter.
  - Bei Führung spielen sie sicher, der Torwart spielt auf Zeit, an der Eckfahne wird der Ball gehalten.
- **Müdigkeit und Nervosität** in engen Schlussphasen machen Entscheidungen unpräziser. Junge Spieler sind nervöser.
- **Im Sportdirektor-Modus** coacht dieser KI-Trainer auch dein Team.

## 3. Stab & Automatisierung
- **Neuer Bereich „Stab & Posteingang“** mit vier Mitarbeitern: Co-Trainer, Physio, Jugendtrainer und Chefscout. Jeder hat 1–5 ★, ein Gehalt und kann ersetzt werden.
- **Sieben Bereiche**, jeweils mit den Stufen „Ich“, „Vorschlag“ oder „Stab macht“:
  - Aufstellung
  - Training
  - Verträge
  - U19
  - Scouting
  - Angebote
  - Presse
- **Posteingang** mit Vorschlägen, die du mit einem Klick annimmst oder ignorierst. Automatisch erledigte Aufgaben werden protokolliert.
- **Autopilot** im Vorspulen-Menü. Er stoppt bei:
  - neuen Vorschlägen
  - Angeboten
  - Ereignissen
  - längeren Verletzungen
- **Physio:** Spieler werden schneller gesund. **Co-Trainer:** kann Pressekonferenzen übernehmen.

## 4. Champions League mit Gruppenphase
- 32 Teams in 8 Gruppen mit Lostöpfen. Keine zwei Klubs derselben Liga in einer Gruppe, soweit möglich.
- Die Gruppenersten treffen im Achtelfinale auf Gruppenzweite, danach geht es im K.-o.-Modus bis zum Finale.
- Prämien gibt es pro Sieg und Remis in der Gruppe.

## 5. Leihen
- **Eigene Spieler verleihen.** Gastvereine, bei denen der Spieler wirklich spielt, machen bis zu drei Angebote: ohne Option, mit Kaufoption oder mit Kaufpflicht ab 15 Einsätzen.
- **Leihberichte alle vier Wochen.** Neuer Tab „Leihen“ mit Spielen, Toren, Note, Entwicklung und Rolle.
- **Kaufoption und Kaufpflicht** werden am Saisonende automatisch ausgewertet, auch bei eigenen Leihspielern (Kaufpflicht ab 12 Einsätzen).

## 6. Spieler-Interaktionen
- **Gespräche:**
  - Loben
  - Kritisieren
  - Stammplatz versprechen (5/8 Spiele)
  - Einsatzzeit versprechen (3/8)
  - Über die Zukunft sprechen
- **Die Reaktion hängt von der Persönlichkeit ab:** Ehrgeiz, Loyalität, Temperament und Führung.
- **Versprechen werden überprüft.** Ein gebrochenes Versprechen bedeutet Moral −25 und Wechselwunsch, und die Kabine ist verstimmt.
- **Kapitän und Vize.** Ein Kapitän mit hoher Führungsqualität hebt die Moral, ein abgesetzter, ehrgeiziger Kapitän ist sauer.
- **Unzufriedene Spieler** bitten von sich aus um ein Gespräch (💬), wechselwillige Spieler sind mit ✈️ markiert.

## 7. Scouting-Netzwerk
- 2–5 Scouts (je nach Nachwuchszentrum und Chefscout) in 10 Weltregionen, jeweils mit Positions- und Altersfokus.
- Sie decken Spieler auf und schicken alle drei Wochen Empfehlungen.
- In exotischen Regionen ✨ entdecken sie vereinslose Geheimtipps:
  - Südamerika
  - Afrika
  - Skandinavien
  - Osteuropa
  - Asien/Nordamerika

## 8. Stadion
- **Gästeblock** (klein / mit Trennzaun / groß): Zusatzeinnahmen und mehr Stimmung. Im 3D-Stadion wird der Gästebereich entsprechend größer.
- **Familienbereich** (ab Stufe 1): wachsende Fanstimmung und mehr Merchandising. Im 3D-Stadion als bunter Bereich auf der Gegengerade sichtbar.

## 9. Nationalmannschaften & Turniere
- **Weltrangliste (Elo).** Nationalteams werden aus allen Spielern im Spiel gebildet, fehlende Plätze werden auf das reale Niveau aufgefüllt.
- **Vier Länderspielpausen pro Saison** mit Abstellungen, Länderspielen, Toren, Müdigkeit und Verletzungsrisiko. Es gibt News, wer von deinem Verein unterwegs ist.
- **EURO 2028** (24 Teams): am Ende der Saison 2027/28.
- **WM 2030** (48 Teams, Gastgeber Spanien/Portugal/Marokko): am Ende der Saison 2029/30.
- Jeweils mit Gruppenphase, K.-o.-Runden, Torschützenkönig und Titeln, die im Spielerprofil stehen.
- **Neuer Bereich „Fußballwelt“:**
  - Weltrangliste
  - Nationalteams
  - EM & WM
  - Trainerkarussell
  - Vereins-KI-Übersicht

## Behoben
- Die Update-Leiste aus 0.8 hatte kein Design, weil das Stylesheet nicht eingebunden war.
- Die Moral wurde teils mit vielen Nachkommastellen angezeigt.
- Pokal-Prämien zeigten einen 0-€-Eintrag.

## Getestet
- Unit-Tests: 2 komplette Saisons.
- 3 Saisons mit EURO 2028 und Scouting-Netzwerk.
- Champions-League-Saison mit Gruppenphase bis zum Sieger.
- Leihen mit Kaufoption bzw. Kaufpflicht.
- 3D-Spiele mit KI-Trainer: Torschnitt vergleichbar mit der alten KI.
- Klicktest über alle 13 Bereiche ohne Fehler.
- Spielstände bleiben speicherbar (kein Funktionsobjekt im Spielstand).

## Hinweis
Ältere Spielstände funktionieren weiter. Vereins-KI, Stab, Nationalteams und Netzwerk werden beim ersten Spieltag automatisch angelegt. Die Champions League hat erst ab der nächsten Saison eine Gruppenphase.
