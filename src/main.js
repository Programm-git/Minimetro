import { GameState } from "./simulation.js";
import { draw } from "./render.js";
import { attachInput } from "./input.js";
import {
  initStartOverlay, initSpeedControls, showToast, updateHud,
  renderLineSelector, showUpgradeOverlay, showGameOver, hideGameOver,
} from "./ui.js";
import { saveHighscoreIfBetter } from "./save.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let state = null;
let ui = { draft: null, pointer: null, selectedLineId: null };
let running = false;
let lastTime = null;
let hudAccumulator = 0;
let upgradeShown = false;
let gameOverHandled = false;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state) {
    state.width = cssW;
    state.height = cssH;
  }
}

function newGame() {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  state = new GameState(cssW, cssH, Math.random);
  ui = { draft: null, pointer: null, selectedLineId: null };
  upgradeShown = false;
  gameOverHandled = false;
  hideGameOver();
  renderLineSelector(state, ui, onSelectLine, onDeleteLine);
  attachInput(canvas, state, ui, {
    onToast: showToast,
    onLinesChanged: () => renderLineSelector(state, ui, onSelectLine, onDeleteLine),
  });
}

function onSelectLine(lineId) {
  ui.selectedLineId = ui.selectedLineId === lineId ? null : lineId;
  renderLineSelector(state, ui, onSelectLine, onDeleteLine);
}

function onDeleteLine(lineId) {
  state.removeLine(lineId);
  if (ui.selectedLineId === lineId) ui.selectedLineId = null;
  renderLineSelector(state, ui, onSelectLine, onDeleteLine);
}

function loop(timestamp) {
  if (!running) return;
  if (lastTime === null) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  dt = Math.min(dt, 0.25);
  lastTime = timestamp;

  state.update(dt);

  if (state.pendingUpgradeChoices && !upgradeShown) {
    upgradeShown = true;
    showUpgradeOverlay(state, state.pendingUpgradeChoices, (upgradeId) => {
      state.applyUpgrade(upgradeId);
      upgradeShown = false;
      renderLineSelector(state, ui, onSelectLine, onDeleteLine);
    });
  }

  if (state.gameOver && !gameOverHandled) {
    gameOverHandled = true;
    saveHighscoreIfBetter({ passengers: state.transportedCount, days: state.day });
    showGameOver(state);
  }

  hudAccumulator += dt;
  if (hudAccumulator > 0.15) {
    hudAccumulator = 0;
    updateHud(state);
  }

  draw(ctx, state, ui);
  requestAnimationFrame(loop);
}

function start() {
  newGame();
  running = true;
  lastTime = null;
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

initStartOverlay(start);
initSpeedControls((speed) => {
  if (!state) return;
  state.speed = speed;
  state.paused = speed === 0;
});

document.getElementById("btn-restart").addEventListener("click", () => {
  start();
});
