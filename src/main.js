import { GameState } from "./simulation.js";
import { draw } from "./render.js";
import { attachInput } from "./input.js";
import { clampCamera } from "./camera.js";
import {
  initStartOverlay, initPauseButton, setPauseButtonState, showToast, updateHud,
  renderLineSelector, showUpgradeOverlay, showGameOver, hideGameOver, showDeleteConfirm,
} from "./ui.js";
import { saveHighscoreIfBetter } from "./save.js";

const WORLD_SCALE = 2; // Die Karte ist mindestens doppelt so groß wie der sichtbare Ausschnitt

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let state = null;
let ui = { draft: null, pointer: null, selectedLineId: null, zoom: 1, camera: { x: 0, y: 0 } };
let viewport = { width: window.innerWidth, height: window.innerHeight };
let running = false;
let lastTime = null;
let hudAccumulator = 0;
let upgradeShown = false;
let gameOverHandled = false;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  canvas.width = Math.round(viewport.width * dpr);
  canvas.height = Math.round(viewport.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state) {
    clampCamera(ui.camera, ui.zoom, state.width, state.height, viewport.width, viewport.height);
  }
}

function newGame() {
  const worldW = viewport.width * WORLD_SCALE;
  const worldH = viewport.height * WORLD_SCALE;
  state = new GameState(worldW, worldH, Math.random);
  const fitZoom = Math.min(viewport.width / worldW, viewport.height / worldH);
  ui = {
    draft: null, pointer: null, selectedLineId: null,
    zoom: fitZoom, camera: { x: 0, y: 0 },
  };
  clampCamera(ui.camera, ui.zoom, worldW, worldH, viewport.width, viewport.height);
  upgradeShown = false;
  gameOverHandled = false;
  hideGameOver();
  setPauseButtonState(false);
  renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine);
  attachInput(canvas, state, ui, {
    onToast: showToast,
    onLinesChanged: () => renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine),
  });
}

function onSelectLine(lineId) {
  ui.selectedLineId = ui.selectedLineId === lineId ? null : lineId;
  renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine);
}

function onRequestDeleteLine(lineId) {
  showDeleteConfirm(() => {
    state.removeLine(lineId);
    if (ui.selectedLineId === lineId) ui.selectedLineId = null;
    renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine);
  });
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
      renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine);
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

  draw(ctx, state, ui, viewport);
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
initPauseButton(() => {
  if (!state) return;
  state.paused = !state.paused;
  setPauseButtonState(state.paused);
});

document.getElementById("btn-restart").addEventListener("click", () => {
  start();
});
