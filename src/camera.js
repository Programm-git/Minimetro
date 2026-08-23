// Hält die Kamera (sichtbarer Kartenausschnitt) innerhalb der Weltgrenzen.
export function clampCamera(camera, worldWidth, worldHeight, viewportWidth, viewportHeight) {
  const maxX = Math.max(0, worldWidth - viewportWidth);
  const maxY = Math.max(0, worldHeight - viewportHeight);
  camera.x = Math.min(Math.max(camera.x, 0), maxX);
  camera.y = Math.min(Math.max(camera.y, 0), maxY);
}

// Zentriert die Kamera auf einen Punkt der Welt (z.B. beim Spielstart).
export function centerCameraOn(camera, x, y, worldWidth, worldHeight, viewportWidth, viewportHeight) {
  camera.x = x - viewportWidth / 2;
  camera.y = y - viewportHeight / 2;
  clampCamera(camera, worldWidth, worldHeight, viewportWidth, viewportHeight);
}
