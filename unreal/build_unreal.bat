@echo off
setlocal
title FM27 - Unreal-3D bauen
echo.
echo  FUSSBALL MANAGER 2027 - Unreal-3D-Client bauen
echo  ==============================================
echo.
if defined FM27_UE (set "UE=%FM27_UE%") else (set "UE=%ProgramFiles%\Epic Games\UE_5.5")
if not exist "%UE%\Engine\Build\BatchFiles\RunUAT.bat" (
  echo  Unreal Engine 5.5 wurde nicht gefunden unter:
  echo    "%UE%"
  echo  Bitte im Epic Games Launcher "Unreal Engine 5.5" installieren.
  echo  Anderer Ordner? Vorher eingeben:  set FM27_UE=D:\Pfad\UE_5.5
  pause
  exit /b 1
)
set "PROJ=%~dp0FM27Match\FM27Match.uproject"
set "OUT=%LOCALAPPDATA%\FM27\unreal"
echo  Projekt:  %PROJ%
echo  Ziel:     %OUT%\Windows\FM27Match.exe
echo.
echo  Der erste Build dauert 20-60 Minuten (Shader werden kompiliert).
echo.
call "%UE%\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="%PROJ%" -noP4 -platform=Win64 -clientconfig=Shipping -build -cook -stage -pak -archive -archivedirectory="%OUT%" -utf8output
if errorlevel 1 (
  echo.
  echo  FEHLER beim Bauen. Bitte das Fenster mit dem Fehlertext als Screenshot schicken.
  pause
  exit /b 1
)
echo.
echo  FERTIG! Im Spiel: Einstellungen - 3D-Spiel - 3D-Engine: "Unreal Engine 5 (Windows, Beta)"
pause
