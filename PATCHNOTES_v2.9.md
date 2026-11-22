# Patch 2.9.0 – „Kalender, Android & Bugfixes"
22.11.2026 · kommt als Live-Update

## Neu
- **Kalender (neuer Menüpunkt, auch über das Datum oben):**
  - Monatsansicht mit allen Spielen, Ergebnissen und Trainingseinheiten.
  - Steuerung: „Nächster Tag", „Auto" mit 1x/2x/4x, „Stopp" und „Bis zum Spiel". Auto hält von selbst an deinen Spieltagen und bei offenen Entscheidungen.
  - Pokal- und Europapokalspiele sind mittwochs, Ligaspiele sonntags, passend zum Trainingsplan Mo–Sa.
  - Nach jedem Spiel geht es im Kalender weiter.
- **Android-App:** eigene APK, optimiert für Xiaomi 15T Pro.
  - 120 Hz, Vollbild bis in die Kamera-Aussparung, Systemschriftgröße beeinflusst das Layout nicht.
  - Hohe Grafik als Standard, Zurück-Taste schließt Fenster.
  - Live-Updates mit Update-Zwang wie am PC. Eine neue APK braucht es nur, wenn sich die App selbst ändert.
- **Beträge eingeben wie im Geschäftsleben:** „1.500.000 €" mit Tausenderpunkten während des Tippens, dazu +/- Knöpfe. Kurzformen wie „1,5 Mio", „750 Tsd", „2m" oder „300k" funktionieren auch.

## Verbessert
- **Weniger Popups:** Ereignisse wie Spendenanfragen kommen seltener (etwa alle 8 Wochen, nie zwei innerhalb von 3 Wochen). Einstellbar unter Einstellungen → Spielablauf → „Ereignisse & Entscheidungen" (oft/normal/selten/aus).
- **Mehr Tore im 3D-Spiel und in der Sofortsimulation:** Spieler schießen öfter aus der Distanz, weil Fernschüsse vorher fast nichts wert waren.
  - Vorher: im Schnitt 1,1 Tore pro Spiel und 42 % 0:0.
  - Jetzt: etwa 2,1 Tore pro Spiel und rund 15 % 0:0 (im Testlauf).
  - Die Ligasimulation lag schon realistisch bei 2,5–3 Toren und 6–10 % 0:0.
- **Vertragsverhandlungen** zeigen alle Beträge auf den Euro genau. Das Startangebot fürs Beraterhonorar liegt jetzt direkt an der Annahmegrenze.

## Behoben
- **Vertragspoker:** Beträge mit Punkten („1.300.000") wurden als 0 gelesen. Deshalb hat der Berater immer wegen des Honorars abgelehnt, egal wie hoch.
- **Kader nach dem Saisonwechsel:** Nach auslaufenden Verträgen konnte dein Kader auf 9 Spieler schrumpfen (im Dauertest über 5 Saisons gefunden). Unter 16 Spielern rücken jetzt U19-Talente nach, dazu kommen vereinslose Profis. Du bekommst eine Warnung.

## Hinweis Android
Die APK wird auf GitHub gebaut (erfolgreich getestet). Veröffentlicht wird sie erst, wenn du einmal den Signaturschlüssel als Secret hinterlegst. Die Anleitung steht in der Nachricht.
