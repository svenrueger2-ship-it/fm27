# FUSSBALL MANAGER 2027 © BAKUSA – Version 1.0.0
**Datum:** 22.11.2026 · **Titel:** Karriere, Taktik, Match-Erlebnis & Wirtschaft

## 1. Karriere & Jobs (neu: `src/manager/career.js`, Bereich „Karriere“)
- **Manager-Ruf (0–100):** Er steigt und fällt mit dem Vorstandsziel, deinen Titeln und der Liga. Die Stufen reichen von „Unbekannt“ bis „Weltklasse“.
- **Vorstand:** Bei schlechter Stimmung gibt es ein Ultimatum, danach droht die Entlassung. Das gilt auch im Sportdirektor-Modus.
- **Nach einer Entlassung** schickt dich das Spiel automatisch zur Karriereseite. Dort wählst du aus 4 Angeboten kleinerer Vereine deinen neuen Klub.
- **Jobangebote:** Größere Vereine melden sich im Sommer (Ziel erreicht) und manchmal im Winter. Du kannst jederzeit wechseln. Die U19 bleibt beim alten Verein.
- **Nationaltrainer:**
  - Ab einem Ruf von etwa 62 bieten dir Verbände den Posten zusätzlich zum Verein an.
  - Du nominierst einen eigenen 26er-Kader oder lässt ihn automatisch zusammenstellen.
  - Dein Ruf steigert die Stärke des Teams. Die Ergebnisse bei EM und WM zählen für deine Karriere.
- **Karriere-Übersicht:** Stationen, Saisons (Platz, Ziel ✓/✗, Titel, Ruf) und deine Titelsammlung.

## 2. Tiefere Taktik
- **24 Spielerrollen.** Du wählst sie im Taktik-Bildschirm über eine Position. Sie verändern die Laufwege mit und ohne Ball sowie die Lust auf Schüsse und Dribblings:
  - Mitspielender Torwart
  - Ballspielender IV, Vorstopper
  - Schienenspieler, Inverser AV, Defensiver AV
  - Abräumer, Anker, Tiefer Spielmacher
  - Box-to-Box, Mezzala
  - Zehner, Schattenstürmer
  - Flügelspieler, Inverser Flügel, Konterflügel
  - Stürmer, Falsche Neun, Zielspieler, Konterstürmer
- **Standardsituationen:**
  - Eckball-Varianten: gemischt, erster Pfosten, zweiter Pfosten oder kurz ausführen.
  - Feste Schützen für Ecken, Freistöße und Elfmeter.
- **Gegneranalyse** (Button am Spieltag):
  - System, Stil, Trainer, Mannschaftsteile, Stärken und Schwächen
  - der gefährlichste Spieler und Empfehlungen
  - Mehr Details gibt es mit einem besseren Co-Trainer.
- **Taktikvorlagen:** Speichere bis zu 8 Taktiken (z. B. „Heim Pressing“) und lade sie mit einem Klick.

## 3. Match-Erlebnis 3D
- **Wetter je nach Jahreszeit:**
  - Regen im Herbst
  - Schnee und Nebel im Winter (Flocken, Nebelschleier)
  - Wetter macht Ballkontrolle und Pässe unpräziser.
- **VAR:**
  - Etwa 12 % der Tore werden geprüft, rund 40 % davon aberkannt (Abseits, Handspiel, Foul).
  - Im Spiel erscheinen „📺 VAR-Check …“ und dann „KEIN TOR“ oder „TOR ZÄHLT“.
  - Das Ergebnis wird korrekt zurückgesetzt.
- **Pyrotechnik:** bengalische Fackeln mit Glut, Licht und Rauch, beim Einlaufen in Topspielen und nach Toren. Heimkurve und Gästeblock zünden getrennt.
- **Topspiel-Kennzeichnung** am Spieltag, z. B. bei Pokalspielen oder Duellen großer Klubs.
- **Pressekonferenz nach dem Spiel:** Fragen zu Ergebnis, VAR, bestem oder schwächstem Spieler. Die Antworten wirken auf Moral, Vorstand, Fans und Budget. Kritik am Schiri kostet eine Geldstrafe.
- **Neue Einstellungen:** Pyrotechnik an/aus und VAR an/aus.

## 4. Wirtschaft & Verein (neu: `src/manager/clubbiz.js`, Karte in „Finanzen“)
- **Mitglieder:** Die Zahl wächst mit der Fanstimmung und mit Erfolg. Die Beiträge sind eine eigene Einnahme.
- **Fanshop** in 5 Stufen: jeweils +12 % Merchandising.
- **Investoren:**
  - Sie bieten Geld für Anteile.
  - In Deutschland gilt die 50+1-Regel, mehr als 49 % sind nicht möglich.
  - Im Ausland sind Übernahmen möglich: Ein Mehrheitseigner bringt viel Geld und Ansehen, erwartet aber Platz 4 oder besser.
  - Fans sehen Investoren kritisch.
- **Finanzkrise:**
  - Bei negativem Kontostand fallen Zinsen an, es gibt Warnungen und schlechte Stimmung beim Vorstand.
  - **Lizenzierung am Saisonende:** Ist das Konto im Minus, gibt es Auflagen (3 oder 6 Punkte Abzug und Transfersperre bis Winter).
  - Bei Schulden über 25 % des Jahresumsatzes wird die Lizenz verweigert und es folgt der **Zwangsabstieg**.
- Die Tabelle zeigt Punktabzüge an.

## 5. Europa League mit Gruppen + Conference League
- Europa League und die neue Conference League haben je 16 Teams in 4 Gruppen. Die Gruppenersten und -zweiten spielen ab dem Viertelfinale mit Hin- und Rückspiel, das Finale ist auf neutralem Platz.
- Es gibt Prämien pro Sieg und Remis. Die Champions League bleibt bei 32 Teams in 8 Gruppen.

## 6. Medien & Social (neu: Bereich „Medien“)
- **Zeitung** mit Titelseite nach jedem Spiel. Die Schlagzeile hängt vom Spiel ab (Gala, Sensation, Krise, Serie) und zitiert deine letzte Pressekonferenz.
- **Social-Media-Feed:** Fans deines Vereins, gegnerische Fans und Journalisten mit Exklusivmeldungen aus der Gerüchteküche.
- **Zitate:** Alle deine Antworten aus Pressekonferenzen werden gesammelt.

## 7. Rekorde & Hall of Fame
- **Vereinsrekorde:** höchster Sieg, höchste Niederlage, torreichstes Spiel, längste Serie ohne Niederlage und beste Saison.
- **Liga-Rekorde:** Rekordmeister seit Spielbeginn, meiste Punkte in einer Saison.
- **Hall of Fame:** die Legenden deiner Vereine mit Saisons, Spielen, Toren, Vorlagen, Titeln und Notenschnitt.

## Getestet
- Unit-Tests: 2 komplette Saisons.
- 3 Saisons Karriere mit Jobwechsel, Nationaltrainer-Angebot und Entlassung.
- Lizenz-Szenarien: Auflagen mit Punktabzug und Zwangsabstieg.
- Alle 8 Wettbewerbe (5 Pokale, CL, EL, ECL) haben Sieger.
- VAR- und Rollen-Test in 8 Spielen: Tore und Ergebnis bleiben stimmig, der Torschnitt liegt im üblichen Bereich.
- Schnee, Nebel und Pyro im 3D-Stadion geprüft.
- Klicktest über alle 15 Bereiche ohne Fehler.

## Hinweis
Alte Spielstände laufen weiter. Karriere, Mitglieder, Medien und Rekorde starten ab dem nächsten Spieltag. Europa League und Conference League bekommen ihre Gruppenphase ab der nächsten Saison.
