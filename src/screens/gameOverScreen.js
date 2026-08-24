import { MAP_CONFIGS } from "../maps/mapConfigs.js";

const el = (id) => document.getElementById(id);
let callbacks = {};

export function initGameOverScreen({ onRetry, onSelectCity, onMainMenu }) {
  callbacks = { onRetry, onSelectCity, onMainMenu };
}

function actionButton(label, onClick, extraClass = "") {
  const btn = document.createElement("button");
  btn.className = `btn-primary ${extraClass}`.trim();
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

// session: { mode: "NORMAL" | "DAILY", mapId, dateSeed?, dateLabel? }
// stats: { passengers, day, maxWaiting, lines, isNewHighScore, isNewDailyBest }
export function showGameOver(session, stats) {
  const isDaily = session.mode === "DAILY";
  const config = MAP_CONFIGS[session.mapId];

  el("gameover-eyebrow").textContent = isDaily
    ? `DAILY CHALLENGE · ${session.dateLabel}`
    : (config ? config.name.toUpperCase() : "");
  el("gameover-headline").textContent = `${stats.passengers.toLocaleString("en-US")} PASSENGERS`;

  let subline = "";
  if (isDaily) {
    subline = stats.isNewDailyBest ? "TODAY'S BEST" : "Game Over";
  } else {
    subline = stats.isNewHighScore ? "NEW HIGH SCORE!" : "Game Over";
  }
  el("gameover-subline").textContent = subline;

  const grid = el("gameover-stats");
  const items = [
    ["Spielzeit", `Tag ${stats.day}`],
    ["Max. wartend", stats.maxWaiting],
    ["Linien gebaut", stats.lines],
  ];
  grid.innerHTML = items.map(([label, value]) => `
    <div class="stat-box"><div class="label">${label}</div><div class="value">${value}</div></div>
  `).join("");

  const actions = el("gameover-actions");
  actions.innerHTML = "";
  actions.appendChild(actionButton("RETRY", () => callbacks.onRetry(session)));
  if (!isDaily) actions.appendChild(actionButton("SELECT CITY", callbacks.onSelectCity, "btn-secondary"));
  actions.appendChild(actionButton("MAIN MENU", callbacks.onMainMenu, "btn-secondary"));
}
