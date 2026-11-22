# FUSSBALL MANAGER 2027 – Patch 3.1.0 „Unity-3D (Beta)“

**Neu: 3D-Modus mit Unity-Engine (Beta)**
- Eigenes Unity-Projekt (`unity/FM27Match`), gebaut als WebGL automatisch auf GitHub, geladen über GitHub Pages.
- Alles selbst gebaut, keine fremden Assets: Spieler mit Gelenken und Animationen (Laufen, Schuss, Grätsche, Torwart-Hechtsprung, Kopfball, Jubel), Rückennummern, Hautfarben/Haare aus dem Spielstand, gestreifter Rasen mit Linien, Tore mit Netz, vier Tribünen mit ca. 16.000 Fans (springen bei Toren), Banden, Dach, Flutlichtmasten, Schatten, Nebel/Regen-Sicht.
- Kameras: TV, Weit, Hinter dem Tor, Vogelperspektive, Nahaufnahme beim Torjubel.
- Steuerung im Spiel: Tempo 1x–8x, Kamera, Ausrichtung (Mauern … Alles nach vorn), Pause, Spiel sofort beenden.
- Ergebnis, Torschützen, Vorlagen, Karten, Noten, Fitness und Statistik (Ballbesitz, Schüsse, xG, Pässe, Zweikämpfe, Ecken, Paraden) gehen wie gewohnt in die Saison.
- Kein Internet oder Unity noch nicht veröffentlicht → „Klassisch spielen“ (automatischer Hinweis nach 60 s).

**Neu: Spieler-KI (C#, Unity-unabhängig)**
- Formation nach Positionen statt Reihenfolge, Raumaufteilung mit Verschieben zum Ball.
- Pressing (nächster Spieler attackiert, zweiter läuft Passweg zu), Raumdeckung mit Mannorientierung.
- Abwehrkette hält die Linie, Abseits wird im Moment der Ballabgabe geprüft.
- Stürmer laufen zeitlich abgestimmt in die Tiefe, Flügelspieler gehen zur Grundlinie, Stürmer besetzen den Strafraum, ballferner Flügel den langen Pfosten.
- Pässe nach Passweg, Druck, Raum und Torgefahr; Lupfer über die Kette; Flanken mit Kopfballduell; Klärungen.
- Schüsse mit xG-Modell (Distanz, Winkel, Druck), Blocks, Paraden, Aluminium.
- Test über 80 Spiele: 2,5 Tore pro Spiel, 6 % 0:0, 12 Schüsse und 195 Pässe (82 %) pro Team, stärkeres Team (68 vs 58) gewinnt 73 %.
- Noch zu selten: Ecken, Abseits, Einwürfe – wird nachgebessert.

**Einrichten**
- Einmalig Unity-Lizenz auf GitHub hinterlegen und Pages einschalten – siehe `UNITY_SETUP.md`.
- Danach im Spiel: Einstellungen → 3D-Spiel → 3D-Engine: „Unity (Beta)“.
