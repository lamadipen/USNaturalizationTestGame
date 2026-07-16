// XP levels, badges, and streak-driven progression — the "learn by playing" motivation layer.

const LEVELS = [
  { name: "Newcomer", minXp: 0 },
  { name: "Green Card Holder", minXp: 100 },
  { name: "Resident", minXp: 250 },
  { name: "Civics Student", minXp: 500 },
  { name: "Citizenship Candidate", minXp: 900 },
  { name: "Interview Ready", minXp: 1400 },
  { name: "Oath Taker", minXp: 2000 },
  { name: "Naturalized Citizen", minXp: 2800 },
];

function levelForXp(xp) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const xpIntoLevel = xp - current.minXp;
  const xpForNext = next ? next.minXp - current.minXp : null;
  return {
    index: idx,
    name: current.name,
    next: next ? next.name : null,
    xpIntoLevel,
    xpForNext,
    progressPct: next ? Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) : 100,
  };
}

const BADGES = {
  "first-steps": { name: "First Steps", icon: "🌱", desc: "Answered your first civics question." },
  "gov-scholar": { name: "Government Scholar", icon: "🏛️", desc: "Mastered every American Government question." },
  "history-buff": { name: "History Buff", icon: "📜", desc: "Mastered every American History question." },
  "symbols-savant": { name: "Symbols Savant", icon: "🗽", desc: "Mastered every Symbols & Holidays question." },
  "full-house": { name: "Full House", icon: "🏆", desc: "Mastered all 128 civics questions." },
  "passed-interview": { name: "Interview Passed", icon: "✅", desc: "Passed a mock naturalization interview." },
  "perfect-interview": { name: "Perfect Interview", icon: "🎖️", desc: "Scored 20 for 20 on a full mock interview." },
  "ready-6520": { name: "65/20 Ready", icon: "⭐", desc: "Passed a 65/20 mock interview (6 of 10 starred questions)." },
  "speed-demon": { name: "Speed Demon", icon: "⚡", desc: "Answered 15+ correctly in one Timed Speed Round." },
  "streak-3": { name: "3-Day Streak", icon: "🔥", desc: "Played 3 days in a row." },
  "streak-7": { name: "Week-Long Streak", icon: "🔥", desc: "Played 7 days in a row." },
  "streak-30": { name: "Dedicated Citizen", icon: "🔥", desc: "Played 30 days in a row." },
};

// Returns array of newly-awarded badge ids (also persists them via Store.awardBadge)
function checkAndAwardBadges(state) {
  const newly = [];
  const tryAward = (id) => {
    const { isNew } = Store.awardBadge(id);
    if (isNew) newly.push(id);
  };

  const masteredIds = Object.entries(state.mastery)
    .filter(([, m]) => m.level >= 4)
    .map(([id]) => Number(id));

  if (masteredIds.length >= 1) tryAward("first-steps");

  const bySection = (section) =>
    CIVICS_QUESTIONS.filter((q) => q.section === section).every((q) => masteredIds.includes(q.id));

  if (bySection("American Government")) tryAward("gov-scholar");
  if (bySection("American History")) tryAward("history-buff");
  if (bySection("Symbols and Holidays")) tryAward("symbols-savant");
  if (masteredIds.length >= 128) tryAward("full-house");

  const lastInterview = state.interviewHistory[0];
  if (lastInterview) {
    if (lastInterview.passed) tryAward("passed-interview");
    if (lastInterview.mode === "full" && lastInterview.correct === 20 && lastInterview.total === 20) {
      tryAward("perfect-interview");
    }
    if (lastInterview.mode === "6520" && lastInterview.passed) tryAward("ready-6520");
  }

  const best = Math.max(state.highScores.timed60 || 0, state.highScores.timed90 || 0, state.highScores.timed120 || 0);
  if (best >= 15) tryAward("speed-demon");

  if (state.streak.count >= 3) tryAward("streak-3");
  if (state.streak.count >= 7) tryAward("streak-7");
  if (state.streak.count >= 30) tryAward("streak-30");

  return newly;
}
