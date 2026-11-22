# Unity-3D-Modus einrichten (einmalig, ca. 10 Minuten)

Der neue 3D-Modus wird mit **Unity** gebaut – automatisch auf GitHub, nicht auf deinem PC.
Dafür braucht GitHub einmalig deine (kostenlose) Unity-Lizenz.

## 1. Unity-Account & Lizenz
1. Kostenloses Konto anlegen: https://id.unity.com
2. **Unity Hub** installieren: https://unity.com/download und anmelden.
3. Im Hub: **Einstellungen → Lizenzen → Lizenz hinzufügen → „Kostenlose Personal-Lizenz“**.
   (Ein Unity-Editor muss dafür nicht installiert werden.)
4. Die Lizenzdatei öffnen (mit dem Editor/Notepad):
   - Windows: `C:\ProgramData\Unity\Unity_lic.ulf`
   - Den **kompletten Inhalt** kopieren.

> Hinweis: Wenn dein Unity-Konto die Zwei-Faktor-Anmeldung nutzt, kann der automatische Build daran scheitern. Dann für den Build kurz abschalten oder mir Bescheid geben.

## 2. Drei Geheimnisse auf GitHub eintragen
GitHub → Repo **fm27** → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Inhalt |
|---|---|
| `UNITY_LICENSE` | kompletter Inhalt der `Unity_lic.ulf` |
| `UNITY_EMAIL` | E-Mail deines Unity-Kontos |
| `UNITY_PASSWORD` | Passwort deines Unity-Kontos |

Die Werte sind verschlüsselt und für niemanden sichtbar – auch nicht für mich.

## 3. GitHub Pages einschalten
GitHub → Repo **fm27** → **Settings → Pages → Build and deployment → Source: „GitHub Actions“**

## 4. Ersten Build starten
GitHub → **Actions → „Unity WebGL“ → Run workflow**.
Der erste Build dauert ca. 20–40 Minuten, spätere sind schneller.
Danach liegt die Engine unter: https://svenrueger2-ship-it.github.io/fm27/unity/

## 5. Im Spiel einschalten
**Einstellungen → 3D-Spiel → 3D-Engine: „Unity (Beta)“**.
Ohne Internet oder wenn Unity nicht lädt, kannst du jederzeit „Klassisch spielen“ wählen.
