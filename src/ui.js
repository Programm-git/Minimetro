import { DAY_SECONDS } from "./constants.js";
import { UPGRADE_DEFS } from "./simulation.js";
import { loadSettings, saveSettings, resetAllProgress } from "./storage/progressStorage.js";

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

export function initPauseButton(onClick) {
  el("btn-pause").addEventListener("click", onClick);
}

export function setPauseButtonState(paused) {
  const btn = el("btn-pause");
  btn.textContent = paused ? "▶" : "⏸";
  btn.classList.toggle("active", paused);
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

const DOUBLE_TAP_MS = 400;
const lastChipTap = new Map(); // lineId -> Zeitstempel des letzten Antippens

export function renderLineSelector(state, ui, onSelect, onRequestDelete) {
  const container = el("line-selector");
  container.innerHTML = "";
  for (let i = 0; i < state.maxLines; i++) {
    const line = state.lines[i];
    const chip = document.createElement("div");
    chip.className = "line-chip" + (line ? "" : " empty");
    if (line) {
      chip.style.background = line.color;
      if (ui.selectedLineId === line.id) chip.classList.add("selected");
      chip.addEventListener("click", () => {
        const now = Date.now();
        const last = lastChipTap.get(line.id) || 0;
        lastChipTap.set(line.id, now);
        if (now - last < DOUBLE_TAP_MS) {
          lastChipTap.delete(line.id);
          onRequestDelete(line.id);
        } else {
          onSelect(line.id);
        }
      });
    }
    container.appendChild(chip);
  }
}

export function showDeleteConfirm(onConfirm) {
  const overlay = el("overlay-confirm-delete");
  overlay.classList.remove("hidden");

  const cleanup = () => {
    overlay.classList.add("hidden");
    yesBtn.removeEventListener("click", onYes);
    noBtn.removeEventListener("click", onNo);
  };
  const yesBtn = el("btn-confirm-delete-yes");
  const noBtn = el("btn-confirm-delete-no");
  const onYes = () => { cleanup(); onConfirm(); };
  const onNo = () => cleanup();
  yesBtn.addEventListener("click", onYes);
  noBtn.addEventListener("click", onNo);
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

// --- Einstellungen ------------------------------------------------------------

function updateSoundButtonLabel(btn, on) {
  btn.textContent = on ? "An" : "Aus";
  btn.classList.toggle("off", !on);
}

export function initSettings({ onReset }) {
  const soundBtn = el("btn-toggle-sound");
  updateSoundButtonLabel(soundBtn, loadSettings().soundOn);

  soundBtn.addEventListener("click", () => {
    const settings = loadSettings();
    settings.soundOn = !settings.soundOn;
    saveSettings(settings);
    updateSoundButtonLabel(soundBtn, settings.soundOn);
  });

  el("btn-reset-progress").addEventListener("click", () => {
    resetAllProgress();
    if (onReset) onReset();
  });

  el("btn-settings-close").addEventListener("click", closeSettings);
}

export function openSettings() {
  el("overlay-settings").classList.remove("hidden");
}

export function closeSettings() {
  el("overlay-settings").classList.add("hidden");
}
