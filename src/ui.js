import { LINE_COLORS, MAX_LINE_SLOTS } from "./constants.js";
import { UPGRADE_DEFS } from "./simulation.js";
import { loadHighscore } from "./save.js";

const el = (id) => document.getElementById(id);

export function initStartOverlay(onStart) {
  const box = el("highscore-box");
  const hs = loadHighscore();
  box.textContent = hs ? `Highscore: ${hs.passengers} Fahrgäste · ${hs.days} Tage` : "Noch kein Highscore.";
  el("btn-start").addEventListener("click", () => {
    el("overlay-start").classList.add("hidden");
    onStart();
  }, { once: false });
}

export function initSpeedControls(onSpeedChange) {
  const buttons = document.querySelectorAll(".speed-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onSpeedChange(Number(btn.dataset.speed));
    });
  });
}

let toastTimer = null;
export function showToast(message) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 1800);
}

export function updateHud(state) {
  el("stat-day").textContent = `Tag ${state.day}`;
  el("stat-weekday").textContent = `${state.weekdayName()} · Woche ${state.week + 1}`;
  el("stat-passengers").textContent = String(state.transportedCount);
  el("stat-tunnels").textContent = String(state.tunnelsAvailable);
  el("stat-trains").textContent = String(state.trains.length);
}

export function renderLineSelector(state, ui, onSelect, onDelete) {
  const container = el("line-selector");
  container.innerHTML = "";
  for (let i = 0; i < state.maxLines; i++) {
    const line = state.lines[i];
    const chip = document.createElement("div");
    chip.className = "line-chip" + (line ? "" : " empty");
    if (line) {
      chip.style.background = line.color;
      if (ui.selectedLineId === line.id) chip.classList.add("selected");
      chip.addEventListener("click", () => onSelect(line.id));
      const x = document.createElement("div");
      x.className = "chip-x";
      x.textContent = "×";
      x.addEventListener("click", (e) => { e.stopPropagation(); onDelete(line.id); });
      chip.appendChild(x);
    }
    container.appendChild(chip);
  }
}

export function showUpgradeOverlay(state, choiceIds, onPick) {
  const overlay = el("overlay-upgrade");
  el("upgrade-title").textContent = `Woche ${state.week} geschafft!`;
  const row = el("upgrade-choices");
  row.innerHTML = "";
  for (const id of choiceIds) {
    const def = UPGRADE_DEFS[id];
    const card = document.createElement("div");
    card.className = "choice-card";
    card.innerHTML = `<div class="choice-icon">${def.icon}</div>
      <div class="choice-name">${def.name}</div>
      <div class="choice-desc">${def.desc}</div>`;
    card.addEventListener("click", () => {
      overlay.classList.add("hidden");
      onPick(id);
    });
    row.appendChild(card);
  }
  overlay.classList.remove("hidden");
}

export function showGameOver(state) {
  el("gameover-reason").textContent = state.gameOverReason;
  const grid = el("gameover-stats");
  const items = [
    ["Fahrgäste befördert", state.transportedCount],
    ["Spielzeit", `Tag ${state.day}`],
    ["Max. wartend", state.maxWaitingSeen],
    ["Linien gebaut", state.lines.length],
  ];
  grid.innerHTML = items.map(([label, value]) => `
    <div class="stat-box"><div class="label">${label}</div><div class="value">${value}</div></div>
  `).join("");
  el("overlay-gameover").classList.remove("hidden");
}

export function hideGameOver() {
  el("overlay-gameover").classList.add("hidden");
}
