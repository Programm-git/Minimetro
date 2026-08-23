import { DAY_SECONDS } from "./constants.js";
import { UPGRADE_DEFS } from "./simulation.js";
import { loadHighscore } from "./save.js";

const el = (id) => document.getElementById(id);
const CLOCK_R = 17;
const CLOCK_CIRC = 2 * Math.PI * CLOCK_R;

// Zeichnet die 7 Tages-Markierungen einmalig auf den Ring der Wochen-Uhr.
function buildClockTicks() {
  const group = el("clock-ticks");
  if (!group || group.childElementCount > 0) return;
  const cx = 22, cy = 22, rInner = 12.5, rOuter = 17;
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * rInner;
    const y1 = cy + Math.sin(angle) * rInner;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "clock-tick");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    group.appendChild(line);
  }
}

function updateWeekClock(state) {
  buildClockTicks();
  const fraction = (state.weekday + state.dayTimer / DAY_SECONDS) / 7;
  const progress = el("clock-progress");
  progress.style.strokeDasharray = String(CLOCK_CIRC);
  progress.style.strokeDashoffset = String(CLOCK_CIRC * (1 - Math.min(1, fraction)));
}

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
  el("stat-day").textContent = `Tag ${state.day} · Woche ${state.week + 1}`;
  el("stat-weekday").textContent = state.weekdayName();
  el("stat-passengers").textContent = String(state.transportedCount);
  el("stat-tunnels").textContent = String(state.tunnelsAvailable);
  el("stat-trains").textContent = String(state.trains.length);
  updateWeekClock(state);
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
