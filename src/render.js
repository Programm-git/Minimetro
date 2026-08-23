import { STATION_RADIUS, OVERCROWD_COUNTDOWN } from "./constants.js";

const LINE_SPACING = 7; // Pixelabstand paralleler Linien auf gemeinsamer Kante

function edgeKey(aId, bId) { return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`; }

// Ermittelt für jede (Linie, Segment)-Kombination den Parallel-Offset-Index,
// damit mehrere Linien auf derselben Strecke sichtbar nebeneinander verlaufen.
function buildOffsetTable(lines) {
  const edgeLines = new Map(); // edgeKey -> [lineId,...] in fester Reihenfolge
  for (const line of lines) {
    for (let i = 0; i < line.stations.length - 1; i++) {
      const key = edgeKey(line.stations[i], line.stations[i + 1]);
      if (!edgeLines.has(key)) edgeLines.set(key, []);
      const arr = edgeLines.get(key);
      if (!arr.includes(line.id)) arr.push(line.id);
    }
  }
  return edgeLines;
}

function offsetForSegment(edgeLines, aId, bId, lineId) {
  const key = edgeKey(aId, bId);
  const arr = edgeLines.get(key) || [lineId];
  const idx = arr.indexOf(lineId);
  const count = arr.length;
  return (idx - (count - 1) / 2) * LINE_SPACING;
}

function perpOffset(ax, ay, bx, by, amount) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * amount, y: (dx / len) * amount };
}

export function pointOnLineAtSegment(state, edgeLines, line, fromIdx, toIdx, t) {
  const a = state.getStationById(line.stations[fromIdx]);
  const b = state.getStationById(line.stations[toIdx]);
  if (!a || !b) return { x: 0, y: 0 };
  const off = offsetForSegment(edgeLines, a.id, b.id, line.id);
  const p = perpOffset(a.x, a.y, b.x, b.y, off);
  return {
    x: a.x + (b.x - a.x) * t + p.x,
    y: a.y + (b.y - a.y) * t + p.y,
  };
}

function drawShape(ctx, shape, x, y, r, fillStyle, strokeStyle, lineWidth) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(x - r * 0.87, y - r * 0.87, r * 1.74, r * 1.74);
      break;
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
    case "star": {
      const spikes = 5, outer = r * 1.25, inner = r * 0.55;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const ang = (Math.PI / spikes) * i - Math.PI / 2;
        const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "cross": {
      const w = r * 0.5, l = r * 1.2;
      ctx.moveTo(x - w, y - l); ctx.lineTo(x + w, y - l);
      ctx.lineTo(x + w, y - w); ctx.lineTo(x + l, y - w);
      ctx.lineTo(x + l, y + w); ctx.lineTo(x + w, y + w);
      ctx.lineTo(x + w, y + l); ctx.lineTo(x - w, y + l);
      ctx.lineTo(x - w, y + w); ctx.lineTo(x - l, y + w);
      ctx.lineTo(x - l, y - w); ctx.lineTo(x - w, y - w);
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
  if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth || 2; ctx.stroke(); }
}

export function draw(ctx, state, ui) {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height);
  drawRiver(ctx, state.river);

  const edgeLines = buildOffsetTable(state.lines);
  drawLines(ctx, state, edgeLines);
  if (ui.draft && ui.draft.stationIds.length > 0) drawDraft(ctx, state, ui.draft, ui.pointer);
  drawTrains(ctx, state, edgeLines);
  drawStations(ctx, state, ui);
}

function drawBackground(ctx, w, h) {
  ctx.fillStyle = "#eef0e9";
  ctx.fillRect(0, 0, w, h);
}

function drawRiver(ctx, river) {
  if (!river || river.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "#a9c9d6";
  ctx.lineWidth = river.halfWidth * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(river.points[0].x, river.points[0].y);
  for (let i = 1; i < river.points.length; i++) ctx.lineTo(river.points[i].x, river.points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawLines(ctx, state, edgeLines) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of state.lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < line.stations.length; i++) {
      const st = state.getStationById(line.stations[i]);
      if (!st) continue;
      let x = st.x, y = st.y;
      if (i < line.stations.length - 1) {
        const next = state.getStationById(line.stations[i + 1]);
        if (next) {
          const off = offsetForSegment(edgeLines, st.id, next.id, line.id);
          const p = perpOffset(st.x, st.y, next.x, next.y, off);
          x += p.x; y += p.y;
        }
      } else if (i > 0) {
        const prev = state.getStationById(line.stations[i - 1]);
        if (prev) {
          const off = offsetForSegment(edgeLines, prev.id, st.id, line.id);
          const p = perpOffset(prev.x, prev.y, st.x, st.y, off);
          x += p.x; y += p.y;
        }
      }
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawDraft(ctx, state, draft, pointer) {
  ctx.save();
  ctx.strokeStyle = draft.color || "#333";
  ctx.lineWidth = 5;
  ctx.setLineDash([2, 10]);
  ctx.lineCap = "round";
  ctx.beginPath();
  draft.stationIds.forEach((id, i) => {
    const st = state.getStationById(id);
    if (!st) return;
    if (i === 0) ctx.moveTo(st.x, st.y); else ctx.lineTo(st.x, st.y);
  });
  if (pointer) ctx.lineTo(pointer.x, pointer.y);
  ctx.stroke();
  ctx.restore();
}

function drawTrains(ctx, state, edgeLines) {
  for (const train of state.trains) {
    const line = state.getLineById(train.lineId);
    if (!line) continue;
    let pos, angle = 0;
    if (train.state === "dwelling") {
      const st = state.getStationById(train.atStationId);
      if (!st) continue;
      pos = { x: st.x, y: st.y };
    } else {
      const a = state.getStationById(line.stations[train.fromIndex]);
      const b = state.getStationById(line.stations[train.toIndex]);
      if (!a || !b) continue;
      pos = pointOnLineAtSegment(state, edgeLines, line, train.fromIndex, train.toIndex, train.t);
      angle = Math.atan2(b.y - a.y, b.x - a.x);
    }

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    const w = 22, h = 12;
    roundRect(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fahrgäste als kleine Punkte über dem Zug
    if (train.passengers.length > 0) {
      const n = train.passengers.length;
      const spacing = 6;
      const startX = pos.x - ((n - 1) * spacing) / 2;
      ctx.save();
      for (let i = 0; i < n; i++) {
        drawShape(ctx, train.passengers[i].destShape, startX + i * spacing, pos.y - 14, 3, shapeColor(train.passengers[i].destShape), null, 0);
      }
      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shapeColor(shape) {
  const map = {
    circle: "#4a4f54", triangle: "#4a4f54", square: "#4a4f54",
    diamond: "#4a4f54", star: "#4a4f54", cross: "#4a4f54",
  };
  return map[shape] || "#4a4f54";
}

function drawStations(ctx, state, ui) {
  for (const station of state.stations) {
    const isEndpointHighlight = ui.draft && ui.draft.stationIds.includes(station.id);

    // Überfüllungs-Countdown-Ring
    if (station.isOvercrowded) {
      const progress = Math.min(1, station.overcrowdTimer / OVERCROWD_COUNTDOWN);
      const pulse = 1 + Math.sin(performance.now() / 140) * 0.06;
      ctx.save();
      ctx.beginPath();
      ctx.arc(station.x, station.y, (STATION_RADIUS + 9) * pulse, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = "#e05a4e";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    drawShape(ctx, station.shape, station.x, station.y, STATION_RADIUS,
      isEndpointHighlight ? "#fff8ea" : "#ffffff",
      isEndpointHighlight ? "#c9a227" : "#2b2f33", isEndpointHighlight ? 3 : 2.2);

    drawWaitingPassengers(ctx, station);
  }
}

function drawWaitingPassengers(ctx, station) {
  const n = station.waiting.length;
  if (n === 0) return;
  const cap = station.capacity;
  const cols = 4;
  const dotR = 3;
  const spacing = 8;
  const baseX = station.x - ((Math.min(n, cols) - 1) * spacing) / 2;
  const baseY = station.y + STATION_RADIUS + 12;
  const showCount = Math.min(n, 16);
  for (let i = 0; i < showCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = baseX + col * spacing;
    const y = baseY + row * spacing;
    const overCap = i >= cap;
    drawShape(ctx, station.waiting[i].destShape, x, y, dotR, overCap ? "#e05a4e" : "#5b6167", null, 0);
  }
  if (n > showCount) {
    ctx.save();
    ctx.fillStyle = "#e05a4e";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`+${n - showCount}`, baseX, baseY + Math.ceil(showCount / cols) * spacing + 10);
    ctx.restore();
  }
}
