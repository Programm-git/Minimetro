// Persistenz für Fortschritt: Highscore je Stadt, Highscore je Daily-Challenge-
// Datum (getrennt voneinander) sowie einfache Einstellungen. Alles liegt in
// localStorage unter klar getrennten Schlüsseln, damit Tages-Highscores sich
// niemals gegenseitig oder die normalen Stadt-Highscores überschreiben.

const CITY_SCORES_KEY = "linea.cityHighScores";
const DAILY_SCORES_KEY = "linea.dailyHighScores";
const SETTINGS_KEY = "linea.settings";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

// --- Highscore pro Stadt (normaler Spielmodus) -------------------------------

export function getCityHighScores() {
  return readJSON(CITY_SCORES_KEY, {});
}

export function getCityHighScore(mapId) {
  const scores = getCityHighScores();
  return typeof scores[mapId] === "number" ? scores[mapId] : null;
}

// Gibt true zurück, wenn ein neuer Highscore erreicht wurde.
export function saveCityHighScoreIfBetter(mapId, passengers) {
  const scores = getCityHighScores();
  const current = scores[mapId];
  if (current === undefined || passengers > current) {
    scores[mapId] = passengers;
    writeJSON(CITY_SCORES_KEY, scores);
    return true;
  }
  return false;
}

// --- Highscore pro Daily-Challenge-Datum -------------------------------------

export function getDailyHighScores() {
  return readJSON(DAILY_SCORES_KEY, {});
}

export function getDailyHighScore(dateSeed) {
  const scores = getDailyHighScores();
  return typeof scores[dateSeed] === "number" ? scores[dateSeed] : null;
}

export function saveDailyHighScoreIfBetter(dateSeed, passengers) {
  const scores = getDailyHighScores();
  const current = scores[dateSeed];
  if (current === undefined || passengers > current) {
    scores[dateSeed] = passengers;
    writeJSON(DAILY_SCORES_KEY, scores);
    return true;
  }
  return false;
}

// Menge der Datums-Seeds ("YYYY-MM-DD"), an denen die Daily Challenge
// mindestens einmal zu Ende gespielt wurde.
export function getDailyPlayedDates() {
  return new Set(Object.keys(getDailyHighScores()));
}

// --- Einstellungen ------------------------------------------------------------

const DEFAULT_SETTINGS = { soundOn: true };

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  writeJSON(SETTINGS_KEY, settings);
}

export function resetAllProgress() {
  try {
    localStorage.removeItem(CITY_SCORES_KEY);
    localStorage.removeItem(DAILY_SCORES_KEY);
  } catch (e) { /* ignore */ }
}
