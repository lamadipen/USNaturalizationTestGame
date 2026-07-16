// localStorage persistence layer
const STORAGE_KEY = "civicsGame.v1";

function defaultState() {
  return {
    profile: {
      state: null,
      capital: null,
      senator: "",
      representative: "",
      governor: "",
      president: "",
      vp: "",
      speaker: "",
      chiefJustice: "",
      onboarded: false,
    },
    mastery: {}, // { [questionId]: { level: 0-5, lastSeen: isoString } }
    xp: 0,
    badges: [], // badge ids earned
    streak: { count: 0, lastPlayed: null },
    highScores: { timed60: 0, timed90: 0, timed120: 0 },
    interviewHistory: [], // { date, correct, total, passed, mode: 'full'|'6520' }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // shallow-merge with defaults so new fields are added gracefully
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      mastery: parsed.mastery || {},
      highScores: { ...base.highScores, ...(parsed.highScores || {}) },
      streak: { ...base.streak, ...(parsed.streak || {}) },
    };
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const Store = {
  get: loadState,
  save: saveState,

  updateProfile(patch) {
    const s = loadState();
    s.profile = { ...s.profile, ...patch };
    saveState(s);
    return s;
  },

  getMastery(questionId) {
    const s = loadState();
    return s.mastery[questionId] || { level: 0, lastSeen: null };
  },

  setMastery(questionId, level) {
    const s = loadState();
    s.mastery[questionId] = { level, lastSeen: new Date().toISOString() };
    saveState(s);
    return s;
  },

  addXp(amount) {
    const s = loadState();
    s.xp += amount;
    saveState(s);
    return s;
  },

  awardBadge(badgeId) {
    const s = loadState();
    if (!s.badges.includes(badgeId)) {
      s.badges.push(badgeId);
      saveState(s);
      return { state: s, isNew: true };
    }
    return { state: s, isNew: false };
  },

  touchStreak() {
    const s = loadState();
    const today = new Date().toISOString().slice(0, 10);
    const last = s.streak.lastPlayed;
    if (last === today) {
      // already counted today
    } else if (last === yesterday(today)) {
      s.streak.count += 1;
      s.streak.lastPlayed = today;
    } else {
      s.streak.count = 1;
      s.streak.lastPlayed = today;
    }
    saveState(s);
    return s;
  },

  setHighScore(mode, score) {
    const s = loadState();
    if (score > (s.highScores[mode] || 0)) {
      s.highScores[mode] = score;
      saveState(s);
      return { state: s, isNewRecord: true };
    }
    return { state: s, isNewRecord: false };
  },

  addInterviewResult(result) {
    const s = loadState();
    s.interviewHistory.unshift(result);
    s.interviewHistory = s.interviewHistory.slice(0, 20);
    saveState(s);
    return s;
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

function yesterday(isoDateStr) {
  const d = new Date(isoDateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
