import { GameState } from "./simulation.js";
import { draw } from "./render.js";
import { attachInput } from "./input.js";
import { clampCamera } from "./camera.js";
import {
  initPauseButton, setPauseButtonState, showToast, updateHud,
  renderLineSelector, showUpgradeOverlay, showDeleteConfirm,
  initSettings, openSettings, toggleDebugOverlay, updateDebugOverlay,
} from "./ui.js";
import {
  saveCityHighScoreIfBetter, saveDailyHighScoreIfBetter,
} from "./storage/progressStorage.js";
import { createSeededRandom, todaySeed } from "./seededRandom.js";
import { getMapConfig, buildDailyConfig } from "./maps/mapConfigs.js";
import { ScreenManager } from "./app/ScreenManager.js";
import { initMainMenu } from "./screens/mainMenuScreen.js";
import { initDailyChallengeScreen, onDailyChallengeShown } from "./screens/dailyChallengeScreen.js";
import { initMapSelection, onMapSelectionShown } from "./screens/mapSelectionScreen.js";
import { initGameOverScreen, showGameOver } from "./screens/gameOverScreen.js";

const WORLD_SCALE = 2; // Die Karte ist mindestens doppelt so groß wie der sichtbare Ausschnitt

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let state = null;
let ui = { draft: null, pointer: null, selectedLineId: null, segmentDrag: null, pressedSegment: null, zoom: 1, camera: { x: 0, y: 0 } };
let viewport = { width: window.innerWidth, height: window.innerHeight };
let running = false;
let lastTime = null;
let hudAccumulator = 0;
let upgradeShown = false;
let gameOverHandled = false;
let detachInput = null;
let currentSession = null; // { mode: "NORMAL" | "DAILY", mapId, dateSeed?, dateLabel? }

const screenManager = new ScreenManager({
  "main-menu": document.getElementById("screen-main-menu"),
  "daily": document.getElementById("screen-daily"),
  "map-selection": document.getElementById("screen-map-selection"),
  "game": document.getElementById("screen-game"),
  "game-over": document.getElementById("screen-game-over"),
});

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

function formatDateLabel(date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} · ${day} ${month}`;
}

// --- Spiel starten -------------------------------------------------------------

function startGame(session) {
  currentSession = session;

  let rng = Math.random;
  let config;
  if (session.mode === "DAILY") {
    rng = createSeededRandom(session.dateSeed);
    config = buildDailyConfig(rng);
  } else {
    config = getMapConfig(session.mapId);
  }

  const worldW = viewport.width * WORLD_SCALE;
  const worldH = viewport.height * WORLD_SCALE;
  state = new GameState(worldW, worldH, rng, config);
  const fitZoom = Math.min(viewport.width / worldW, viewport.height / worldH);
  ui = {
    draft: null, pointer: null, selectedLineId: null, segmentDrag: null, pressedSegment: null,
    zoom: fitZoom, camera: { x: 0, y: 0 },
  };
  clampCamera(ui.camera, ui.zoom, worldW, worldH, viewport.width, viewport.height);

  upgradeShown = false;
  gameOverHandled = false;
  setPauseButtonState(false);
  renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine);

  if (detachInput) detachInput();
  detachInput = attachInput(canvas, state, ui, {
    onToast: showToast,
    onLinesChanged: () => renderLineSelector(state, ui, onSelectLine, onRequestDeleteLine),
  });

  screenManager.show("game");
  running = true;
  lastTime = null;
  requestAnimationFrame(loop);
}

function startDailyChallenge() {
  startGame({ mode: "DAILY", mapId: "daily", dateSeed: todaySeed(), dateLabel: formatDateLabel(new Date()) });
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

function handleGameOver() {
  gameOverHandled = true;
  running = false;

  const passengers = state.transportedCount;
  const isDaily = currentSession.mode === "DAILY";
  const isNewHighScore = !isDaily && saveCityHighScoreIfBetter(currentSession.mapId, passengers);
  const isNewDailyBest = isDaily && saveDailyHighScoreIfBetter(currentSession.dateSeed, passengers);

  showGameOver(currentSession, {
    passengers,
    day: state.day,
    maxWaiting: state.maxWaitingSeen,
    lines: state.lines.length,
    isNewHighScore,
    isNewDailyBest,
  });
  screenManager.show("game-over");
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
    handleGameOver();
  }

  hudAccumulator += dt;
  if (hudAccumulator > 0.15) {
    hudAccumulator = 0;
    updateHud(state);
    updateDebugOverlay(state);
  }

  draw(ctx, state, ui, viewport);
  if (running) requestAnimationFrame(loop);
}

// --- Navigation zwischen den Screens --------------------------------------------

function goToMainMenu() {
  screenManager.show("main-menu");
}

function goToMapSelection() {
  screenManager.show("map-selection");
  onMapSelectionShown();
}

function goToDailyChallenge() {
  screenManager.show("daily");
  onDailyChallengeShown();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Debug-Overlay (§23): mit F3 ein-/ausblenden, unabhängig vom aktuellen Screen.
window.addEventListener("keydown", (evt) => {
  if (evt.key === "F3") {
    evt.preventDefault();
    const visible = toggleDebugOverlay();
    if (visible && state) updateDebugOverlay(state);
  }
});

initMainMenu({
  onPlay: goToMapSelection,
  onDaily: goToDailyChallenge,
  onOpenSettings: openSettings,
});

initDailyChallengeScreen({
  onPlay: startDailyChallenge,
  onBack: goToMainMenu,
});

initMapSelection({
  onPlay: (mapId) => startGame({ mode: "NORMAL", mapId }),
  onBack: goToMainMenu,
});

initGameOverScreen({
  onRetry: (session) => startGame(session),
  onSelectCity: goToMapSelection,
  onMainMenu: goToMainMenu,
});

initSettings({
  onReset: () => onMapSelectionShown(),
});

initPauseButton(() => {
  if (!state) return;
  state.paused = !state.paused;
  setPauseButtonState(state.paused);
});

goToMainMenu();
