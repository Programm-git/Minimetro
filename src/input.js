import { clampCamera, zoomAt } from "./camera.js";

const SCREEN_HIT_RADIUS = 34; // großzügige Trefferzone in Bildschirmpixeln (unabhängig vom Zoom)
const ZOOM_OUT_FACTOR = 0.5; // wie weit über die "ganze Karte sichtbar"-Stufe hinaus rausgezoomt werden darf
const ZOOM_IN_FACTOR = 3.5; // wie weit für Details reingezoomt werden darf
const WHEEL_SENSITIVITY = 0.0015;

function hitTestStation(state, x, y, worldHitRadius) {
  let best = null;
  let bestDist = worldHitRadius;
  for (const s of state.stations) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestDist) { bestDist = d; best = s; }
  }
  return best;
}

function findLineWithEndpoint(state, stationId) {
  return state.lines.find((l) => l.stations[0] === stationId || l.stations[l.stations.length - 1] === stationId);
}

export function attachInput(canvas, state, ui, hooks) {
  let draftPointerId = null;
  const panPointers = new Map(); // pointerId -> letzte Bildschirmposition (Pan / Pinch-Zoom)
  let lastPinchDist = null;

  function rect() { return canvas.getBoundingClientRect(); }

  function screenPoint(evt, r) {
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }

  function toWorldCoords(screen) {
    return { x: screen.x / ui.zoom + ui.camera.x, y: screen.y / ui.zoom + ui.camera.y };
  }

  function worldHitRadius() {
    return SCREEN_HIT_RADIUS / ui.zoom;
  }

  function zoomBounds(r) {
    const fitZoom = Math.min(r.width / state.width, r.height / state.height);
    return { min: fitZoom * ZOOM_OUT_FACTOR, max: fitZoom * ZOOM_IN_FACTOR };
  }

  function startDraftFrom(station) {
    // Bestehende Linie an ihrem Endpunkt weiterziehen
    const line = findLineWithEndpoint(state, station.id);
    if (line) {
      let stationIds = line.stations.slice();
      if (stationIds[0] === station.id && stationIds[stationIds.length - 1] !== station.id) {
        stationIds = stationIds.slice().reverse();
      }
      ui.draft = { lineId: line.id, stationIds, color: line.color };
      ui.selectedLineId = line.id;
      return;
    }
    // Ausgewählte Linie an einer mittleren Station kürzen/neu verlegen
    if (ui.selectedLineId) {
      const selected = state.getLineById(ui.selectedLineId);
      if (selected) {
        const idx = selected.stations.indexOf(station.id);
        if (idx !== -1) {
          ui.draft = { lineId: selected.id, stationIds: selected.stations.slice(0, idx + 1), color: selected.color };
          return;
        }
      }
    }
    // Neue Linie
    if (state.lines.length >= state.maxLines) {
      hooks.onToast("Keine Linie mehr frei");
      return;
    }
    ui.draft = { lineId: null, stationIds: [station.id], color: null };
  }

  function extendDraftTo(station) {
    if (!ui.draft) return;
    const ids = ui.draft.stationIds;
    const last = ids[ids.length - 1];
    if (station.id === last) return;
    // Zurückziehen auf die vorletzte Station -> Linie dort kürzen
    if (ids.length >= 2 && ids[ids.length - 2] === station.id) {
      ids.pop();
      return;
    }
    if (ids.includes(station.id)) return; // keine Schleifen
    ids.push(station.id);
  }

  function finishDraft() {
    if (!ui.draft) return;
    const { lineId, stationIds } = ui.draft;
    if (stationIds.length >= 2) {
      const result = state.commitLine(lineId, stationIds);
      if (!result.ok) {
        hooks.onToast(result.error);
      } else {
        ui.selectedLineId = result.line.id;
        hooks.onLinesChanged();
      }
    }
    ui.draft = null;
  }

  function onPointerDown(evt) {
    const r = rect();
    const screen = screenPoint(evt, r);

    if (draftPointerId === null && !panPointers.has(evt.pointerId)) {
      const world = toWorldCoords(screen);
      const station = hitTestStation(state, world.x, world.y, worldHitRadius());
      if (station) {
        evt.preventDefault();
        draftPointerId = evt.pointerId;
        canvas.setPointerCapture(draftPointerId);
        ui.pointer = world;
        startDraftFrom(station);
        return;
      }
    }

    // Freie Fläche: zum Verschieben/Zoomen der Karte verwenden
    evt.preventDefault();
    canvas.setPointerCapture(evt.pointerId);
    panPointers.set(evt.pointerId, screen);
    if (panPointers.size !== 2) lastPinchDist = null;
  }

  function onPointerMove(evt) {
    if (evt.pointerId === draftPointerId) {
      evt.preventDefault();
      const r = rect();
      const world = toWorldCoords(screenPoint(evt, r));
      ui.pointer = world;
      const station = hitTestStation(state, world.x, world.y, worldHitRadius());
      if (station) extendDraftTo(station);
      return;
    }

    if (!panPointers.has(evt.pointerId)) return;
    evt.preventDefault();
    const r = rect();
    const screen = screenPoint(evt, r);
    const prev = panPointers.get(evt.pointerId);
    panPointers.set(evt.pointerId, screen);

    if (panPointers.size === 1) {
      const dx = screen.x - prev.x, dy = screen.y - prev.y;
      ui.camera.x -= dx / ui.zoom;
      ui.camera.y -= dy / ui.zoom;
      clampCamera(ui.camera, ui.zoom, state.width, state.height, r.width, r.height);
    } else if (panPointers.size === 2) {
      const pts = Array.from(panPointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDist != null && lastPinchDist > 1) {
        const scale = dist / lastPinchDist;
        const { min, max } = zoomBounds(r);
        zoomAt(ui, midX, midY, ui.zoom * scale, min, max, state.width, state.height, r.width, r.height);
      }
      lastPinchDist = dist;
    }
  }

  function onPointerUp(evt) {
    if (evt.pointerId === draftPointerId) {
      evt.preventDefault();
      try { canvas.releasePointerCapture(draftPointerId); } catch (e) { /* noop */ }
      draftPointerId = null;
      finishDraft();
      ui.pointer = null;
      return;
    }
    if (panPointers.has(evt.pointerId)) {
      evt.preventDefault();
      try { canvas.releasePointerCapture(evt.pointerId); } catch (e) { /* noop */ }
      panPointers.delete(evt.pointerId);
      if (panPointers.size !== 2) lastPinchDist = null;
    }
  }

  function onWheel(evt) {
    evt.preventDefault();
    const r = rect();
    const screen = screenPoint(evt, r);
    const factor = Math.exp(-evt.deltaY * WHEEL_SENSITIVITY);
    const { min, max } = zoomBounds(r);
    zoomAt(ui, screen.x, screen.y, ui.zoom * factor, min, max, state.width, state.height, r.width, r.height);
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
