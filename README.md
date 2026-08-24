# Metro Network

Ein vollständig spielbares, minimalistisches Metro-Netzwerk-Strategiespiel im Stil von *Mini Metro*, umgesetzt als reine Web-App mit HTML5 Canvas und Vanilla JavaScript (ES-Module). Keine externen Abhängigkeiten, kein Build-Schritt.

## Starten

Da das Spiel ES-Module lädt, muss es über einen lokalen HTTP-Server ausgeliefert werden (nicht per Doppelklick auf `index.html`, da Browser `file://`-Module blockieren).

Eine der folgenden Optionen genügt:

```bash
# Python (meist vorinstalliert)
python3 -m http.server 8080

# oder Node
npx serve .

# oder VS Code: "Live Server"-Erweiterung
```

Danach im Browser öffnen: `http://localhost:8080`

Funktioniert in aktuellen Desktop- und Mobile-Browsern (Maus & Touch). Es gibt bewusst kein `npm run build` — das Projekt läuft als reine ES-Module ohne Bundler/Abhängigkeiten; Verifikation erfolgt durch Laden im Browser.

## Menü-Ablauf

```
Hauptmenü ──Play──▶ Stadt auswählen ──Play──▶ Spiel ──▶ Game Over ──▶ Retry / Select City / Main Menu
    │
    └──Daily Challenge──▶ Spiel (Tages-Seed) ──▶ Game Over ──▶ Retry / Main Menu
```

- **Play** führt zur Kartenauswahl mit mehreren Städten (Munich, Berlin, London), jede mit eigener `MapConfig` (Anzahl Flüsse, Startstationen, Tunnel, Spawn-Raten, Schwierigkeit) und eigenem Highscore.
- **Daily Challenge** erzeugt aus dem aktuellen Kalendertag (`YYYY-MM-DD`) einen deterministischen Seed — alle Spieler bekommen am selben Tag dieselbe Karte/denselben Verlauf. Der Tages-Highscore wird getrennt von den normalen Stadt-Highscores gespeichert.
- Die Kartenauswahl ist ein Karussell (Swipe, Drag, Pfeiltasten, Mausrad) mit Mini-Vorschau je Stadt.
- Ein Zahnrad-Icon im Hauptmenü öffnet Einstellungen (Sound-Toggle, Highscores zurücksetzen).

## Spielprinzip

- Auf der Karte entstehen nach und nach Stationen mit geometrischer Form (Kreis, Dreieck, Quadrat, später Raute, Stern, Kreuz).
- Ziehe mit Maus oder Finger eine Linie von Station zu Station, um sie zu verbinden — jede Linie erhält automatisch eine eigene Farbe und folgt einem U-Bahn-Plan-Stil (nur horizontal/vertikal/45°, sanft abgerundete Kurven).
- Züge fahren automatisch auf den Linien hin und her, nehmen bis zu 6 Fahrgäste sichtbar mit und bringen sie — bei Bedarf über Umsteigestationen — zu einer Station ihrer Zielform.
- Flüsse durchqueren die Karte (ein oder mehrere, je nach Stadt). Um sie zu überqueren, wird ein begrenzter Tunnel/Brücken-Vorrat verbraucht; der überquerte Abschnitt einer Linie wird nur dort gestrichelt dargestellt.
- Am Ende jeder simulierten Woche (7 Tage à 17 Sekunden) wählst du eine Erweiterung: neuer Zug, neue Linie, größerer Waggon, zusätzlicher Tunnel, größere Stationskapazität oder schnellere Züge. Die Fahrgast-Spawnrate verdoppelt sich mit jeder abgeschlossenen Woche.
- Überfüllt eine Station dauerhaft (Countdown-Ring), ist das Spiel vorbei.
- Kartenzoom: Mausrad bzw. Pinch-Geste, Verschieben durch Ziehen auf freier Fläche.

## Bedienung

- **Linie zeichnen**: Von einer Station aus klicken/tippen und zur nächsten ziehen. Weitere Stationen anhängen, dann loslassen.
- **Linie verlängern**: Am Endpunkt einer bestehenden Linie erneut ziehen.
- **Linie kürzen/umleiten**: Linie über den Farbkreis unten auswählen, dann von einer mittleren Station aus neu ziehen.
- **Linie löschen**: Zweimal schnell auf ihren Farbkreis tippen, Bestätigungsdialog mit Ja/Nein.
- **Zoom/Pan**: Mausrad/Pinch zum Zoomen, Ziehen auf freier Fläche zum Verschieben.

## Projektstruktur

```
index.html                     Alle App-Screens (Menü, Kartenauswahl, Spiel, Game Over) + Overlays
style.css                      Minimalistisches UI-Styling

src/app/ScreenManager.js       Zentrale Sichtbarkeits-/Fade-Steuerung der App-Screens
src/screens/mainMenuScreen.js  Hauptmenü (Play/Daily/Settings) + Bindung der Hintergrundanimation
src/screens/menuBackground.js  Dekorative, animierte Mini-Metro-Karte im Menühintergrund
src/screens/mapSelectionScreen.js  Karussell zur Stadtauswahl (Swipe/Drag/Tasten/Wheel)
src/screens/gameOverScreen.js  Game-Over-Inhalt & Aktionen, je nach Normal-/Daily-Modus
src/maps/mapConfigs.js         MapConfig je Stadt + Daily-Challenge-Konfiguration
src/maps/cityPreview.js        Schematische Mini-Kartenvorschau für die Stadt-Kacheln
src/storage/progressStorage.js Highscore je Stadt, Highscore je Daily-Datum, Einstellungen
src/seededRandom.js            Deterministischer RNG + Tages-Seed für die Daily Challenge

src/constants.js    Zentrale Balance-Werte
src/mapgen.js       Fluss- und Stationsgenerierung (unterstützt mehrere Flüsse)
src/routing.js      Graph & BFS-Routenfindung für Fahrgäste
src/trackGeometry.js Geometrie der Gleisführung (nur horizontal/vertikal/45°, Rundungen)
src/camera.js       Zoom/Pan-Kamera
src/simulation.js   Spielzustand & Update-Loop (Stationen, Züge, Passagiere, Wochen, Game Over)
src/render.js       Canvas-Zeichenlogik
src/input.js        Maus-/Touch-Bedienung zum Linienzeichnen
src/ui.js           HUD, Ingame-Overlays, Linien-Auswahlleiste, Einstellungen
src/main.js         App-Orchestrator: verdrahtet ScreenManager, Screens und die Spiel-Engine
```

Routinglogik, Geometrie, Simulation, Rendering und Eingabe sind bewusst in eigenen Modulen getrennt; die bestehende Spiel-Engine (`simulation.js`, `render.js`, `input.js`, …) wurde unverändert wiederverwendet und lediglich über `MapConfig`-Objekte parametrisierbar gemacht.
