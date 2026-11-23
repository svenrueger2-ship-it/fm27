# Unreal-3D-Modus einrichten (Windows, einmalig)

Der Unreal-Modus ist ein eigenes Programm, das der FM27-Launcher für deine Live-Spiele startet.
Gebaut wird er **einmalig auf deinem PC** (Unreal ist zu groß für den Build auf GitHub).

## 1. Programme installieren (einmalig, ca. 60–100 GB)
1. **Epic Games Launcher** installieren: https://store.epicgames.com/download
2. Im Launcher: **Unreal Engine → Bibliothek → „+“ → Version 5.5** installieren.
3. **Visual Studio 2022 Community** (kostenlos): https://visualstudio.microsoft.com/de/vs/community/
   Im Installer ankreuzen: **„Spieleentwicklung mit C++“** (inkl. Windows 10/11 SDK).

## 2. Projekt holen
- GitHub → Repo **fm27** → **Code → Download ZIP** → entpacken (z. B. nach `C:\FM27`).

## 3. Bauen
- Im entpackten Ordner: **`unreal\build_unreal.bat` doppelklicken**.
- Der erste Build dauert 20–60 Minuten. Am Ende steht „FERTIG!“.
- Das Programm liegt dann unter `%LOCALAPPDATA%\FM27\unreal\Windows\FM27Match.exe` – dort sucht es der Launcher automatisch.

## 4. Im Spiel einschalten
- FM27 über den Launcher starten (Windows-App ab Version 2.8 – kommt automatisch per Update).
- **Einstellungen → 3D-Spiel → 3D-Engine: „Unreal Engine 5 (Windows, Beta)“**.
- „Live im 3D-Stadion“ öffnet jetzt das Unreal-Fenster. Nach dem Abpfiff geht es automatisch im Manager weiter.

**Steuerung im Unreal-Fenster:** `1`–`4` Tempo · `C` Kamera · `Leertaste` Pause · `Pfeil hoch/runter` Ausrichtung · `Esc` Spiel sofort beenden.

## Updates
Neue Unreal-Versionen: Ordner neu herunterladen (oder `git pull`) und `build_unreal.bat` erneut starten – spätere Builds gehen deutlich schneller.

## Probleme?
Screenshot vom Fehlertext im Build-Fenster schicken – oder in der Claude-Desktop-App deinen Projektordner verbinden, dann baue und teste ich direkt auf deinem PC.
