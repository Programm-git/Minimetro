import {
  LINE_COLORS, DAY_SECONDS, WEEKDAYS, INITIAL_STATION_COUNT, INITIAL_MAX_LINES,
  INITIAL_TUNNELS, INITIAL_TRAIN_CAPACITY, INITIAL_STATION_CAPACITY,
  PASSENGER_SPAWN_INTERVAL_STATION_BASE, PASSENGER_SPAWN_INTERVAL_MIN,
  OVERCROWD_COUNTDOWN, TRAIN_SPEED, TRAIN_DWELL_TIME, MAX_LINE_SLOTS,
  SHAPES, COMMON_SHAPES, SHAPE_DEMAND_WEIGHT, STATION_POPULARITY_MIN, STATION_POPULARITY_MAX,
  WORLD_PADDING, PROGRESSION_CONFIG,
} from "./constants.js";
import { generateRivers, findStationPosition, pickShape, segmentCrossesAnyWater } from "./mapgen.js";
import { buildGraph, findRoute } from "./routing.js";
import { DifficultyManager } from "./progression.js";

let uid = 1;
const nextId = (prefix) => `${prefix}${uid++}`;

export const UPGRADE_DEFS = {
  extra_train: {
    id: "extra_train", icon: "🚆", name: "Zusätzlicher Zug",
    desc: "Ein neuer Zug verstärkt eine bestehende Linie.",
  },
  extra_line: {
    id: "extra_line", icon: "🛤️", name: "Zusätzliche Linie",
    desc: "Ein neuer Linien-Slot wird freigeschaltet.",
  },
  extra_carriage: {
    id: "extra_carriage", icon: "🚋", name: "Zusätzlicher Waggon",
    desc: "Alle Züge erhalten mehr Platz für Fahrgäste.",
  },
  extra_tunnel: {
    id: "extra_tunnel", icon: "⛰️", name: "Tunnel / Brücke",
    desc: "Eine zusätzliche Flussquerung wird möglich.",
  },
  bigger_station: {
    id: "bigger_station", icon: "🏗️", name: "Größere Stationen",
    desc: "Alle Stationen fassen mehr wartende Fahrgäste.",
  },
  faster_trains: {
    id: "faster_trains", icon: "⚡", name: "Schnellere Züge",
    desc: "Alle Züge fahren spürbar schneller.",
  },
};

// Vollständige Default-Konfiguration, falls kein (oder ein unvollständiges)
// MapConfig übergeben wird – entspricht dem bisherigen Standardverhalten.
const DEFAULT_MAP_CONFIG = {
  id: "default",
  name: "Standard",
  riverCount: 1,
  riverWidthMultiplier: 1,
  initialStations: INITIAL_STATION_COUNT,
  initialLines: INITIAL_MAX_LINES,
  initialTunnels: INITIAL_TUNNELS,
  initialTrains: 1,
  stationSpawnRate: 1,
  passengerSpawnRate: 1,
  difficulty: 1,
  expansionRate: 1,
  rareStationRate: 1,
};

export class GameState {
  constructor(width, height, rng, config) {
    this.rng = rng || Math.random;
    this.config = { ...DEFAULT_MAP_CONFIG, ...(config || {}) };
    this.width = width;
    this.height = height;
    this.rivers = generateRivers(width, height, this.rng, this.config.riverCount, this.config.riverWidthMultiplier);

    // Zentrale Schwierigkeits-/Progressionslogik (siehe progression.js): alle
    // Karten-spezifischen Multiplikatoren fließen hier gebündelt ein.
    this.difficulty = new DifficultyManager(PROGRESSION_CONFIG, {
      stationSpawnRate: this.config.stationSpawnRate,
      passengerSpawnRate: this.config.passengerSpawnRate,
      difficulty: this.config.difficulty,
      expansionRate: this.config.expansionRate,
      rareStationRate: this.config.rareStationRate,
    });
    // Geografische Ausbreitung: neue Stationen entstehen zunächst eng um das
    // Kartenzentrum geclustert (clusterRadius) und dürfen sich erst mit
    // wachsendem expansionFactor bis maxSpawnRadius über die Karte verteilen.
    this.worldCenter = { x: width / 2, y: height / 2 };
    this.clusterRadius = Math.min(width, height) * 0.18;
    this.maxSpawnRadius = Math.hypot(width, height) / 2 - WORLD_PADDING;

    this.stations = []; // Station[]
    this.lines = [];    // Line[]
    this.trains = [];   // Train[]
    this.passengers = []; // waiting passengers (also live inside trains via train.passengers)

    this.elapsed = 0;       // simulierte Sekunden seit Spielstart
    this.day = 1;           // Spieltag (1-basiert)
    this.weekday = 0;       // 0..6
    this.week = 0;
    this.dayTimer = 0;

    this.maxLines = this.config.initialLines;
    this.tunnelsAvailable = this.config.initialTunnels;
    this.stationCapacityBonus = 0;
    this.trainCapacityBonus = 0;
    this.trainSpeedMultiplier = 1;
    this._starterTrainsGranted = false;

    this.transportedCount = 0;
    this.maxWaitingSeen = 0;

    // Zeitpunkt, ab dem keine neue Station mehr auf der Karte Platz fand
    // (null = Karte noch nicht voll). Ab dann greift der Endgame-Crunch
    // (siehe _endgameCrunchFactor) statt eines Nachfrage-Plateaus.
    this.mapFullSince = null;

    const startDifficulty = this.difficulty.state(0);
    this.stationSpawnTimer = startDifficulty.stationSpawnMin
      + this.rng() * (startDifficulty.stationSpawnMax - startDifficulty.stationSpawnMin);

    this.gameOver = false;
    this.gameOverReason = "";
    this.paused = false;
    this.speed = 1;

    this.pendingUpgradeChoices = null; // wenn gesetzt -> UI muss Auswahl zeigen

    this._seedInitialStations();
  }

  _seedInitialStations() {
    // Der Spielstart ist bewusst eng geclustert (siehe §3/§17): ein kleines,
    // überschaubares Startgebiet statt sofort über die ganze Karte verteilter Stationen.
    const opts = { center: this.worldCenter, maxRadius: this.clusterRadius };
    for (let i = 0; i < this.config.initialStations; i++) {
      const pos = findStationPosition(this.stations, this.rivers, this.width, this.height, this.rng, opts);
      if (!pos) continue;
      this.stations.push(this._makeStation(pos.x, pos.y, COMMON_SHAPES[i % COMMON_SHAPES.length]));
    }
  }

  _makeStation(x, y, shape) {
    const station = {
      id: nextId("s"),
      x, y, shape,
      waiting: [], // Passenger[]
      capacity: INITIAL_STATION_CAPACITY,
      overcrowdTimer: 0,
      isOvercrowded: false,
      // "Beliebtheit" dieser Station als Fahrgast-Startpunkt (siehe §6):
      // meist niedrig, gelegentlich deutlich höher, driftet über die Zeit.
      popularity: this._rollPopularity(),
      nextPassengerTimer: 0,
    };
    // Leicht versetzter Start-Timer, damit nicht alle Stationen synchron feuern.
    station.nextPassengerTimer = this._stationPassengerInterval(station) * (0.4 + this.rng() * 0.6);
    return station;
  }

  // Sekunden bis zum nächsten Fahrgast an dieser einen Station: Fahrgäste
  // entstehen pro Station unabhängig (siehe §5/§17), gewichtet mit der
  // globalen Progressionsrate UND der individuellen Stations-Beliebtheit
  // (§6) – dadurch wächst die Gesamtnachfrage organisch mit der Stadtgröße.
  _stationPassengerInterval(station) {
    const d = this.difficulty.state(this.elapsed);
    const rate = Math.max(0.05, d.passengerRate * station.popularity * this._endgameCrunchFactor());
    return Math.max(PASSENGER_SPAWN_INTERVAL_MIN, PASSENGER_SPAWN_INTERVAL_STATION_BASE / rate);
  }

  // Sobald die Karte keinen Platz mehr für neue Stationen bietet (siehe
  // _updateStationSpawning), gibt es kein Nachfrage-Plateau mehr: die
  // Fahrgastrate wächst ab dann exponentiell weiter, statt sich weiter zu
  // sättigen. Ein volles Netz kann so nicht mehr auf unbegrenzte Zeit
  // "ausgesessen" werden – gegen Spielende wird es dadurch so gut wie
  // unmöglich, weiterzumachen. Die Spielregeln selbst (Kapazitäten,
  // Countdown) bleiben dabei unverändert; nur der Nachfragedruck steigt.
  _endgameCrunchFactor() {
    if (this.mapFullSince == null) return 1;
    const t = this.elapsed - this.mapFullSince;
    return Math.exp(t / PROGRESSION_CONFIG.endgameCrunchTau);
  }

  // Meiste Stationen bleiben normal frequentiert, einzelne werden per Zufall
  // (kubisch zugunsten niedriger Werte verzerrt) zu spürbaren Hotspots.
  _rollPopularity() {
    const skew = Math.pow(this.rng(), 3);
    return STATION_POPULARITY_MIN + skew * (STATION_POPULARITY_MAX - STATION_POPULARITY_MIN);
  }

  stationCapacity(station) {
    return station.capacity + this.stationCapacityBonus;
  }

  getStationById(id) { return this.stations.find((s) => s.id === id); }
  getLineById(id) { return this.lines.find((l) => l.id === id); }

  // --- Linien ---------------------------------------------------------------

  usedColorIds() { return new Set(this.lines.map((l) => l.colorId)); }

  nextFreeColor() {
    const used = this.usedColorIds();
    return LINE_COLORS.find((c) => !used.has(c.id)) || null;
  }

  // Berechnet, wie viele NEUE Wasserquerungen eine Stationsfolge benötigt
  // (verglichen mit optional übergebenen bereits gezählten Segmenten).
  // `loop`: zusätzlich die schließende Kante von der letzten zur ersten
  // Station mitzählen (Ringlinie).
  countWaterCrossings(stationIds, loop = false) {
    let count = 0;
    for (let i = 0; i < stationIds.length - 1; i++) {
      const a = this.getStationById(stationIds[i]);
      const b = this.getStationById(stationIds[i + 1]);
      if (a && b && segmentCrossesAnyWater(a, b, this.rivers)) count++;
    }
    if (loop && stationIds.length >= 3) {
      const a = this.getStationById(stationIds[stationIds.length - 1]);
      const b = this.getStationById(stationIds[0]);
      if (a && b && segmentCrossesAnyWater(a, b, this.rivers)) count++;
    }
    return count;
  }

  canAffordLine(existingLine, newStationIds, loop = false) {
    const existingCrossings = existingLine ? existingLine.tunnelUsage : 0;
    const newCrossings = this.countWaterCrossings(newStationIds, loop);
    const delta = newCrossings - existingCrossings;
    return delta <= this.tunnelsAvailable;
  }

  // Erstellt eine neue Linie oder aktualisiert eine bestehende (per lineId).
  // `isLoop`: die Linie schließt sich von der letzten zurück zur ersten
  // Station (Ringlinie) – Züge fahren dann immer in eine Richtung weiter,
  // statt an den Enden umzukehren.
  // Gibt {ok, error} zurück.
  commitLine(lineId, stationIds, isLoop = false) {
    if (stationIds.length < 2) return { ok: false, error: "zu kurz" };
    const loop = isLoop && stationIds.length >= 3;
    const existing = lineId ? this.getLineById(lineId) : null;

    if (!this.canAffordLine(existing, stationIds, loop)) {
      return { ok: false, error: "Nicht genug Tunnel!" };
    }

    const newCrossings = this.countWaterCrossings(stationIds, loop);

    if (existing) {
      this.tunnelsAvailable += existing.tunnelUsage;
      existing.stations = stationIds.slice();
      existing.tunnelUsage = newCrossings;
      existing.isLoop = loop;
      this.tunnelsAvailable -= newCrossings;
      this._clampTrainsToLine(existing);
      return { ok: true, line: existing };
    }

    if (this.lines.length >= this.maxLines) return { ok: false, error: "Keine Linie frei" };
    const color = this.nextFreeColor();
    if (!color) return { ok: false, error: "Keine Farbe frei" };

    const line = {
      id: nextId("l"),
      colorId: color.id,
      color: color.css,
      stations: stationIds.slice(),
      tunnelUsage: newCrossings,
      isLoop: loop,
    };
    this.tunnelsAvailable -= newCrossings;
    this.lines.push(line);
    this._spawnTrainForLine(line);

    // Die erste jemals gebaute Linie erhält ggf. zusätzliche Starter-Züge
    // (siehe MapConfig.initialTrains).
    if (!this._starterTrainsGranted) {
      this._starterTrainsGranted = true;
      for (let i = 1; i < this.config.initialTrains; i++) this._spawnTrainForLine(line);
    }
    return { ok: true, line };
  }

  // Fügt eine bereits bestehende Station in einen bestehenden Streckenabschnitt
  // (zwischen den Stationen an segmentIndex und segmentIndex+1) einer Linie ein.
  // Aus [A, B, C] mit segmentIndex 0 und Ziel D wird [A, D, B, C]. Das ist
  // ausdrücklich kein neuer Ast, sondern eine Umleitung der bestehenden Linie.
  insertStationIntoLineSegment(lineId, segmentIndex, newStationId) {
    const line = this.getLineById(lineId);
    if (!line) return { ok: false, error: "Linie nicht gefunden" };
    const edgeCount = line.isLoop ? line.stations.length : line.stations.length - 1;
    if (segmentIndex < 0 || segmentIndex >= edgeCount) {
      return { ok: false, error: "Ungültiger Streckenabschnitt" };
    }
    // Bei einer Ringlinie ist der letzte Abschnitt die schließende Kante
    // von der letzten zurück zur ersten Station.
    const isWrapEdge = segmentIndex === line.stations.length - 1;

    const fromStationId = line.stations[segmentIndex];
    const toStationId = isWrapEdge ? line.stations[0] : line.stations[segmentIndex + 1];
    const newStation = this.getStationById(newStationId);
    if (!newStation) return { ok: false, error: "Station nicht gefunden" };
    if (newStationId === fromStationId || newStationId === toStationId) {
      return { ok: false, error: "Station ist bereits Teil dieses Abschnitts" };
    }
    if (line.stations.includes(newStationId)) {
      return { ok: false, error: "Station bereits auf dieser Linie" };
    }

    const oldStations = line.stations.slice();
    const newStations = oldStations.slice();
    // Bei der schließenden Kante wird die neue Station einfach ans Ende
    // angehängt (danach folgt weiterhin die erste Station als Ringschluss).
    newStations.splice(isWrapEdge ? newStations.length : segmentIndex + 1, 0, newStationId);

    if (!this.canAffordLine(line, newStations, line.isLoop)) {
      return { ok: false, error: "Nicht genug Tunnel!" };
    }

    const newCrossings = this.countWaterCrossings(newStations, line.isLoop);
    this.tunnelsAvailable += line.tunnelUsage;
    line.stations = newStations;
    line.tunnelUsage = newCrossings;
    this.tunnelsAvailable -= newCrossings;

    this._remapTrainsForInsertedStation(line, oldStations, fromStationId, toStationId, newStationId);
    return { ok: true, line };
  }

  // Überträgt jeden Zug der Linie sauber auf die neue Stationsreihenfolge:
  // Züge außerhalb des geteilten Segments werden anhand ihrer Stations-IDs
  // (stabil, unabhängig vom Array-Index) neu zugeordnet. Der Zug, der gerade
  // exakt auf dem geteilten Segment fährt oder dort steht, wird proportional
  // zur Sehnenlänge auf das passende der beiden neuen Teilsegmente projiziert,
  // sodass er nie an eine andere Stelle springt.
  _remapTrainsForInsertedStation(line, oldStations, fromId, toId, newId) {
    const from = this.getStationById(fromId);
    const to = this.getStationById(toId);
    const mid = this.getStationById(newId);
    const dAD = from && mid ? Math.hypot(mid.x - from.x, mid.y - from.y) : 0;
    const dDB = mid && to ? Math.hypot(to.x - mid.x, to.y - mid.y) : 0;
    const splitT = dAD + dDB > 0 ? dAD / (dAD + dDB) : 0.5;

    for (const train of this.trains) {
      if (train.lineId !== line.id) continue;
      const oldFromId = oldStations[train.fromIndex];
      const oldToId = oldStations[train.toIndex];
      if (oldFromId === undefined || oldToId === undefined) continue;

      const forwardMatch = oldFromId === fromId && oldToId === toId;
      const backwardMatch = oldFromId === toId && oldToId === fromId;

      if (forwardMatch || backwardMatch) {
        const t = forwardMatch ? train.t : 1 - train.t; // in A→B-Richtung normalisiert
        let newFromId, newToId, newT;
        if (t <= splitT) {
          newFromId = fromId; newToId = newId;
          newT = splitT > 0 ? t / splitT : 0;
        } else {
          newFromId = newId; newToId = toId;
          newT = 1 - splitT > 0 ? (t - splitT) / (1 - splitT) : 1;
        }
        newT = Math.max(0, Math.min(1, newT));
        if (backwardMatch) {
          const swap = newFromId; newFromId = newToId; newToId = swap;
          newT = 1 - newT;
        }
        train.fromIndex = line.stations.indexOf(newFromId);
        train.toIndex = line.stations.indexOf(newToId);
        train.t = newT;
      } else {
        const idxFrom = line.stations.indexOf(oldFromId);
        const idxTo = line.stations.indexOf(oldToId);
        if (idxFrom !== -1) train.fromIndex = idxFrom;
        if (idxTo !== -1) train.toIndex = idxTo;
      }
    }
  }

  removeLine(lineId) {
    const line = this.getLineById(lineId);
    if (!line) return;
    this.tunnelsAvailable += line.tunnelUsage;
    // Fahrgäste in den Zügen dieser Linie wieder an aktueller Station warten lassen
    for (const train of this.trains) {
      if (train.lineId === lineId) {
        const station = this.getStationById(train.atStationId || line.stations[0]);
        if (station) station.waiting.push(...train.passengers);
      }
    }
    this.trains = this.trains.filter((t) => t.lineId !== lineId);
    this.lines = this.lines.filter((l) => l.id !== lineId);
  }

  _clampTrainsToLine(line) {
    for (const train of this.trains) {
      if (train.lineId !== line.id) continue;
      train.fromIndex = Math.min(train.fromIndex, line.stations.length - 1);
      train.toIndex = Math.min(train.toIndex, line.stations.length - 1);
      if (train.fromIndex === train.toIndex) {
        train.state = "dwelling";
        train.dwellTimer = 0.05;
        train.atStationId = line.stations[train.fromIndex];
      }
    }
  }

  _spawnTrainForLine(line) {
    const train = {
      id: nextId("t"),
      lineId: line.id,
      capacity: INITIAL_TRAIN_CAPACITY,
      passengers: [],
      state: "dwelling",
      fromIndex: 0,
      toIndex: 0,
      t: 0,
      dwellTimer: TRAIN_DWELL_TIME,
      atStationId: line.stations[0],
      direction: 1,
    };
    this.trains.push(train);
    return train;
  }

  addTrainToAnyLine() {
    if (this.lines.length === 0) return false;
    // Linie mit den wenigsten Zügen bevorzugen
    let best = this.lines[0];
    let bestCount = Infinity;
    for (const line of this.lines) {
      const count = this.trains.filter((t) => t.lineId === line.id).length;
      if (count < bestCount) { bestCount = count; best = line; }
    }
    this._spawnTrainForLine(best);
    return true;
  }

  // --- Fahrgäste --------------------------------------------------------------

  spawnPassenger(station) {
    const otherShapes = SHAPES.filter((s) => s !== station.shape && this.stations.some((st) => st.shape === s));
    if (otherShapes.length === 0) return;
    // Gewichtete Zielwahl (§8): seltene Formen sind überproportional gefragte
    // Ziele, sodass z.B. eine einzelne Stern-Station zum Verkehrsknoten wird.
    const total = otherShapes.reduce((sum, s) => sum + SHAPE_DEMAND_WEIGHT[s], 0);
    let r = this.rng() * total;
    let destShape = otherShapes[otherShapes.length - 1];
    for (const s of otherShapes) {
      r -= SHAPE_DEMAND_WEIGHT[s];
      if (r <= 0) { destShape = s; break; }
    }
    station.waiting.push({ id: nextId("p"), destShape, spawnedAt: this.elapsed });
  }

  // Lässt die Beliebtheit einiger zufälliger Stationen leicht driften, damit
  // sich Belastungsschwerpunkte im Spielverlauf verschieben können.
  _driftPopularity() {
    if (this.stations.length === 0) return;
    const count = this.stations.length > 6 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const station = this.stations[Math.floor(this.rng() * this.stations.length)];
      const delta = (this.rng() - 0.5) * 1.4;
      station.popularity = Math.max(STATION_POPULARITY_MIN, Math.min(STATION_POPULARITY_MAX, station.popularity + delta));
    }
  }

  // Radius um das Kartenzentrum, in dem neue Stationen aktuell entstehen
  // dürfen (§3: wächst über die Spielzeit von einem engen Cluster bis zur
  // vollen Kartenausdehnung).
  _expansionRadius(expansionFactor) {
    return this.clusterRadius + (this.maxSpawnRadius - this.clusterRadius) * expansionFactor;
  }

  // --- Update-Schleife ----------------------------------------------------------

  update(dtReal) {
    if (this.gameOver || this.paused || this.pendingUpgradeChoices) return;
    const dt = dtReal * this.speed;
    if (dt <= 0) return;
    this.elapsed += dt;

    this._updateDayCycle(dt);
    this._updateStationSpawning(dt);
    this._updatePassengerSpawning(dt);
    this._updateTrains(dt);
    this._updateOvercrowding(dt);
  }

  _updateDayCycle(dt) {
    this.dayTimer += dt;
    while (this.dayTimer >= DAY_SECONDS) {
      this.dayTimer -= DAY_SECONDS;
      this.day += 1;
      this.weekday = (this.weekday + 1) % 7;
      if (this.weekday === 0) {
        this.week += 1;
        this._triggerWeekUpgrade();
      }
    }
  }

  _triggerWeekUpgrade() {
    const pool = Object.keys(UPGRADE_DEFS);
    const picks = [];
    const shuffled = pool.slice().sort(() => this.rng() - 0.5);
    // In frühen Wochen bevorzugt Zug/Linie anbieten
    if (this.week <= 2) {
      picks.push("extra_train", "extra_line");
    }
    for (const id of shuffled) {
      if (picks.length >= 2) break;
      if (!picks.includes(id)) picks.push(id);
    }
    this.pendingUpgradeChoices = picks.slice(0, 2);
  }

  applyUpgrade(upgradeId) {
    switch (upgradeId) {
      case "extra_train": this.addTrainToAnyLine(); break;
      case "extra_line": this.maxLines = Math.min(MAX_LINE_SLOTS, this.maxLines + 1); break;
      case "extra_carriage": this.trainCapacityBonus += INITIAL_TRAIN_CAPACITY; break;
      case "extra_tunnel": this.tunnelsAvailable += 1; break;
      case "bigger_station": this.stationCapacityBonus += 2; break;
      case "faster_trains": this.trainSpeedMultiplier += 0.15; break;
    }
    this.pendingUpgradeChoices = null;
  }

  _updateStationSpawning(dt) {
    this.stationSpawnTimer -= dt;
    if (this.stationSpawnTimer > 0) return;
    const d = this.difficulty.state(this.elapsed);
    this.stationSpawnTimer = d.stationSpawnMin + this.rng() * (d.stationSpawnMax - d.stationSpawnMin);

    const maxRadius = this._expansionRadius(d.expansionFactor);
    const pos = findStationPosition(this.stations, this.rivers, this.width, this.height, this.rng, {
      center: this.worldCenter, maxRadius,
    });
    if (!pos) {
      // Kein Platz mehr auf der gesamten Karte: Endgame-Crunch aktivieren
      // (siehe _endgameCrunchFactor), sofern noch nicht aktiv.
      if (this.mapFullSince == null) this.mapFullSince = this.elapsed;
      return;
    }
    this.mapFullSince = null;
    const shape = pickShape(d.rareStationChance, this.rng);
    this.stations.push(this._makeStation(pos.x, pos.y, shape));
    this._driftPopularity();
  }

  // Jede Station läuft auf ihrem eigenen Fahrgast-Timer (siehe
  // _stationPassengerInterval) statt auf einer einzelnen globalen Rate –
  // dadurch steigt die Gesamtnachfrage automatisch mit der Stadtgröße.
  _updatePassengerSpawning(dt) {
    for (const station of this.stations) {
      station.nextPassengerTimer -= dt;
      if (station.nextPassengerTimer > 0) continue;
      this.spawnPassenger(station);
      station.nextPassengerTimer = this._stationPassengerInterval(station);
    }
  }

  _stationsById() {
    const map = new Map();
    for (const s of this.stations) map.set(s.id, s);
    return map;
  }

  _updateTrains(dt) {
    if (this.trains.length === 0) return;
    const stationsById = this._stationsById();
    const graph = buildGraph(this.lines);
    const speed = TRAIN_SPEED * this.trainSpeedMultiplier;

    for (const train of this.trains) {
      const line = this.getLineById(train.lineId);
      if (!line || line.stations.length < 2) continue;

      if (train.state === "dwelling") {
        train.dwellTimer -= dt;
        if (train.dwellTimer <= 0) {
          this._departTrain(train, line);
        }
        continue;
      }

      // moving
      const fromStation = stationsById.get(line.stations[train.fromIndex]);
      const toStation = stationsById.get(line.stations[train.toIndex]);
      if (!fromStation || !toStation) continue;
      const dist = Math.hypot(toStation.x - fromStation.x, toStation.y - fromStation.y) || 1;
      train.t += (speed * dt) / dist;

      if (train.t >= 1) {
        train.t = 1;
        train.state = "dwelling";
        train.dwellTimer = TRAIN_DWELL_TIME;
        train.atStationId = toStation.id;
        this._handleStationStop(train, toStation, stationsById, graph);
      }
    }
  }

  _departTrain(train, line) {
    const stops = line.stations;
    // Ringlinie: am "Ende" des Arrays einfach zur ersten Station weiterfahren
    // (bzw. umgekehrt), statt an den Enden umzukehren.
    if (line.isLoop && stops.length >= 3) {
      const nextIndex = (train.toIndex + train.direction + stops.length) % stops.length;
      train.fromIndex = train.toIndex;
      train.toIndex = nextIndex;
      train.t = 0;
      train.state = "moving";
      train.atStationId = null;
      return;
    }

    let nextIndex = train.toIndex + train.direction;
    if (nextIndex < 0 || nextIndex >= stops.length) {
      train.direction *= -1;
      nextIndex = train.toIndex + train.direction;
    }
    if (nextIndex < 0 || nextIndex >= stops.length) {
      // Linie mit nur einer Station: einfach stehen bleiben
      train.dwellTimer = 0.3;
      return;
    }
    train.fromIndex = train.toIndex;
    train.toIndex = nextIndex;
    train.t = 0;
    train.state = "moving";
    train.atStationId = null;
  }

  // Fahrgäste aussteigen/umsteigen/einsteigen lassen.
  _handleStationStop(train, station, stationsById, graph) {
    const line = this.getLineById(train.lineId);
    const stops = line.stations;
    const nextIndexIfContinue = train.toIndex + train.direction;
    const nextStopId = (line.isLoop && stops.length >= 3)
      ? stops[(nextIndexIfContinue + stops.length) % stops.length]
      : (nextIndexIfContinue >= 0 && nextIndexIfContinue < stops.length)
        ? stops[nextIndexIfContinue]
        : stops[train.toIndex - train.direction]; // Endstation kehrt um

    // 1) Aussteigen: Ziel erreicht oder Linie hilft nicht mehr weiter.
    const staying = [];
    for (const p of train.passengers) {
      if (p.destShape === station.shape) {
        this.transportedCount += 1;
        continue; // ausgestiegen am Ziel
      }
      const route = findRoute(station.id, p.destShape, stationsById, graph);
      const nextNeeded = route && route.length > 1 ? route[1] : null;
      if (nextNeeded && nextNeeded === nextStopId) {
        staying.push(p); // bleibt im Zug, Linie bringt ihn weiter
      } else {
        station.waiting.push(p); // umsteigen: an Station warten
      }
    }
    train.passengers = staying;

    // 2) Einsteigen: wartende Fahrgäste, für die dieser Zug der nächste sinnvolle Schritt ist.
    const capacity = train.capacity + this.trainCapacityBonus;
    const stillWaiting = [];
    for (const p of station.waiting) {
      if (train.passengers.length >= capacity) { stillWaiting.push(p); continue; }
      const route = findRoute(station.id, p.destShape, stationsById, graph);
      const nextNeeded = route && route.length > 1 ? route[1] : null;
      if (nextNeeded && nextNeeded === nextStopId) {
        train.passengers.push(p);
      } else {
        stillWaiting.push(p);
      }
    }
    station.waiting = stillWaiting;
  }

  _updateOvercrowding(dt) {
    let maxWaiting = 0;
    for (const station of this.stations) {
      maxWaiting = Math.max(maxWaiting, station.waiting.length);
      const cap = this.stationCapacity(station);
      if (station.waiting.length > cap) {
        station.isOvercrowded = true;
        station.overcrowdTimer += dt;
        if (station.overcrowdTimer >= OVERCROWD_COUNTDOWN) {
          this.gameOver = true;
          this.gameOverReason = "Eine Station war zu lange überfüllt.";
        }
      } else {
        station.isOvercrowded = false;
        station.overcrowdTimer = 0;
      }
    }
    this.maxWaitingSeen = Math.max(this.maxWaitingSeen, maxWaiting);
  }

  weekdayName() { return WEEKDAYS[this.weekday]; }

  // Momentaufnahme für den Debug-Modus (§23): fasst Kernkennzahlen der
  // Progression und der aktuellen Netzbelastung zusammen.
  debugSnapshot() {
    const d = this.difficulty.state(this.elapsed);
    const waitingPassengers = this.stations.reduce((sum, s) => sum + s.waiting.length, 0);
    const passengersInTrains = this.trains.reduce((sum, t) => sum + t.passengers.length, 0);
    const criticalStations = this.stations
      .filter((s) => s.waiting.length > this.stationCapacity(s) * 0.6)
      .map((s) => ({ id: s.id, shape: s.shape, waiting: s.waiting.length, capacity: this.stationCapacity(s) }))
      .sort((a, b) => b.waiting - a.waiting);

    return {
      elapsed: this.elapsed,
      stations: this.stations.length,
      totalPassengers: this.transportedCount,
      waitingPassengers,
      passengersInTrains,
      difficulty: d.baseMultiplier,
      passengerSpawnRate: d.passengerRate,
      nextStationSpawn: Math.max(0, this.stationSpawnTimer),
      rareStationChance: d.rareStationChance,
      expansionFactor: d.expansionFactor,
      mapFull: this.mapFullSince != null,
      endgameCrunch: this._endgameCrunchFactor(),
      criticalStations,
    };
  }
}
