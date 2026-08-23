import { clampCamera } from "./camera.js";

const HIT_RADIUS = 28; // großzügige Trefferzone für Maus & Touch

function hitTestStation(state, x, y) {
  let best = null;
  let bestDist = HIT_RADIUS;
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
  let activePointerId = null;
  let mode = null; // "draft" | "pan"
  let panStart = null; // { screenX, screenY, camX, camY }

  function screenCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top, rectW: rect.width, rectH: rect.height };
  }

  function toWorldCoords(screen) {
    return { x: screen.x + ui.camera.x, y: screen.y + ui.camera.y };
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
    if (activePointerId !== null) return;
    const screen = screenCoords(evt);
    const world = toWorldCoords(screen);
    const station = hitTestStation(state, world.x, world.y);
    evt.preventDefault();
    activePointerId = evt.pointerId;
    canvas.setPointerCapture(activePointerId);

    if (station) {
      mode = "draft";
      ui.pointer = world;
      startDraftFrom(station);
    } else {
      mode = "pan";
      panStart = { screenX: screen.x, screenY: screen.y, camX: ui.camera.x, camY: ui.camera.y, rectW: screen.rectW, rectH: screen.rectH };
    }
  }

  function onPointerMove(evt) {
    if (activePointerId === null || evt.pointerId !== activePointerId) return;
    evt.preventDefault();
    const screen = screenCoords(evt);

    if (mode === "draft") {
      const world = toWorldCoords(screen);
      ui.pointer = world;
      const station = hitTestStation(state, world.x, world.y);
      if (station) extendDraftTo(station);
    } else if (mode === "pan") {
      const dx = screen.x - panStart.screenX;
      const dy = screen.y - panStart.screenY;
      ui.camera.x = panStart.camX - dx;
      ui.camera.y = panStart.camY - dy;
      clampCamera(ui.camera, state.width, state.height, panStart.rectW, panStart.rectH);
    }
  }

  function onPointerUp(evt) {
    if (activePointerId === null || evt.pointerId !== activePointerId) return;
    evt.preventDefault();
    try { canvas.releasePointerCapture(activePointerId); } catch (e) { /* noop */ }
    activePointerId = null;
    if (mode === "draft") finishDraft();
    mode = null;
    panStart = null;
    ui.pointer = null;
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
