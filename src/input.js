const SCREEN_HIT_RADIUS = 34; // großzügige Trefferzone in Bildschirmpixeln (unabhängig vom Zoom)

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
  let activePointerId = null;

  function toWorldCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const zoom = ui.zoom || 1;
    const screenX = evt.clientX - rect.left;
    const screenY = evt.clientY - rect.top;
    return {
      x: (screenX - (ui.offsetX || 0)) / zoom,
      y: (screenY - (ui.offsetY || 0)) / zoom,
    };
  }

  function worldHitRadius() {
    return SCREEN_HIT_RADIUS / (ui.zoom || 1);
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
    const world = toWorldCoords(evt);
    const station = hitTestStation(state, world.x, world.y, worldHitRadius());
    if (!station) return;
    evt.preventDefault();
    activePointerId = evt.pointerId;
    canvas.setPointerCapture(activePointerId);
    ui.pointer = world;
    startDraftFrom(station);
  }

  function onPointerMove(evt) {
    const world = toWorldCoords(evt);
    if (activePointerId === null || evt.pointerId !== activePointerId) return;
    evt.preventDefault();
    ui.pointer = world;
    const station = hitTestStation(state, world.x, world.y, worldHitRadius());
    if (station) extendDraftTo(station);
  }

  function onPointerUp(evt) {
    if (activePointerId === null || evt.pointerId !== activePointerId) return;
    evt.preventDefault();
    try { canvas.releasePointerCapture(activePointerId); } catch (e) { /* noop */ }
    activePointerId = null;
    finishDraft();
    ui.pointer = null;
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
