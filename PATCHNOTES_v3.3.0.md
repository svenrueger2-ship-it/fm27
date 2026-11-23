# FUSSBALL MANAGER 2027 – Patch 3.3.0 „Wiederholungen & Live-Taktik“

**Wiederholungen (Unity & Unreal)**
- Die KI zeichnet die letzten 14 Sekunden laufend auf.
- Nach jedem Tor: 10-Sekunden-Wiederholung, erst von der Seitenlinie, dann hinter dem Tor, mit Zeitlupe kurz vor dem Treffer. Das Spiel pausiert währenddessen.
- Anzeige „WIEDERHOLUNG“ mit Minute und Torschütze, jederzeit überspringbar (Unity: Knopf, Unreal: R).

**Highlights nach dem Abpfiff**
- Zusammenschnitt aus allen Toren, Aluminiumtreffern und Glanzparaden (max. 8 Szenen), „HIGHLIGHTS 2/5“.
- Das Ergebnis ist schon gespeichert – Überspringen geht jederzeit. Abschaltbar in Einstellungen → 3D-Spiel.

**Live-Taktik im 3D-Spiel**
- Bis zu 5 Wechsel: Dialog mit Startelf und Bank (Unity) bzw. Menü mit W, Pfeiltasten und Enter (Unreal; das Spiel pausiert dabei).
- Formation live umstellen (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1 …) – die Spieler werden nach Position neu verteilt.
- Pressing niedrig / mittel / hoch.
- Eingewechselte bekommen eigene Minuten, Noten und Einsätze; Ausgewechselte behalten ihre.

**Handy**
- Auf dem Handy gibt es keine Unity-/Unreal-Auswahl mehr, dort läuft immer der klassische 3D-Modus.

**Getestet**
- KI (C# und C++): Clips, Wechsel, Formationswechsel, Minuten (Joker 60 + Ausgewechselter 30 = 90).
- Spiel mit Unity-Attrappe: Formation, Pressing, Wechsel kommen an, Einsätze korrekt (kein doppelter Einsatz mehr).
- Nicht getestet: die echte Darstellung in Unity/Unreal (braucht den ersten Build).
