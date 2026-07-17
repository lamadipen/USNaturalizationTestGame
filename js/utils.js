// Shared helpers used across game modes.

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomN(arr, n) {
  return shuffleArray(arr).slice(0, n);
}

// Weighted random draw favoring low-mastery questions (for flashcard study mode).
function pickWeightedByMastery(questions, mastery, n) {
  const weighted = questions.map((q) => {
    const level = (mastery[q.id] && mastery[q.id].level) || 0;
    return { q, weight: 6 - level }; // level 0 -> weight 6, level 5 -> weight 1
  });
  const picked = [];
  const pool = weighted.slice();
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    picked.push(pool[idx].q);
    pool.splice(idx, 1);
  }
  return picked;
}

const DYNAMIC_LABELS = {
  senator: "your U.S. senator",
  representative: "your U.S. representative",
  governor: "your governor",
  president: "the President",
  vp: "the Vice President",
  speaker: "the Speaker of the House",
  chiefJustice: "the Chief Justice",
  stateCapital: "your state capital",
};

// Resolves the accepted-answer list for a question, filling in the player's
// own profile answers for the 8 "answers will vary" questions.
function resolveAnswers(question, profile) {
  if (!question.dynamic) return question.answers;
  if (question.dynamic === "stateCapital") {
    const stateObj = US_STATES.find((s) => s.name === profile.state);
    if (stateObj && stateObj.capital) return [stateObj.capital];
    if (stateObj && stateObj.note) return [stateObj.note];
    return [];
  }
  const value = profile[question.dynamic];
  return value ? [value] : [];
}

function hasResolvedAnswer(question, profile) {
  return resolveAnswers(question, profile).length > 0;
}

const ANSWER_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "for", "and", "or", "in", "on", "is", "are",
  "was", "were", "it", "its", "we", "our", "us", "that", "who", "what", "s",
]);

function normalizeAnswerText(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(str) {
  return normalizeAnswerText(str)
    .split(" ")
    .filter((w) => w && !ANSWER_STOPWORDS.has(w) && w.length > 1);
}

// Auto-grades a typed answer against a list of accepted answer strings.
// Only one accepted answer needs to match, same as the old reveal-and-self-grade
// list — the player just needs to name a valid answer, not all of them.
function isAnswerCorrect(userInput, acceptedAnswers) {
  const userNorm = normalizeAnswerText(userInput);
  if (!userNorm || !acceptedAnswers || !acceptedAnswers.length) return false;
  const userWords = new Set(significantWords(userInput));

  return acceptedAnswers.some((raw) => {
    const ansNorm = normalizeAnswerText(raw);
    if (!ansNorm) return false;
    if (ansNorm === userNorm) return true;

    const ansWords = significantWords(raw);
    if (!ansWords.length) return false;

    const matched = ansWords.filter((w) => userWords.has(w));

    // Every meaningful word in the accepted answer shows up in the typed answer.
    if (matched.length === ansWords.length) return true;

    // Multi-word name-like answers ("James Madison"): the surname alone is
    // accepted, the same way it would be in a real spoken interview.
    if (ansWords.length >= 2 && userWords.has(ansWords[ansWords.length - 1])) return true;

    // Longer phrases: accept a strong partial keyword match.
    if (ansWords.length >= 3 && matched.length / ansWords.length >= 0.7) return true;

    return false;
  });
}

const DYNAMIC_PROFILE_FIELDS = ["senator", "representative", "governor", "president", "vp", "speaker", "chiefJustice"];

// Builds a multiple-choice option set for a question: one correct answer plus
// up to 3 wrong-but-plausible distractors, all pre-shuffled. Returns null if
// there isn't enough material to build real choices (e.g. a "answers will
// vary" question where the player has only filled in one profile field) —
// callers should fall back to a self-graded reveal in that case.
function buildAnswerOptions(question, profile) {
  const resolved = resolveAnswers(question, profile);
  if (!resolved.length) return null;
  const correct = resolved[Math.floor(Math.random() * resolved.length)];
  const correctKey = correct.trim().toLowerCase();

  let pool = [];
  if (question.dynamic === "stateCapital") {
    pool = US_STATES.filter((s) => s.capital).map((s) => s.capital);
  } else if (question.dynamic) {
    pool = DYNAMIC_PROFILE_FIELDS.filter((f) => f !== question.dynamic)
      .map((f) => profile[f])
      .filter(Boolean);
  } else {
    const others = CIVICS_QUESTIONS.filter((q) => q.id !== question.id && q.section === question.section && !q.dynamic);
    pool = shuffleArray(others).map((q) => q.answers[Math.floor(Math.random() * q.answers.length)]);
  }

  const seen = new Set([correctKey]);
  const distractors = [];
  for (const candidate of shuffleArray(pool)) {
    if (!candidate) continue;
    const key = candidate.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate);
    if (distractors.length >= 3) break;
  }

  if (!distractors.length) return null;
  return { correct, options: shuffleArray([correct, ...distractors]) };
}

function showToast(iconHtml, text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="toast-icon">${iconHtml}</span><span>${text}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// Awards XP, checks for new badges/level-ups, and surfaces toasts. Call after any scored action.
function awardXp(amount) {
  const before = Store.get();
  const prevLevel = levelForXp(before.xp).name;
  const after = Store.addXp(amount);
  const newLevel = levelForXp(after.xp).name;
  if (newLevel !== prevLevel) {
    showToast("⭐", `Level up! You're now a <strong>${newLevel}</strong>.`);
  }
  const newBadges = checkAndAwardBadges(Store.get());
  newBadges.forEach((id) => {
    const b = BADGES[id];
    showToast(b.icon, `Badge earned: <strong>${b.name}</strong>`);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
