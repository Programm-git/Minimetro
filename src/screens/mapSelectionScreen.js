import { MAP_CONFIGS, CITY_ORDER } from "../maps/mapConfigs.js";
import { drawCityPreview } from "../maps/cityPreview.js";
import { getCityHighScore } from "../storage/progressStorage.js";

const el = (id) => document.getElementById(id);
const SWIPE_THRESHOLD = 45;

let selectedIndex = 0;
let tiles = [];
let offsets = [];
let onPlayCallback = null;

function formatHighScore(mapId) {
  const score = getCityHighScore(mapId);
  return score === null ? "Highscore: —" : `Highscore: ${score.toLocaleString("en-US")}`;
}

function recomputeOffsets() {
  const carousel = el("city-carousel");
  const containerWidth = carousel.clientWidth;
  offsets = tiles.map((tile) => containerWidth / 2 - (tile.offsetLeft + tile.offsetWidth / 2));
}

function applyTransform(extraX = 0) {
  const track = el("city-track");
  const offset = (offsets[selectedIndex] || 0) + extraX;
  track.style.transform = `translateX(${offset}px)`;
}

function updateSelectionUI() {
  tiles.forEach((tile, i) => tile.classList.toggle("selected", i === selectedIndex));
  document.querySelectorAll(".city-dot").forEach((dot, i) => dot.classList.toggle("active", i === selectedIndex));
  const config = MAP_CONFIGS[CITY_ORDER[selectedIndex]];
  el("city-selected-name").textContent = config.name.toUpperCase();
  el("city-selected-score").textContent = formatHighScore(config.id);
  applyTransform();
}

function setSelectedIndex(index) {
  selectedIndex = Math.max(0, Math.min(CITY_ORDER.length - 1, index));
  updateSelectionUI();
}

function buildTiles() {
  const track = el("city-track");
  const dots = el("city-dots");
  track.innerHTML = "";
  dots.innerHTML = "";
  tiles = [];

  CITY_ORDER.forEach((id, i) => {
    const config = MAP_CONFIGS[id];
    const tile = document.createElement("div");
    tile.className = "city-tile";
    tile.innerHTML = `
      <canvas></canvas>
      <div class="city-tile-name">${config.name.toUpperCase()}</div>
      <div class="city-tile-tagline">${config.tagline}</div>
    `;
    tile.addEventListener("click", () => setSelectedIndex(i));
    track.appendChild(tile);
    tiles.push(tile);
    drawCityPreview(tile.querySelector("canvas"), config);

    const dot = document.createElement("div");
    dot.className = "city-dot";
    dots.appendChild(dot);
  });
}

function attachGestures() {
  const carousel = el("city-carousel");
  let dragging = false;
  let startX = 0;
  let dragDeltaX = 0;
  let pointerId = null;

  carousel.addEventListener("pointerdown", (evt) => {
    dragging = true;
    pointerId = evt.pointerId;
    startX = evt.clientX;
    dragDeltaX = 0;
    el("city-track").classList.add("dragging");
    carousel.setPointerCapture(pointerId);
  });

  carousel.addEventListener("pointermove", (evt) => {
    if (!dragging || evt.pointerId !== pointerId) return;
    dragDeltaX = evt.clientX - startX;
    applyTransform(dragDeltaX);
  });

  function endDrag(evt) {
    if (!dragging || evt.pointerId !== pointerId) return;
    dragging = false;
    el("city-track").classList.remove("dragging");
    if (dragDeltaX > SWIPE_THRESHOLD) setSelectedIndex(selectedIndex - 1);
    else if (dragDeltaX < -SWIPE_THRESHOLD) setSelectedIndex(selectedIndex + 1);
    else updateSelectionUI();
  }
  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);

  carousel.addEventListener("wheel", (evt) => {
    if (Math.abs(evt.deltaX) < Math.abs(evt.deltaY)) return;
    evt.preventDefault();
    if (evt.deltaX > 8) setSelectedIndex(selectedIndex + 1);
    else if (evt.deltaX < -8) setSelectedIndex(selectedIndex - 1);
  }, { passive: false });

  window.addEventListener("keydown", (evt) => {
    if (!el("screen-map-selection").classList.contains("active")) return;
    if (evt.key === "ArrowLeft") setSelectedIndex(selectedIndex - 1);
    else if (evt.key === "ArrowRight") setSelectedIndex(selectedIndex + 1);
  });

  window.addEventListener("resize", () => { recomputeOffsets(); applyTransform(); });
}

export function initMapSelection({ onPlay, onBack }) {
  onPlayCallback = onPlay;
  buildTiles();
  attachGestures();
  el("btn-city-play").addEventListener("click", () => {
    onPlayCallback(CITY_ORDER[selectedIndex]);
  });
  el("btn-map-back").addEventListener("click", onBack);
}

// Beim Anzeigen des Screens aufrufen (Layout muss bereits sichtbar sein,
// damit offsetLeft/offsetWidth korrekt gemessen werden können).
export function onMapSelectionShown() {
  tiles.forEach((tile, i) => drawCityPreview(tile.querySelector("canvas"), MAP_CONFIGS[CITY_ORDER[i]]));
  recomputeOffsets();
  updateSelectionUI();
}
