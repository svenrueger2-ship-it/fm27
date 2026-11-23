# FUSSBALL MANAGER 2027 – Patch 3.2.0 „Unreal Engine 5 (Beta)“

**Neu: 3D-Modus mit Unreal Engine 5 (nur Windows-App)**
- Eigenes Unreal-5.5-Projekt (`unreal/FM27Match`, C++), wird einmalig auf deinem PC gebaut – siehe `UNREAL_SETUP.md`.
- Lumen-Beleuchtung, virtuelle Schatten, Himmel/Atmosphäre, Nebel, vier Flutlichtmasten mit echten Spotlights.
- Selbst gebaute Spieler mit Gelenken und Animationen (Laufen, Schuss, Grätsche, Hechtsprung, Kopfball, Jubel), Rückennummern, Haut-/Haarfarben aus dem Spielstand.
- Rasen mit Mähstreifen und allen Linien, Tore mit Netz, vier Tribünen mit ca. 16.000 Fans (springen bei Toren), Banden, Dächer.
- Kameras: TV, Weit, Hinter dem Tor, Vogelperspektive, Nahaufnahme beim Torjubel.
- Anzeige im Spiel: Ergebnis, Uhr, Ereignisse. Steuerung: 1–4 Tempo, C Kamera, Leertaste Pause, Pfeiltasten Ausrichtung, Esc beenden.
- Der Launcher startet das Unreal-Fenster, übergibt Aufstellungen und Taktik und übernimmt Ergebnis, Torschützen, Karten, Noten und Statistik automatisch.
- Windows-App 2.8 (kommt automatisch per Update) bringt die Verbindung zum Unreal-Client mit.

**Spieler-KI (Unity und Unreal)**
- In C++ übertragen, 300 Testspiele: 2,4 Tore pro Spiel, 9 % 0:0, stärkeres Team gewinnt 72 %.
- Behoben: Verteidiger konnten einen schon gespielten Pass noch „abfangen“.
- Behoben: Die Mannschaft, die im Rechenschritt zuerst entschied, war im Nachteil – jetzt fair (1.200 Testspiele: 1,22 zu 1,23 Tore).
