// Rein dekorative, ruhige Mini-Metro-Karte im Hintergrund des Hauptmenüs.
// Bewusst unabhängig von der echten Spiel-Engine (kein GameState) gehalten,
// damit sie ohne Seiteneffekte permanent im Hintergrund laufen kann.
import { computeEdgeWaypoints, pointAlongPath } from "../trackGeometry.js";

const STATIONS = [
  { x: 0.14, y: 0.32, shape: "circle" },
  { x: 0.42, y: 0.16, shape: "triangle" },
  { x: 0.66, y: 0.52, shape: "square" },
  { x: 0.30, y: 0.72, shape: "diamond" },
];

const LINES = [
  { color: "#3b6fd4", stations: [0, 1, 2] },
  { color: "#e0453c", stations: [1, 3] },
];

const MENU_TRAIN_SPEED = 0.09; // Anteil der Linienlänge pro Sekunde

function drawMenuShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  switch (shape) {
    case "circle": ctx.arc(x, y, r, 0, Math.PI * 2); break;
    case "square": ctx.rect(x - r * 0.87, y - r * 0.87, r * 1.74, r * 1.74); break;
    case "triangle": {
      const h = r * 1.15;
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + h * 0.95, y + h * 0.75);
      ctx.lineTo(x - h * 0.95, y + h * 0.75);
      ctx.closePath();
      break;
    }
    case "diamond":
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.05, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.05, y);
      ctx.closePath();
      break;
    default: ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

function strokeRounded(ctx, points, radius) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    ctx.arcTo(curr.x, curr.y, next.x, next.y, Math.min(radius, d1 / 2, d2 / 2));
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

export function startMenuBackground(canvas) {
  const ctx = canvas.getContext("2d");
  let raf = null;
  let running = true;
  let t = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function world(i) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const s = STATIONS[i];
    return { x: s.x * w, y: s.y * h, shape: s.shape };
  }

  function linePath(line) {
    const pts = line.stations.map(world);
    const full = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = computeEdgeWaypoints(pts[i], pts[i + 1]);
      full.push(...seg.slice(1));
    }
    return full;
  }

  let lastTs = null;
  function frame(ts) {
    if (!running) return;
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    t += dt;

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const r = Math.max(7, Math.min(w, h) * 0.018);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = r * 0.85;

    const paths = LINES.map(linePath);
    LINES.forEach((line, i) => {
      ctx.strokeStyle = line.color;
      ctx.globalAlpha = 0.4;
      strokeRounded(ctx, paths[i], r * 1.6);
    });

    // Ein Zug pendelt sanft auf der ersten Linie.
    const path0 = paths[0];
    const cycle = (Math.sin(t * MENU_TRAIN_SPEED * Math.PI * 2) + 1) / 2;
    const along = pointAlongPath(path0, cycle);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(along.x, along.y);
    ctx.rotate(along.angle);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = LINES[0].color;
    ctx.lineWidth = r * 0.5;
    const tw = r * 1.7, th = r;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-tw / 2, -th / 2, tw, th, r * 0.35) : ctx.rect(-tw / 2, -th / 2, tw, th);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = 0.5;
    for (const line of LINES) {
      for (const idx of line.stations) {
        const s = world(idx);
        drawMenuShape(ctx, s.shape, s.x, s.y, r);
        ctx.fillStyle = "#eef0e9";
        ctx.fill();
        ctx.strokeStyle = "#5b6167";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}
