// Reine Geometrie-Logik für die Liniendarstellung im U-Bahn-Plan-Stil.
// Verbindungen zwischen zwei Punkten bestehen ausschließlich aus horizontalen,
// vertikalen oder 45°-diagonalen Teilstücken – niemals aus freien Geraden in
// beliebigem Winkel. Enthält keinerlei Canvas-/Rendering-Code.

const AXIS_EPS = 0.75; // Toleranz (Weltpixel), ab der eine Achse als "exakt" gilt

// Berechnet die Wegpunkte zwischen zwei Stationspositionen (bzw. deren
// parallel versetzten Kopien). Ergebnis ist immer eine Punktfolge, deren
// Teilstücke jeweils horizontal, vertikal oder 45°-diagonal sind:
//  - liegt B bereits (annähernd) auf einer dieser Achsen relativ zu A,
//    besteht der Weg aus einem einzigen Teilstück.
//  - andernfalls wird die Strecke in ein gerades Teilstück (an A anliegend)
//    und ein diagonales Teilstück (an B anliegend) zerlegt.
export function computeEdgeWaypoints(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (adx < AXIS_EPS || ady < AXIS_EPS || Math.abs(adx - ady) < AXIS_EPS) {
    return [a, b]; // bereits horizontal, vertikal oder 45°
  }

  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const bend = adx > ady
    ? { x: a.x + sx * (adx - ady), y: a.y } // gerades Stück an A, Diagonale an B
    : { x: a.x, y: a.y + sy * (ady - adx) };

  return [a, bend, b];
}

// Verkettet die Wegpunkte mehrerer Kanten (Stationsfolge) zu einer Liste von
// Teilstrecken – eine pro Kante –, damit jede Kante mit ihrem eigenen
// Parallel-Offset gerendert werden kann.
export function computeLineEdges(offsetPoints) {
  const edges = [];
  for (let i = 0; i < offsetPoints.length - 1; i++) {
    edges.push(computeEdgeWaypoints(offsetPoints[i], offsetPoints[i + 1]));
  }
  return edges;
}

function segmentLength(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += segmentLength(points[i], points[i + 1]);
  return total;
}

// Liefert Position und Blickrichtung (Winkel) bei Fortschritt `t` (0..1)
// entlang der Wegpunktfolge – proportional zur tatsächlich zurückgelegten
// Strecke, sodass ein Zug sichtbar durch die Kurve fährt statt sie abzukürzen.
export function pointAlongPath(points, t) {
  if (points.length < 2) return { x: points[0].x, y: points[0].y, angle: 0 };
  const total = pathLength(points);
  if (total <= 0) return { x: points[0].x, y: points[0].y, angle: 0 };

  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = segmentLength(a, b);
    const isLast = i === points.length - 2;
    if (target <= len || isLast) {
      const localT = len > 0 ? Math.min(1, target / len) : 0;
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    target -= len;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}
