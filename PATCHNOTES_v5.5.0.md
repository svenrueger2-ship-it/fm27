# FUSSBALL MANAGER 2027 © BAKUSA – Patch 5.5.0 „Medienhaus“

## Neu
- **Ausführliche Spielberichte:** Nach jedem Spiel erscheint ein Artikel mit Spielverlauf und Torminuten, Analyse (bei Live-Spielen mit Ballbesitz, Schüssen und xG), Tabellenlage und Ausblick. Dazu gibt es Noten von 1 bis 6 für jeden Spieler, einen Spieldaten-Kasten und Stimmen von beiden Trainern und dem Matchwinner.
- **Fünf Zeitungen mit eigener Handschrift:**
  - *Der Ballblick*: Boulevard, laut und in Großbuchstaben
  - *Sport-Kurier*: seriös und analytisch
  - *Kicker-Express*: Zahlen und Noten
  - *Abendpost Sport*: lokal und nah am Verein
  - *Fußball Heute*: das nationale Magazin
- **Wöchentliche Formate:**
  - Liga-Rundschau mit allen Ergebnissen, Überraschung des Spieltags und Torjägerliste
  - Kolumne „Der Ballflüsterer“ von Rudi Kaltenbach
  - Exklusiv-Interviews, auch mit unzufriedenen Spielern
  - Talent-Porträts
  - Boulevard-Geschichten
  - Fan-Umfragen mit Balkendiagramm
  - Elf des Spieltags
  - Gerüchteküche
  - große Saisonbilanz mit Saisonnote für dich
- **Social Media 2.0:**
  - offizieller Vereinsaccount mit wachsender Followerzahl
  - Posts deiner Spieler nach Toren und Verletzungen
  - Antworten von Fans und Rivalen
  - Trend-Hashtags
- **Als Trainer posten:** einmal pro Woche Motivation, Dank an die Fans, Selbstkritik oder Kampfansage. Eine Kampfansage geht viral: Gewinnst du, feiern dich die Fans, verlierst du, gibt es Spott.
- **FM-TV-Liveticker** mit Eilmeldungen, **Artikel-Archiv** mit Filtern nach Rubrik und Zeitung und eine **Presse-Karte** in der Vereinszentrale.

## Verbessert
- **Stab:** Scheitert eine automatische Vertragsverlängerung (Gehaltsbudget, Forderung), oder will ein Spieler nicht verlängern, meldet der Co-Trainer das jetzt im Posteingang. Bisher blieb das still.

## Behoben
- Eine Vertragsverlängerung um 1 Jahr hat den Vertrag nicht wirklich verlängert. Der Spieler wäre im Sommer trotzdem gegangen. Das betraf den Stab und eigene Verhandlungen. Verlängerungen gelten jetzt ab der nächsten Saison.

## Geprüft
- Delegation an den Stab: Aufstellung, Training, Verträge, Jugend, Scouting und Angebote werden bei „Automatisch“ zuverlässig erledigt. Neuer Test: `tests/staff.test.js`.
