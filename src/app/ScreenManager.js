// Zentrale Verwaltung, welcher App-Bildschirm gerade sichtbar ist. Ersetzt
// verstreute `element.style.display = ...`-Aufrufe durch eine einzige Stelle:
// jeder Screen ist ein Element mit der Klasse "app-screen"; sichtbar ist er,
// wenn zusätzlich die Klasse "active" gesetzt ist (weicher Crossfade per CSS).
export class ScreenManager {
  constructor(screenElementsById) {
    this.screens = screenElementsById; // { screenName: HTMLElement }
    this.current = null;
  }

  show(name) {
    if (this.current === name) return;
    if (this.current && this.screens[this.current]) {
      this.screens[this.current].classList.remove("active");
    }
    const next = this.screens[name];
    if (next) next.classList.add("active");
    this.current = name;
  }
}
