// Zentrale Spielkonstanten. Hier lässt sich die gesamte Balance justieren.

export const SHAPES = ["circle", "triangle", "square", "diamond", "star", "cross"];

// Wann eine Formklasse erstmals als Station auftauchen kann (Spieltag).
export const SHAPE_UNLOCK_DAY = {
  circle: 0,
  triangle: 0,
  square: 0,
  diamond: 3,
  star: 7,
  cross: 12,
};

// Relative Erscheinungswahrscheinlichkeit (seltene Formen sind wichtiger fürs Netz).
export const SHAPE_WEIGHT = {
  circle: 10,
  triangle: 10,
  square: 10,
  diamond: 4,
  star: 2,
  cross: 1,
};

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
export const INITIAL_STATION_CAPACITY = 8;

export const STATION_SPAWN_INTERVAL_START = 22; // Sekunden zwischen neuen Stationen
export const STATION_SPAWN_INTERVAL_MIN = 8;
export const PASSENGER_SPAWN_INTERVAL_START = 2.2; // Sekunden zwischen neuen Fahrgästen (global)
export const PASSENGER_SPAWN_INTERVAL_MIN = 0.5;

export const OVERCROWD_COUNTDOWN = 10; // Sekunden bis Game Over nach Überschreiten der Kapazität

export const TRAIN_SPEED = 90; // Pixel pro Sekunde bei 1x
export const TRAIN_DWELL_TIME = 0.6; // Sekunden Aufenthalt an einer Station

export const RIVER_HALF_WIDTH = 46;

export const MAX_LINE_SLOTS = LINE_COLORS.length;
