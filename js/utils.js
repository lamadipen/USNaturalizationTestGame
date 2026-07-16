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
