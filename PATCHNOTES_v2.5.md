# FUSSBALL MANAGER 2027 © BAKUSA – Patch 2.5.0 „Modern Update"
**Datum:** 22.11.2026 · **Vorgänger:** 2.0.0

## Neu

### Saison-Story & Zeremonien
- **Saison-Story:** Am Saisonende läuft ein animierter Rückblick im Story-Format, mit Fortschrittsbalken und Vereinsfarben.
  - Folien: Platzierung mit Punkteverlauf, Torjäger, Spieler der Saison, höchster Sieg, Transfers, Titel und Trainer-Ruf.
  - Bedienung: Antippen blättert weiter, Gedrückthalten pausiert. Pfeiltasten und Esc funktionieren auch.
- **Pokal-Zeremonie:** Meisterschaft und Pokalsiege werden mit Trophäe, Wappen und Konfetti in Vereinsfarben gefeiert.

### Look & Feel
- **Vereinsfarben-Theme:** Akzentfarben, Buttons, Balken und Rahmen übernehmen die Farbe deines Vereins.
  - Bei schwarz-weißen Vereinen bleibt Violett.
  - In den Einstellungen kannst du auf „Klassisch Violett" zurückschalten.
- **Heller Modus:** als Alternative zum dunklen Design. Die Top-Leiste und das 3D-Spiel bleiben dunkel.
- **Animierte Übergänge:**
  - Seiten und Karten gleiten herein.
  - Zahlen wie Kontostand und Kennzahlen zählen hoch.
  - Primär-Buttons haben einen Farbverlauf.
  - Alles abschaltbar.

### Analyse & Scouting
- **Analyse-Hub (neuer Menüpunkt):**
  - Kennzahlen pro Spiel: Punkte, Tore, Gegentore, xG für und gegen, Ballbesitz und Form.
  - Saisonverlauf: Tabellenplatz je Spieltag sowie Tore und Gegentore als Balken.
  - Saison-Heatmap, Schusskarte mit xG-Bilanz (über oder unter Erwartung) und Passnetz. Diese Daten sammeln sich aus allen Spielen, die du in 3D schaust, auch wenn du sie mit „Sofort" zu Ende simulierst.
  - Leistungsträger-Tabelle und Saisonvergleich der letzten Jahre.
- **Entwicklungsprognose:** Gescoutete Spieler zeigen im Spielerprofil eine Kurve der erwarteten Stärke für die nächsten 6 Jahre.
  - Dazu ein Band für die Spanne nach oben und unten und der erwartete Höhepunkt.
  - Die Prognose berücksichtigt Alter, Potenzial, Trainingsgelände und Professionalität.
- **Transfer-Swipe (neuer Tab bei Transfers):** Karten-Stapel mit Spielern, die zu deinen Kaderlücken und deinem Budget passen.
  - Rechts: auf die Beobachtungsliste.
  - Links: überspringen.
  - Nach oben: Angebot abgeben.
  - Jede Karte zeigt eine Mini-Prognose. Bedienung mit Maus, Touch, Knöpfen oder Pfeiltasten.

### Manager-Level, Skills & Aufgaben
- **Manager-Profil (neuer Menüpunkt):** Level (max. 30), XP-Balken und Titel vom Jungtrainer bis zur Trainerlegende.
- **XP gibt es für:**
  - Spiele: Sieg 25, Remis 10, Niederlage 3, dazu 2 pro Tor und 5 für ein Spiel zu Null.
  - Saisonabschluss: Meisterschaft 400, Pokal 250, Aufstieg 300.
  - Jeden freigeschalteten Erfolg: 50.
  - Erledigte Aufgaben.
- **Fähigkeitenbaum:** 7 Bereiche mit je 3 Stufen. Jedes Level bringt 1 Punkt.
  - Verhandlungsgeschick: Ablöseforderungen −4/−8/−12 %, gilt nur für dich, nicht für die KI.
  - Motivator: Moral +0,3/0,6/0,9 pro Woche.
  - Taktikfuchs: schnellere Taktik-Vertrautheit.
  - Talentförderer: Spieler bis 21 und die U19 entwickeln sich 7/14/21 % schneller.
  - Scouting-Auge: mehr gleichzeitige Scout-Aufträge; ab Stufe 2 kommen Berichte aus fremden Ligen in 1 Woche.
  - Medienprofi: Fans und Vorstand werden wöchentlich zufriedener.
  - Vermarkter: +2,5/5/7,5 % auf Ticket-, Sponsor- und Merch-Einnahmen. Der Bonus steht als eigene Zeile in den Finanzen.
- **Tages- und Wochenaufgaben** nach echtem Datum.
  - Täglich 3 Aufgaben, wöchentlich 2. Wochenaufgaben bringen zusätzlich eine Geldprämie.
  - Beispiele: Spiel gewinnen, zu Null spielen, 3D-Spiel schauen, Spielergespräch, Pressekonferenz, Swipe, Scout losschicken.
  - Belohnungen holst du im Manager-Profil ab. Ein Zähler in der Navigation zeigt offene Belohnungen und freie Skillpunkte.

### Szenario-Modus (Startmenü → „Szenarien")
Die Welt wird bis zum Startpunkt vorsimuliert und die Tabelle passend hergerichtet. Der Verein wird zufällig aus passenden Kandidaten gewählt.
1. 🆘 **Mission Klassenerhalt:** Bundesliga, 24. Spieltag, Abstiegsplatz. Ziel: Platz 15.
2. 🏆 **Titelrennen:** Bundesliga, 26. Spieltag, Platz 2, wenige Punkte zurück. Ziel: Meister.
3. 🚀 **Aufstiegsjagd:** 2. Bundesliga, 24. Spieltag, Platz 4. Ziel: Platz 1 oder 2.
4. 💸 **Finanzkrise:** Saisonstart mit 15 Mio. € Schulden. Ziel: Kontostand im Plus und Platz 15.
5. 🦁 **Rettung auf der Insel:** Premier League, 28. Spieltag, Platz 18 bis 20. Ziel: Platz 17.

Während der Mission zeigt die Vereinszentrale ein Banner mit dem Ziel, dem aktuellen Platz und den restlichen Spielen. Am Saisonende kommt die Auswertung: bei Erfolg +600 XP. Danach geht die Karriere normal weiter. Szenarien speichern in einen eigenen Spielstand „Szenario". Geschaffte Missionen werden im Menü abgehakt.

## Behoben
- **Ø Note:** Die Durchschnittsnote eines Spielers zählt jetzt nur Spiele mit Bewertung, also 3D-Spiele. Vorher haben simulierte Spiele den Schnitt stark nach unten gezogen, zum Beispiel auf 0,3.

## Hinweise
- Neue Einstellungen: Farbschema, Hell/Dunkel, Animierte Übergänge & Pokal-Zeremonie, Saison-Story.
- Ältere Spielstände laden normal. Manager-Level, Analyse-Daten und Aufgaben starten ab jetzt bei null.
- Getestet:
  - Unit-Tests, inklusive neuer Tests für XP, Skills, Aufgaben, Szenarien und Prognose.
  - Klicktest über alle Bildschirme ohne Fehler.
  - Browser-Durchläufe für Saison-Story, Zeremonie, hellen Modus, Analyse-Hub, Swipe und Szenario-Start.
- **Auto-Update** bleibt inaktiv, bis du mir den Namen deines GitHub-Repos nennst.
