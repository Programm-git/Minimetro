// Hält die Kamera innerhalb sinnvoller Grenzen. Ist der sichtbare Bereich
// (bei aktuellem Zoom) größer als die Welt, wird die Welt zentriert
// (Rauszoomen zeigt Rand/Freiraum). Andernfalls wird ganz normal geclamped.
export function clampCamera(camera, zoom, worldWidth, worldHeight, viewportWidth, viewportHeight) {
  const visW = viewportWidth / zoom;
  const visH = viewportHeight / zoom;

  camera.x = visW >= worldWidth
    ? (worldWidth - visW) / 2
    : Math.min(Math.max(camera.x, 0), worldWidth - visW);

  camera.y = visH >= worldHeight
    ? (worldHeight - visH) / 2
    : Math.min(Math.max(camera.y, 0), worldHeight - visH);
}

// Zoomt so, dass der Weltpunkt unter `screenX/screenY` an derselben
// Bildschirmposition stehen bleibt (Zoom "unter dem Finger/Cursor").
export function zoomAt(ui, screenX, screenY, targetZoom, minZoom, maxZoom, worldWidth, worldHeight, viewportWidth, viewportHeight) {
  const worldX = screenX / ui.zoom + ui.camera.x;
  const worldY = screenY / ui.zoom + ui.camera.y;

  ui.zoom = Math.min(maxZoom, Math.max(minZoom, targetZoom));
  ui.camera.x = worldX - screenX / ui.zoom;
  ui.camera.y = worldY - screenY / ui.zoom;

  clampCamera(ui.camera, ui.zoom, worldWidth, worldHeight, viewportWidth, viewportHeight);
}
