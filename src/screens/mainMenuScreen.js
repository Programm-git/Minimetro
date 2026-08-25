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
