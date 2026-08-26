// Zentrales Schwierigkeits-/Progressionssystem.
//
// Übersetzt die simulierte Spielzeit (state.elapsed, bereits um die
// Spielgeschwindigkeit bereinigt) in einen DifficultyState. Alle Werte
// entwickeln sich stetig (keine harten Sprünge) und rein zeitbasiert –
// es gibt bewusst kein reaktives Scaling gegen gut spielende Spieler.
//
// Mehrere unabhängige Stellschrauben wirken zusammen (Stationsspawn,
// Nachfragewachstum, seltene Formen, geografische Ausbreitung), statt
// einfach nur eine einzelne Rate hochzudrehen.

import { PROGRESSION_CONFIG } from "./constants.js";

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function smoothstep(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

// Stückweise lineare Interpolation über Zeitanker [{t, v}, ...] (aufsteigend
// sortiert). Vor dem ersten bzw. nach dem letzten Anker bleibt der Wert konstant.
function interpAnchors(anchors, t) {
  if (t <= anchors[0].t) return anchors[0].v;
  for (let i = 1; i < anchors.length; i++) {
    if (t <= anchors[i].t) {
      const seg = (t - anchors[i - 1].t) / (anchors[i].t - anchors[i - 1].t);
      return lerp(anchors[i - 1].v, anchors[i].v, seg);
    }
  }
  return anchors[anchors.length - 1].v;
}

// Multiplikatoren, mit denen sich einzelne Karten (MapConfig) unterschiedlich
// schnell/leicht entwickeln (siehe Design-Dokument §20). Alle optional,
// Standardwert 1 entspricht dem bisherigen, "neutralen" Verhalten.
function normalizeMapMultipliers(map = {}) {
  return {
    stationSpawnRate: map.stationSpawnRate ?? 1,
    passengerSpawnRate: map.passengerSpawnRate ?? 1,
    difficulty: map.difficulty ?? 1,
    expansionRate: map.expansionRate ?? 1,
    rareStationRate: map.rareStationRate ?? 1,
  };
}

export class DifficultyManager {
  constructor(config = PROGRESSION_CONFIG, mapMultipliers = {}) {
    this.config = config;
    this.map = normalizeMapMultipliers(mapMultipliers);
  }

  // Liefert den vollständigen DifficultyState für den gegebenen Zeitpunkt.
  state(elapsed) {
    const c = this.config;
    const t = Math.max(0, elapsed);
    const tEff = Math.max(0, t - c.gracePeriod);

    // --- Stationsspawn-Intervall: sanft von "Anfang" über "Mitte" zu "Spät". ---
    const minAnchors = [
      { t: 0, v: c.stationSpawnStartMin },
      { t: c.stationSpawnMidAt, v: c.stationSpawnMidMin },
      { t: c.stationSpawnLateAt, v: c.stationSpawnLateMin },
    ];
    const maxAnchors = [
      { t: 0, v: c.stationSpawnStartMax },
      { t: c.stationSpawnMidAt, v: c.stationSpawnMidMax },
      { t: c.stationSpawnLateAt, v: c.stationSpawnLateMax },
    ];
    const spawnRateMul = Math.max(0.05, this.map.stationSpawnRate);
    const stationSpawnMin = interpAnchors(minAnchors, t) / spawnRateMul;
    const stationSpawnMax = interpAnchors(maxAnchors, t) / spawnRateMul;

    // --- Fahrgast-Nachfrage: sättigende Wachstumskurve + leichte Schwankung. ---
    const growth = 1 - Math.exp(-c.passengerGrowthRate * tEff);
    const baseMultiplier = 1 + c.passengerGrowthMax * growth;
    const demandWave = 1 + c.demandVariance * Math.sin((2 * Math.PI * t) / c.demandVariancePeriod);
    const passengerRate = baseMultiplier * demandWave * this.map.passengerSpawnRate * this.map.difficulty;

    // --- Seltene Stationsformen: erst ab rareStationsStartAfter, dann sanfte Rampe. ---
    const rareT = clamp01((t - c.rareStationsStartAfter) / c.rareStationsRampTime);
    const rareStationChance = smoothstep(rareT) * c.rareStationMaxChance * this.map.rareStationRate;

    // --- Geografische Ausbreitung: 0 (eng geclustert) -> 1 (volle Kartenausdehnung). ---
    const expansionFactor = smoothstep(clamp01((t * this.map.expansionRate) / c.geographicExpansionTime));

    return {
      passengerRate,
      stationSpawnMin,
      stationSpawnMax,
      rareStationChance,
      expansionFactor,
      demandWave,
      baseMultiplier,
    };
  }
}
