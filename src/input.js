import { clampCamera, zoomAt } from "./camera.js";
import { buildOffsetTable, findSegmentAtPoint } from "./lineLayout.js";

const SCREEN_HIT_RADIUS = 34; // großzügige Trefferzone in Bildschirmpixeln (unabhängig vom Zoom)
const ZOOM_OUT_FACTOR = 0.5; // wie weit über die "ganze Karte sichtbar"-Stufe hinaus rausgezoomt werden darf
const ZOOM_IN_FACTOR = 3.5; // wie weit für Details reingezoomt werden darf
const WHEEL_SENSITIVITY = 0.0015;
const SEGMENT_HIT_SCREEN_WIDTH = 30; // Trefferbreite für Streckenauswahl in Bildschirmpixeln (breiter als die sichtbare Linie)
const SEGMENT_HIT_TOUCH_MULTIPLIER = 1.8; // Finger sind ungenauer als eine Maus – Trefferzone bei Touch großzügiger
const DRAG_THRESHOLD = 6; // Bildschirmpixel Bewegung, bevor ein Tap zum Segment-Zieh-Vorgang wird

function segmentHitWidth(pointerType, zoom) {
  const base = pointerType === "touch" ? SEGMENT_HIT_SCREEN_WIDTH * SEGMENT_HIT_TOUCH_MULTIPLIER : SEGMENT_HIT_SCREEN_WIDTH;
  return base / zoom;
}

function hitTestStation(state, x, y, worldHitRadius) {
  let best = null;
  let bestDist = worldHitRadius;
  for (const s of state.stations) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// Ringlinien haben keine bearbeitbaren Endpunkte im klassischen Sinn (Anfang
// und Ende sind bereits über die Schließungskante verbunden) – daher hier
// ausgeschlossen, damit ein Antippen einer ihrer Stationen nicht versehentlich
// versucht, sie "weiterzuziehen".
function findLineWithEndpoint(state, stationId) {
  return state.lines.find((l) => !l.isLoop && (l.stations[0] === stationId || l.stations[l.stations.length - 1] === stationId));
}

export function attachInput(canvas, state, ui, hooks) {
  let draftPointerId = null;
  const panPointers = new Map(); // pointerId -> letzte Bildschirmposition (Pan / Pinch-Zoom)
  let lastPinchDist = null;

  // Segment-Ziehen (bestehende Station in eine Strecke einfügen): pendingSegment
  // hält den Treffer + Startposition, solange die Bewegung noch unter dem
  // DRAG_THRESHOLD liegt (=> als Tap behandelt). Erst danach wird ui.segmentDrag
  // gesetzt, damit ein einfaches Antippen einer Strecke keine Vorschau zeigt.
  let segmentPointerId = null;
  let pendingSegment = null; // { seg, downScreen }

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
      ui.draft = { lineId: line.id, stationIds, color: line.color, isLoop: false };
      ui.selectedLineId = line.id;
      return;
    }
    // Ausgewählte Linie an einer mittleren Station kürzen/neu verlegen
    if (ui.selectedLineId) {
      const selected = state.getLineById(ui.selectedLineId);
      if (selected) {
        const idx = selected.stations.indexOf(station.id);
        if (idx !== -1) {
          ui.draft = { lineId: selected.id, stationIds: selected.stations.slice(0, idx + 1), color: selected.color, isLoop: false };
          return;
        }
      }
    }
    // Neue Linie
    if (state.lines.length >= state.maxLines) {
      hooks.onToast("Keine Linie mehr frei");
      return;
    }
    ui.draft = { lineId: null, stationIds: [station.id], color: null, isLoop: false };
  }

  function extendDraftTo(station) {
    if (!ui.draft) return;
    const ids = ui.draft.stationIds;
    const last = ids[ids.length - 1];
    if (station.id === last) return;
    // Zurückziehen auf die vorletzte Station -> Linie dort kürzen
    if (ids.length >= 2 && ids[ids.length - 2] === station.id) {
      ids.pop();
      ui.draft.isLoop = false;
      return;
    }
    // Zurück zur allerersten Station gezogen -> Ringlinie schließen (mind. 3
    // Stationen nötig, sonst wäre es nur ein Hin-und-Her auf einer Kante).
    if (station.id === ids[0] && ids.length >= 3) {
      ui.draft.isLoop = true;
      return;
    }
    if (ids.includes(station.id)) return; // keine sonstigen Schleifen
    ui.draft.isLoop = false;
    ids.push(station.id);
  }

  function finishDraft() {
    if (!ui.draft) return;
    const { lineId, stationIds, isLoop } = ui.draft;
    if (stationIds.length >= 2) {
      const result = state.commitLine(lineId, stationIds, isLoop);
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

    if (draftPointerId === null && segmentPointerId === null && !panPointers.has(evt.pointerId)) {
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

      // Keine Station getroffen: prüfen, ob ein bestehendes Streckensegment
      // getroffen wurde (für's Einfügen einer Station per Ziehen). Der eigentliche
      // Zieh-Modus (ui.segmentDrag) startet erst, wenn DRAG_THRESHOLD überschritten
      // wird, damit ein kurzes Antippen keine Bearbeitung auslöst.
      const seg = findSegmentAtPoint(state, buildOffsetTable(state.lines), world, segmentHitWidth(evt.pointerType, ui.zoom));
      if (seg) {
        evt.preventDefault();
        segmentPointerId = evt.pointerId;
        canvas.setPointerCapture(segmentPointerId);
        pendingSegment = { seg, downScreen: screen };
        // Sofortiges, dezentes Feedback beim Antippen: der getroffene Abschnitt
        // hebt sich leicht hervor, noch bevor DRAG_THRESHOLD überschritten wird
        // und der eigentliche Zieh-Modus (ui.segmentDrag) beginnt.
        ui.pressedSegment = { lineId: seg.lineId, segmentIndex: seg.segmentIndex };
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

    if (evt.pointerId === segmentPointerId) {
      evt.preventDefault();
      const r = rect();
      const screen = screenPoint(evt, r);
      const world = toWorldCoords(screen);

      if (!ui.segmentDrag) {
        const dist = Math.hypot(screen.x - pendingSegment.downScreen.x, screen.y - pendingSegment.downScreen.y);
        if (dist < DRAG_THRESHOLD) return;
        const { seg } = pendingSegment;
        ui.pressedSegment = null; // die dezente Antipp-Hervorhebung weicht der vollen Zieh-Vorschau
        ui.segmentDrag = {
          lineId: seg.lineId,
          segmentIndex: seg.segmentIndex,
          fromStationId: seg.fromStationId,
          toStationId: seg.toStationId,
          pointer: world,
          hoverStationId: null,
        };
      }

      ui.segmentDrag.pointer = world;
      const line = state.getLineById(ui.segmentDrag.lineId);
      const candidate = hitTestStation(state, world.x, world.y, worldHitRadius());
      if (
        candidate &&
        candidate.id !== ui.segmentDrag.fromStationId &&
        candidate.id !== ui.segmentDrag.toStationId &&
        line && !line.stations.includes(candidate.id)
      ) {
        ui.segmentDrag.hoverStationId = candidate.id;
      } else {
        ui.segmentDrag.hoverStationId = null;
      }
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

    if (evt.pointerId === segmentPointerId) {
      evt.preventDefault();
      try { canvas.releasePointerCapture(segmentPointerId); } catch (e) { /* noop */ }
      segmentPointerId = null;
      const drag = ui.segmentDrag;
      pendingSegment = null;
      ui.segmentDrag = null;
      ui.pressedSegment = null;
      if (drag && drag.hoverStationId) {
        const result = state.insertStationIntoLineSegment(drag.lineId, drag.segmentIndex, drag.hoverStationId);
        if (!result.ok) {
          hooks.onToast(result.error);
        } else {
          hooks.onLinesChanged();
        }
      }
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

  const onContextMenu = (e) => e.preventDefault();

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  // Aufräumfunktion: entfernt alle Listener wieder (bei jedem Neustart einer
  // Partie aufrufen, bevor attachInput erneut für den neuen State genutzt wird).
  return function detachInput() {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onContextMenu);
  };
}
