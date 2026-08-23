// Reine Graphen-/Routinglogik, unabhängig von Rendering und Animation.

// Baut eine Adjazenzliste aus allen Linien (Kante = zwei auf einer Linie
// direkt aufeinanderfolgende Stationen). Mehrere Linien auf derselben
// Kante erzeugen keine Duplikate.
export function buildGraph(lines) {
  const adjacency = new Map();
  const ensure = (id) => {
    if (!adjacency.has(id)) adjacency.set(id, new Set());
    return adjacency.get(id);
  };
  for (const line of lines) {
    const stops = line.stations;
    for (let i = 0; i < stops.length - 1; i++) {
      ensure(stops[i]).add(stops[i + 1]);
      ensure(stops[i + 1]).add(stops[i]);
    }
  }
  return adjacency;
}

// BFS von `fromId` zur nächstgelegenen Station mit Form `targetShape`.
// Gibt den Stationspfad (inkl. Start und Ziel) zurück oder null.
export function findRoute(fromId, targetShape, stationsById, adjacency) {
  const start = stationsById.get(fromId);
  if (!start) return null;

  const visited = new Set([fromId]);
  const queue = [fromId];
  const prev = new Map();

  while (queue.length) {
    const current = queue.shift();
    const station = stationsById.get(current);
    if (station && station.shape === targetShape && current !== fromId) {
      // Pfad rekonstruieren
      const path = [current];
      let node = current;
      while (prev.has(node)) {
        node = prev.get(node);
        path.push(node);
      }
      path.reverse();
      return path;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        prev.set(n, current);
        queue.push(n);
      }
    }
  }
  return null;
}
