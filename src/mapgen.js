import {
  SHAPES, SHAPE_UNLOCK_DAY, SHAPE_WEIGHT, WORLD_PADDING, MIN_STATION_DIST,
  RIVER_HALF_WIDTH,
} from "./constants.js";

// --- Fluss -----------------------------------------------------------------

// Erzeugt eine geschwungene Flusslinie quer durch die Karte (Weltkoordinaten).
// `widthMultiplier` erlaubt Karten mit einem breiteren, dominanteren Fluss (z.B. London).
export function generateRiver(width, height, rng, widthMultiplier = 1) {
  const rand = rng || Math.random;
  const points = [];
  const segments = 6;
  const vertical = rand() > 0.5;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    if (vertical) {
      const x = width * (0.28 + 0.16 * Math.sin(t * Math.PI * 1.3)) + width * 0.14 * (rand() - 0.5);
      const y = t * height;
      points.push({ x, y });
    } else {
      const y = height * (0.3 + 0.16 * Math.sin(t * Math.PI * 1.3)) + height * 0.14 * (rand() - 0.5);
      const x = t * width;
      points.push({ x, y });
    }
  }
  return { points, halfWidth: RIVER_HALF_WIDTH * widthMultiplier };
}

// Erzeugt mehrere, unabhängig verlaufende Flüsse (für Karten mit riverCount > 1).
export function generateRivers(width, height, rng, count = 1, widthMultiplier = 1) {
  const rivers = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    rivers.push(generateRiver(width, height, rng, widthMultiplier));
  }
  return rivers;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

export function isInWater(x, y, river, margin = 0) {
  if (!river) return false;
  const p = { x, y };
  for (let i = 0; i < river.points.length - 1; i++) {
    if (distToSegment(p, river.points[i], river.points[i + 1]) < river.halfWidth + margin) return true;
  }
  return false;
}

export function isInAnyWater(x, y, rivers, margin = 0) {
  if (!rivers) return false;
  return rivers.some((river) => isInWater(x, y, river, margin));
}

// Prüft, ob die Gerade zwischen zwei Punkten den Fluss kreuzt (grobe Abtastung).
export function segmentCrossesWater(a, b, river) {
  if (!river) return false;
  const samples = 24;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (isInWater(x, y, river)) return true;
  }
  return false;
}

export function segmentCrossesAnyWater(a, b, rivers) {
  if (!rivers) return false;
  return rivers.some((river) => segmentCrossesWater(a, b, river));
}

// --- Stationen ---------------------------------------------------------------

export function pickShape(day, rng) {
  const rand = rng || Math.random;
  const available = SHAPES.filter((s) => day >= SHAPE_UNLOCK_DAY[s]);
  const total = available.reduce((sum, s) => sum + SHAPE_WEIGHT[s], 0);
  let r = rand() * total;
  for (const s of available) {
    r -= SHAPE_WEIGHT[s];
    if (r <= 0) return s;
  }
  return available[available.length - 1];
}

// Sucht eine gültige, freie Position für eine neue Station.
export function findStationPosition(existingStations, rivers, width, height, rng) {
  const rand = rng || Math.random;
  const maxAttempts = 220;
  for (let i = 0; i < maxAttempts; i++) {
    const x = WORLD_PADDING + rand() * (width - WORLD_PADDING * 2);
    const y = WORLD_PADDING + rand() * (height - WORLD_PADDING * 2);
    if (isInAnyWater(x, y, rivers, 18)) continue;
    let ok = true;
    for (const s of existingStations) {
      if (Math.hypot(s.x - x, s.y - y) < MIN_STATION_DIST) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  return null;
}
