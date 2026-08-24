import { GAME_TITLE } from "../constants.js";
import { startMenuBackground } from "./menuBackground.js";

const menuEl = (id) => document.getElementById(id);

export function initMainMenu({ onPlay, onDaily, onOpenSettings }) {
  menuEl("menu-title").textContent = GAME_TITLE;
  startMenuBackground(menuEl("menu-bg-canvas"));
  menuEl("btn-menu-play").addEventListener("click", onPlay);
  menuEl("btn-menu-daily").addEventListener("click", onDaily);
  menuEl("btn-menu-settings").addEventListener("click", onOpenSettings);
}

// info: { dateLabel: string, bestText: string }
export function updateDailyMenuInfo(info) {
  menuEl("daily-date").textContent = info.dateLabel;
  menuEl("daily-best").textContent = info.bestText;
}
