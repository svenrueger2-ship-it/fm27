# FUSSBALL MANAGER 2027 – Patch 4.0.0 „Kabine, Stil-Schule & Legenden“

## Neu
**🗣️ Kabinenansprache**
- Im Spieltags-Bildschirm vor dem Anpfiff und im 3D-Spiel zur Halbzeit.
- 5 Ansprachen: 🔥 Heiß machen, 🧘 Ruhe & Fokus, 😤 Klare Ansage, 👏 Loben, 🤝 Vertrauen.
- Die Wirkung hängt ab von Favorit/Außenseiter, Spielstand, Form, deinem Ruf und den Persönlichkeiten. Hitzköpfe mögen Emotionen, Launische vertragen keine Kritik, Führungsspieler helfen.
- Der Co-Trainer liest die Stimmung und gibt einen Tipp.
- Ergebnis „begeistert“ bis „verunsichert“: Moral jedes Spielers ändert sich, im Spiel wirken Konzentration, Laufbereitschaft und Härte. Test über 90 Spiele: 126 Punkte bei „begeistert“, 117 bei „verunsichert“. Spürbar, aber nicht spielentscheidend.
- In Unity/Unreal wirkt die Ansprache vor dem Spiel über die Moral; die Halbzeitansprache gibt es im klassischen 3D-Modus.

**🎓 Stil-Training**
- Training → Einzeltraining → Spalte „Spielstil“: Spielern einen der 6 Spielstile aus 3.4 antrainieren (ca. 3 Monate).
- Voraussetzung: passende Position und Grundwert. Junge, professionelle Spieler und bessere Trainingsgelände lernen schneller.
- Etwa jedes dritte U19-Talent hat eine Stil-Begabung (⭐) und lernt diesen Stil fast doppelt so schnell und schon mit niedrigeren Werten.

**📋 Taktik-Vorschlag**
- Die Gegneranalyse schlägt konkrete Einstellungen vor (z. B. Direktheit 15 → 75 gegen eine hohe Abwehr) und übernimmt sie mit einem Tipp.

**🏆 Legendenstatus & Chronik**
- Karriere-Tab: Legendenpunkte aus Spielen, Siegen, Saisons, erreichten Zielen, Titeln und Ruf.
- 6 Stufen von 🌱 Neuling bis 👑 Ikone des Fußballs, mit Meldung beim Aufstieg.
- Chronik nach Jahrzehnten: Vereine, bester Platz, Ziele, Titel.

## Android & Performance
- Seiten, die höher als der Bildschirm sind, verteilen ihre Karten automatisch auf zwei Spalten.
- Lange Listen (Kader-Tabelle, Transfermarkt, Training, Welt, Erfolge) scrollen in ihrer Karte, die Kopfzeile bleibt stehen.
- Kaderkarten 6 pro Reihe, kompakterer Stab, Erfolge, Stadion, Trainingswoche und Profil.
- Gemessen (Seitenhöhe ÷ Bildschirmhöhe, Querformat 924×412):

  | Tab | vorher | nachher |
  |---|---|---|
  | Transfers | 12,1 | 1,6 |
  | Erfolge | 3,3 | 1,0 |
  | Kader | 3,1 | 1,6 |
  | Training | 4,7 | 2,1 |
  | Stab | 2,2 | 1,2 |
  | Welt | 3,1 | 1,2 |
  | Kabine | 3,5 | 2,6 |

- Stadion-Tab: 3D-Vorschau baut sich erst nach der Seite auf, auf Handys mit 30 fps und nur wenn sichtbar. 1.676 ms → 77 ms (4× gedrosselte CPU).
- Transfermarkt zeigt auf Handys 40 Spieler mit „Mehr anzeigen“.
- Training lädt die Mentor-Liste erst beim Antippen.

## Tests
- Alle Unit-Tests, Klicktest aller 20 Tabs auf Android-Ansicht ohne Fehler, Live-3D, Spieltags-Sperre, Weiter-Knopf, Managereditor, Ende-zu-Ende-Test der neuen Funktionen.
