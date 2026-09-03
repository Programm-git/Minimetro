// Zentrale Spielkonstanten. Hier lässt sich die gesamte Balance justieren.

export const GAME_TITLE = "METRO NETWORK";

export const SHAPES = ["circle", "triangle", "square", "diamond", "star", "cross"];

// Zu Spielbeginn existieren ausschließlich diese drei Grundformen; seltene
// Formen (siehe RARE_SHAPES) schalten sich erst über die Spielprogression
// (progression.js, rareStationChance) frei.
export const COMMON_SHAPES = ["circle", "triangle", "square"];
export const RARE_SHAPES = ["diamond", "star", "cross"];

// Relative Häufigkeit EINER seltenen Form untereinander, sobald seltene
// Stationen grundsätzlich möglich sind (Raute deutlich häufiger als Kreuz).
export const RARE_SHAPE_WEIGHT = {
  diamond: 5,
  star: 2,
  cross: 1,
};

// Wie attraktiv eine Form als Fahrgast-ZIEL ist (unabhängig davon, wie selten
// sie als Station vorkommt). Seltene Formen sind bewusst überproportional
// gefragte Ziele, damit z.B. die eine Stern-Station zum Verkehrsknotenpunkt
// wird, obwohl sie kaum als Station existiert (siehe Design-Dokument §8).
export const SHAPE_DEMAND_WEIGHT = {
  circle: 1,
  triangle: 1,
  square: 1,
  diamond: 1.6,
  star: 2.4,
  cross: 2.8,
};

// Spanne, in der die "Beliebtheit" einer Station (Passagier-Spawngewicht)
// zufällig gewürfelt und im Spielverlauf sanft driftet (siehe §6: nicht alle
// Stationen sollen gleich stark belastet werden, und das darf sich verschieben).
export const STATION_POPULARITY_MIN = 0.25;
export const STATION_POPULARITY_MAX = 3.2;

export const LINE_COLORS = [
  { id: "red", css: "#e0453c" },
  { id: "blue", css: "#3b6fd4" },
  { id: "green", css: "#3d9a5c" },
  { id: "yellow", css: "#e0b32c" },
  { id: "violet", css: "#8a5fc9" },
  { id: "orange", css: "#e2822f" },
  { id: "teal", css: "#2fa5a0" },
  { id: "pink", css: "#d76aa3" },
];

export const DAY_SECONDS = 17; // simulierte Tageslänge in Echtzeitsekunden bei 1x
export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export const WORLD_PADDING = 80; // Mindestabstand einer Station zum Kartenrand
export const MIN_STATION_DIST = 115; // Mindestabstand zwischen zwei Stationen
export const STATION_RADIUS = 16;

export const INITIAL_STATION_COUNT = 3;
export const INITIAL_MAX_LINES = 3;
export const INITIAL_TUNNELS = 2;
export const INITIAL_TRAIN_CAPACITY = 6;
export const INITIAL_STATION_CAPACITY = 6;

// Fahrgäste entstehen PRO STATION auf einem eigenen Timer (nicht global) –
// dadurch wächst die Gesamtnachfrage organisch mit der Anzahl der Stationen
// (mehr Stationen = mehr gleichzeitige Ursprungsorte für Fahrgäste), statt
// nur über eine einzelne globale Rate gesteuert zu werden (siehe §5/§17).
// `PASSENGER_SPAWN_INTERVAL_STATION_BASE` ist das Intervall EINER einzelnen
// Station bei Popularity 1 und Progressions-Multiplikator 1.
export const PASSENGER_SPAWN_INTERVAL_STATION_BASE = 14;
export const PASSENGER_SPAWN_INTERVAL_MIN = 1.2; // absolute Untergrenze pro Station, unabhängig von der Progression

export const OVERCROWD_COUNTDOWN = 10; // Sekunden bis Game Over nach Überschreiten der Kapazität

// --- Schwierigkeits-/Progressionssystem ---------------------------------------
// Zentrale Balancing-Werte für die zeitabhängige Schwierigkeitskurve
// (siehe src/progression.js für die Logik, die diese Werte auswertet).
// Alle Zeitangaben sind simulierte Sekunden (state.elapsed), die bereits die
// Spielgeschwindigkeit berücksichtigen.
export const PROGRESSION_CONFIG = {
  // Keine Schonfrist mehr: die Nachfrage wächst von Beginn an, damit ein
  // Spieler, der nicht zügig ein funktionierendes Netz aufbaut, auch früh
  // verlieren kann (siehe Nutzer-Feedback: Spielstart war noch zu leicht).
  gracePeriod: 0,

  // Stationsspawn-Intervall (Sekunden), als Zufallsbereich [min, max], der
  // sich über feste Zeitanker (0s / stationSpawnMidAt / stationSpawnLateAt)
  // linear von "Anfang" über "Mitte" zu "Spätphase" verschiebt.
  stationSpawnStartMin: 40, stationSpawnStartMax: 50,
  stationSpawnMidMin: 30, stationSpawnMidMax: 40, stationSpawnMidAt: 300,     // ~5 Minuten
  stationSpawnLateMin: 20, stationSpawnLateMax: 30, stationSpawnLateAt: 900, // ~15 Minuten

  // Fahrgast-Nachfrage: sättigende Wachstumskurve (kein harter Sprung, kein
  // unbegrenztes Wachstum) plus eine leichte, langsame Schwankung ("Rush Hour"-Ansatz).
  passengerGrowthRate: 0.002,   // Geschwindigkeit, mit der sich die Kurve ihrem Maximum nähert
  passengerGrowthMax: 2.5,      // maximaler Zuwachs über die Grundrate hinaus (Plateau bei ~3.5x)
  demandVariance: 0.15,         // Amplitude der Schwankung (±15%)
  demandVariancePeriod: 150,    // Sekunden pro Schwankungszyklus

  // Seltene Stationsformen (Raute/Stern/Kreuz): vor `rareStationsStartAfter`
  // erscheinen sie gar nicht, danach steigt ihr Anteil sanft bis zum Maximum.
  rareStationsStartAfter: 420, // ~7 Minuten
  rareStationsRampTime: 480,   // Sekunden bis rareStationChance ihr Maximum erreicht
  rareStationMaxChance: 0.09,  // maximaler Anteil seltener Stationen an Neuzugängen

  // Geografische Ausbreitung: neue Stationen entstehen anfangs eng um das
  // Zentrum geclustert und dürfen erst mit der Zeit über die ganze Karte
  // verteilt erscheinen (siehe §3 im Design-Dokument).
  geographicExpansionTime: 1200, // ~20 Minuten bis zur vollen Kartenausdehnung

  // Echtes Endgame-Limit: Ist die Karte so voll, dass keine gültige Position
  // für eine neue Station mehr gefunden wird, gibt es kein Plateau mehr –
  // die Fahrgast-Nachfrage wächst ab diesem Zeitpunkt exponentiell statt
  // sich weiter sanft zu sättigen, sodass ein volles Netz unweigerlich in
  // Richtung Überfüllung läuft. `endgameCrunchTau` ist die Verdopplungszeit
  // (Sekunden, geteilt durch ln 2) ab Eintritt der Kartensättigung.
  endgameCrunchTau: 45,
};

export const TRAIN_SPEED = 90; // Pixel pro Sekunde bei 1x
export const TRAIN_DWELL_TIME = 0.6; // Sekunden Aufenthalt an einer Station

export const RIVER_HALF_WIDTH = 46;

export const MAX_LINE_SLOTS = LINE_COLORS.length;
