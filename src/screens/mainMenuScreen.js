import { GAME_TITLE } from "../constants.js";
import { startMenuBackground } from "./menuBackground.js";

const el = (id) => document.getElementById(id);

export function initMainMenu({ onPlay, onDaily, onOpenSettings }) {
  el("menu-title").textContent = GAME_TITLE;
  startMenuBackground(el("menu-bg-canvas"));
  el("btn-menu-play").addEventListener("click", onPlay);
  el("btn-menu-daily").addEventListener("click", onDaily);
  el("btn-menu-settings").addEventListener("click", onOpenSettings);
}

// info: { dateLabel: string, bestText: string }
export function updateDailyMenuInfo(info) {
  el("daily-date").textContent = info.dateLabel;
  el("daily-best").textContent = info.bestText;
}
