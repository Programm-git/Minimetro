// Deterministischer Zufallsgenerator für die Daily Challenge: derselbe Seed
// (Kalendertag) erzeugt für alle Spieler exakt dieselbe Zahlenfolge.

function hashStringToInt(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// mulberry32 PRNG – klein, schnell, ausreichend gut für Spielzwecke.
export function createSeededRandom(seed) {
  let a = hashStringToInt(String(seed));
  return function seededRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Heutiges Datum als stabiler Seed-String, z.B. "2026-08-24" (lokale Zeitzone).
export function todaySeed(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
