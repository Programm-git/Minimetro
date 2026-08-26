import { todaySeed } from "../seededRandom.js";
import { getDailyPlayedDates, getDailyHighScore } from "../storage/progressStorage.js";

const dailyEl = (id) => document.getElementById(id);
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

let onDailyPlayCallback = null;

function isWeekend(date) {
  const day = date.getDay(); // 0 = Sonntag, 6 = Samstag
  return day === 0 || day === 6;
}

// Anzahl aufeinanderfolgender Tage (rückwärts ab heute) mit einer gespielten
// Daily Challenge. Wurde heute noch nicht gespielt, bricht das die Serie noch
// nicht ab – gezählt wird dann rückwärts ab gestern. An Wochenenden (Samstag/
// Sonntag) wird der Streak eingefroren: ein nicht gespielter Wochenendtag
// bricht die Serie nicht ab (zählt aber auch nicht mit), am Montag muss
// wieder gespielt werden, damit der Streak weiterläuft.
function computeStreak(playedDates, today) {
  const cursor = new Date(today);
  if (!playedDates.has(todaySeed(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const seed = todaySeed(cursor);
    if (playedDates.has(seed)) {
      streak++;
    } else if (isWeekend(cursor)) {
      // eingefroren: weder Abbruch noch Zählung, einfach zum Vortag weiter
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildCalendar(playedDates, today) {
  const grid = dailyEl("daily-calendar-grid");
  grid.innerHTML = "";

  WEEKDAY_LABELS.forEach((label) => {
    const head = document.createElement("div");
    head.className = "calendar-weekday";
    head.textContent = label;
    grid.appendChild(head);
  });

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Montag = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todaySeedStr = todaySeed(today);

  for (let i = 0; i < leadingBlanks; i++) {
    grid.appendChild(document.createElement("div"));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const seed = todaySeed(date);
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    const played = playedDates.has(seed);
    if (played) cell.classList.add("played");
    if (seed === todaySeedStr) cell.classList.add("today");
    // Wochenende ohne Partie: sichtbar als "eingefroren" markieren, damit
    // klar ist, dass der Streak hier nicht bricht, aber Montag wieder
    // gespielt werden muss.
    if (!played && isWeekend(date) && seed < todaySeedStr) cell.classList.add("frozen");
    cell.textContent = String(day);
    grid.appendChild(cell);
  }

  dailyEl("daily-calendar-month").textContent = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function initDailyChallengeScreen({ onPlay, onBack }) {
  onDailyPlayCallback = onPlay;
  dailyEl("btn-daily-play").addEventListener("click", () => onDailyPlayCallback());
  dailyEl("btn-daily-back").addEventListener("click", onBack);
}

export function onDailyChallengeShown() {
  const today = new Date();
  const playedDates = getDailyPlayedDates();
  const streak = computeStreak(playedDates, today);

  dailyEl("daily-streak-value").textContent = String(streak);
  dailyEl("daily-streak-label").textContent = streak === 1 ? "day streak" : "day streak";

  const best = getDailyHighScore(todaySeed(today));
  dailyEl("daily-screen-date").textContent = today.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  dailyEl("daily-screen-best").textContent = best === null
    ? "Today's challenge awaits"
    : `Today's Best: ${best.toLocaleString("en-US")}`;

  buildCalendar(playedDates, today);
}
