// Konfiguration je Stadt/Karte. Jede Stadt startet mit denselben Spielregeln
// (siehe simulation.js), aber unterschiedlichen Ausgangsbedingungen, sodass
// sich die Karten spürbar unterschiedlich anfühlen.
//
// Feld-Übersicht:
//   riverCount          Anzahl unabhängiger Flüsse auf der Karte
//   riverWidthMultiplier Breite des Flusses relativ zum Standardwert
//   initialStations     Anzahl Stationen beim Spielstart
//   initialLines        Anzahl verfügbarer Linien-Slots beim Start
//   initialTunnels      Verfügbare Tunnel/Brücken beim Start
//   initialTrains       Züge, die die erste gebaute Linie sofort erhält
//   stationSpawnRate    Multiplikator auf die Geschwindigkeit neuer Stationen
//   passengerSpawnRate  Multiplikator auf die Fahrgast-Spawnrate
//   difficulty          Genereller Schwierigkeitsfaktor (wirkt zusätzlich auf Fahrgäste)
//   expansionRate       Multiplikator, wie schnell sich die Stadt geografisch ausbreitet (optional, Standard 1)
//   rareStationRate     Multiplikator auf die Häufigkeit seltener Stationsformen (optional, Standard 1)

export const MAP_CONFIGS = {
  munich: {
    id: "munich",
    name: "Munich",
    tagline: "Offene Karte, ein Fluss, mittlere Schwierigkeit",
    riverCount: 1,
    riverWidthMultiplier: 1,
    initialStations: 3,
    initialLines: 3,
    initialTunnels: 2,
    initialTrains: 1,
    stationSpawnRate: 1,
    passengerSpawnRate: 1,
    difficulty: 1,
    expansionRate: 1,
    rareStationRate: 1,
  },
  berlin: {
    id: "berlin",
    name: "Berlin",
    tagline: "Mehr Wasser, weitläufige Stadtbereiche",
    riverCount: 2,
    riverWidthMultiplier: 0.85,
    initialStations: 4,
    initialLines: 3,
    initialTunnels: 3,
    initialTrains: 1,
    stationSpawnRate: 0.9,
    passengerSpawnRate: 1.1,
    difficulty: 1.15,
    expansionRate: 1.1,
    rareStationRate: 1,
  },
  london: {
    id: "london",
    name: "London",
    tagline: "Großer zentraler Fluss, hoher Tunnelbedarf",
    riverCount: 1,
    riverWidthMultiplier: 1.8,
    initialStations: 3,
    initialLines: 3,
    initialTunnels: 2,
    initialTrains: 1,
    stationSpawnRate: 1,
    passengerSpawnRate: 1.15,
    difficulty: 1.3,
    expansionRate: 0.9,
    rareStationRate: 1,
  },
  newyork: {
    id: "newyork",
    name: "New York",
    tagline: "Zwei Flüsse umschließen die Insel, dichtes Netz nötig",
    riverCount: 2,
    riverWidthMultiplier: 1.3,
    initialStations: 4,
    initialLines: 3,
    initialTunnels: 3,
    initialTrains: 1,
    stationSpawnRate: 1.05,
    passengerSpawnRate: 1.2,
    difficulty: 1.25,
    expansionRate: 1.15,
    rareStationRate: 1.1,
  },
  paris: {
    id: "paris",
    name: "Paris",
    tagline: "Kompakte Karte, ein ruhiger Fluss durch die Mitte",
    riverCount: 1,
    riverWidthMultiplier: 1.1,
    initialStations: 3,
    initialLines: 3,
    initialTunnels: 2,
    initialTrains: 1,
    stationSpawnRate: 1.1,
    passengerSpawnRate: 1.05,
    difficulty: 1.1,
    expansionRate: 0.95,
    rareStationRate: 1,
  },
  hongkong: {
    id: "hongkong",
    name: "Hong Kong",
    tagline: "Breiter Hafen, hoher Schwierigkeitsgrad",
    riverCount: 1,
    riverWidthMultiplier: 2.1,
    initialStations: 3,
    initialLines: 3,
    initialTunnels: 3,
    initialTrains: 1,
    stationSpawnRate: 1.1,
    passengerSpawnRate: 1.3,
    difficulty: 1.4,
    expansionRate: 1.2,
    rareStationRate: 1.15,
  },
};

export const CITY_ORDER = ["munich", "berlin", "london", "newyork", "paris", "hongkong"];

export function getMapConfig(id) {
  return MAP_CONFIGS[id] || MAP_CONFIGS[CITY_ORDER[0]];
}

// Erzeugt eine deterministische, aber pro Tag variierende Konfiguration für
// die Daily Challenge. `rng` muss der bereits mit dem Tages-Seed erzeugte
// Zufallsgenerator sein, damit die Auswahl selbst reproduzierbar bleibt.
export function buildDailyConfig(rng) {
  const riverCount = rng() < 0.5 ? 1 : 2;
  return {
    id: "daily",
    name: "Daily Challenge",
    tagline: "Tägliche Herausforderung",
    riverCount,
    riverWidthMultiplier: 1 + rng() * 0.5,
    initialStations: 3,
    initialLines: 3,
    initialTunnels: 2 + (riverCount - 1),
    initialTrains: 1,
    stationSpawnRate: 1,
    passengerSpawnRate: 1.2,
    difficulty: 1.2,
    expansionRate: 1,
    rareStationRate: 1,
  };
}
