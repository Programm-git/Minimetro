# Linea — Metro-Netzwerk-Strategiespiel

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

Funktioniert in aktuellen Desktop- und Mobile-Browsern (Maus & Touch).

## Spielprinzip

- Auf der Karte entstehen nach und nach Stationen mit geometrischer Form (Kreis, Dreieck, Quadrat, später Raute, Stern, Kreuz).
- Ziehe mit Maus oder Finger eine Linie von Station zu Station, um sie zu verbinden — jede Linie erhält automatisch eine eigene Farbe.
- Züge fahren automatisch auf den Linien hin und her, nehmen Fahrgäste mit und bringen sie — bei Bedarf über Umsteigestationen — zu einer Station ihrer Zielform.
- Ein Fluss durchquert die Karte. Um ihn zu überqueren, wird ein begrenzter Tunnel/Brücken-Vorrat verbraucht (wird beim Entfernen/Umbauen der Linie wieder freigegeben).
- Am Ende jeder simulierten Woche (7 Tage à 17 Sekunden) wählst du eine Erweiterung: neuer Zug, neue Linie, größerer Waggon, zusätzlicher Tunnel, größere Stationskapazität oder schnellere Züge.
- Überfüllt eine Station dauerhaft (Countdown-Ring), ist das Spiel vorbei. Am Ende siehst du deine Statistik, dein Highscore wird lokal gespeichert.

## Bedienung

- **Linie zeichnen**: Von einer Station aus klicken/tippen und zur nächsten ziehen. Weitere Stationen anhängen, dann loslassen.
- **Linie verlängern**: Am Endpunkt einer bestehenden Linie erneut ziehen.
- **Linie kürzen/umleiten**: Linie über den Farbkreis unten auswählen, dann von einer mittleren Station aus neu ziehen.
- **Linie löschen**: Kleines „×“ auf dem ausgewählten Farbkreis.
- **Geschwindigkeit**: Pause / 1× / 2× / 3× unten rechts.

## Projektstruktur

```
index.html         Grundgerüst, HUD, Overlays
style.css           Minimalistisches UI-Styling
src/constants.js    Zentrale Balance-Werte
src/mapgen.js       Fluss- und Stationsgenerierung
src/routing.js      Graph & BFS-Routenfindung für Fahrgäste
src/simulation.js   Spielzustand & Update-Loop (Stationen, Züge, Passagiere, Wochen, Game Over)
src/render.js       Canvas-Zeichenlogik
src/input.js        Maus-/Touch-Bedienung zum Linienzeichnen
src/ui.js           HUD, Overlays, Linien-Auswahlleiste
src/save.js         Highscore/Einstellungen via localStorage
src/main.js         Spiel-Loop & Verdrahtung aller Module
```

Routinglogik, Simulation, Rendering und Eingabe sind bewusst in eigenen Modulen getrennt.
