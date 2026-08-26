// Gemeinsame Schicht zwischen TrackGeometry (reine Punkt-Geometrie) und den
// beiden Konsumenten Renderer + Input: berechnet für jede Linie/Kante die
// tatsächlich dargestellten (parallel versetzten, gebogenen) Wegpunkte und
// bietet darauf aufbauend eine geometrische Trefferkennung für Streckenklicks.
// So sieht die Eingabe exakt dieselbe Geometrie wie der Renderer zeichnet.
import { computeEdgeWaypoints } from "./trackGeometry.js";

export const LINE_SPACING = 18; // Pixelabstand paralleler Linien auf gemeinsamer Kante

function edgeKey(aId, bId) { return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`; }

// Anzahl der Kanten einer Linie: bei einer Ringlinie zusätzlich die
// schließende Kante von der letzten zurück zur ersten Station.
export function lineEdgeCount(line) {
  if (line.stations.length < 2) return 0;
  return line.isLoop && line.stations.length >= 3 ? line.stations.length : line.stations.length - 1;
}

// Liefert die Stations-Indizes [idxA, idxB] der Kante mit Index `i` (0-basiert).
// Für Ringlinien ist die letzte Kante (i === stations.length - 1) die
// Schließungskante zurück zur ersten Station.
export function lineEdge(line, i) {
  const isWrapEdge = line.isLoop && i === line.stations.length - 1;
  return isWrapEdge ? [i, 0] : [i, i + 1];
}

// Ermittelt für jede (Linie, Segment)-Kombination den Parallel-Offset-Index,
// damit mehrere Linien auf derselben Strecke sichtbar nebeneinander verlaufen.
export function buildOffsetTable(lines) {
  const edgeLines = new Map(); // edgeKey -> [lineId,...] in fester Reihenfolge
  for (const line of lines) {
    const edgeCount = lineEdgeCount(line);
    for (let i = 0; i < edgeCount; i++) {
      const [idxA, idxB] = lineEdge(line, i);
      const key = edgeKey(line.stations[idxA], line.stations[idxB]);
      if (!edgeLines.has(key)) edgeLines.set(key, []);
      const arr = edgeLines.get(key);
      if (!arr.includes(line.id)) arr.push(line.id);
    }
  }
  return edgeLines;
}

export function offsetForSegment(edgeLines, aId, bId, lineId) {
  const key = edgeKey(aId, bId);
  const arr = edgeLines.get(key) || [lineId];
  const idx = arr.indexOf(lineId);
  const count = arr.length;
  return (idx - (count - 1) / 2) * LINE_SPACING;
}

export function perpOffset(ax, ay, bx, by, amount) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * amount, y: (dx / len) * amount };
}

// Verschiebt Start- und Endpunkt einer Kante um denselben senkrechten Vektor
// (bestimmt durch die Gesamtrichtung A→B) und wendet danach dieselbe
// Horizontal/Vertikal/45°-Zerlegung an. Da beide Endpunkte um exakt denselben
// Vektor verschoben werden, ist das Ergebnis eine reine Parallelverschiebung
// der unversetzten Strecke – dadurch bleiben mehrere Linien auf derselben
// Kante auch in Kurven exakt parallel.
function getOffsetEdgeWaypoints(a, b, offsetAmount) {
  const p = perpOffset(a.x, a.y, b.x, b.y, offsetAmount);
  const offsetA = { x: a.x + p.x, y: a.y + p.y };
  const offsetB = { x: b.x + p.x, y: b.y + p.y };
  return computeEdgeWaypoints(offsetA, offsetB);
}

// Liefert die tatsächlich dargestellte Punktfolge (inkl. Parallel-Offset und
// Kurven-Zerlegung) für die Kante zwischen den Stationen an Index idxA/idxB
// einer Linie. `idxA` sollte kleiner als `idxB` sein (kanonische Reihenfolge),
// damit derselbe Offset wie beim Rendern verwendet wird.
export function edgeWaypointsForLine(state, edgeLines, line, idxA, idxB) {
  const a = state.getStationById(line.stations[idxA]);
  const b = state.getStationById(line.stations[idxB]);
  if (!a || !b) return null;
  const off = offsetForSegment(edgeLines, a.id, b.id, line.id);
  return getOffsetEdgeWaypoints(a, b, off);
}

export function distancePointToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

// Sucht das Liniensegment (Kante zwischen zwei aufeinanderfolgenden Stationen),
// dessen tatsächlich dargestellte Geometrie dem übergebenen Weltpunkt am
// nächsten liegt (innerhalb `hitWidth`). Berücksichtigt dabei jedes einzelne
// Teilstück der ggf. gebogenen/versetzten Strecke, nicht nur die Luftlinie
// Station-zu-Station. Liegen mehrere Linien dicht beieinander, gewinnt die
// geometrisch nächste.
export function findSegmentAtPoint(state, edgeLines, worldPoint, hitWidth) {
  let best = null;
  for (const line of state.lines) {
    const edgeCount = lineEdgeCount(line);
    for (let i = 0; i < edgeCount; i++) {
      const [idxA, idxB] = lineEdge(line, i);
      const points = edgeWaypointsForLine(state, edgeLines, line, idxA, idxB);
      if (!points) continue;
      for (let k = 0; k < points.length - 1; k++) {
        const d = distancePointToSegment(worldPoint, points[k], points[k + 1]);
        if (d <= hitWidth && (!best || d < best.distance)) {
          best = {
            lineId: line.id,
            segmentIndex: i,
            fromStationId: line.stations[idxA],
            toStationId: line.stations[idxB],
            distance: d,
          };
        }
      }
    }
  }
  return best;
}
