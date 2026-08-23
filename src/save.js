const HIGHSCORE_KEY = "linea.highscore";
const SETTINGS_KEY = "linea.settings";

export function loadHighscore() {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveHighscoreIfBetter(entry) {
  const current = loadHighscore();
  if (!current || entry.passengers > current.passengers) {
    try { localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(entry)); } catch (e) { /* ignore */ }
    return true;
  }
  return false;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}
