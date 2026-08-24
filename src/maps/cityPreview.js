// Zeichnet eine kleine schematische Vorschau einer Stadt-Karte auf einen
// Canvas (für die Kartenauswahl-Kacheln): Flüsse + ein paar Stationen,
// deterministisch aus der Stadt-Konfiguration abgeleitet.
import { createSeededRandom } from "../seededRandom.js";
import { generateRivers, findStationPosition, pickShape } from "../mapgen.js";

const SHAPE_DRAW = {
  circle: (ctx, x, y, r) => ctx.arc(x, y, r, 0, Math.PI * 2),
  square: (ctx, x, y, r) => ctx.rect(x - r * 0.87, y - r * 0.87, r * 1.74, r * 1.74),
  triangle: (ctx, x, y, r) => {
    const h = r * 1.15;
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.95, y + h * 0.75);
    ctx.lineTo(x - h * 0.95, y + h * 0.75);
    ctx.closePath();
  },
};

export function drawCityPreview(canvas, config) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 260;
  const h = canvas.clientHeight || 150;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const rng = createSeededRandom(`preview-${config.id}`);
  const rivers = generateRivers(w, h, rng, config.riverCount, config.riverWidthMultiplier * 0.55);

  ctx.strokeStyle = "#a9c9d6";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const river of rivers) {
    ctx.lineWidth = river.halfWidth * 2;
    ctx.beginPath();
    ctx.moveTo(river.points[0].x, river.points[0].y);
    for (let i = 1; i < river.points.length; i++) ctx.lineTo(river.points[i].x, river.points[i].y);
    ctx.stroke();
  }

  const stations = [];
  const shapes = ["circle", "triangle", "square"];
  const count = Math.min(5, config.initialStations + 2);
  for (let i = 0; i < count; i++) {
    const pos = findStationPosition(stations, rivers, w, h, rng);
    if (!pos) continue;
    stations.push({ ...pos, shape: shapes[i % shapes.length] });
  }

  for (const s of stations) {
    ctx.beginPath();
    (SHAPE_DRAW[s.shape] || SHAPE_DRAW.circle)(ctx, s.x, s.y, 6);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#2b2f33";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}
