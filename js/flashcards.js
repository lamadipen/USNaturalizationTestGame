// Flashcard Study Mode — self-rated recall with a simple spaced-repetition weighting.

const FlashcardsState = {
  filter: "all",
  deck: [],
  index: 0,
  flipped: false,
  sessionStats: { got: 0, shaky: 0, missed: 0 },
};

const SESSION_SIZE = 20;

function flashcardFilterPool(filter) {
  if (filter === "starred") return CIVICS_QUESTIONS.filter((q) => q.starred);
  if (filter === "American Government") return CIVICS_QUESTIONS.filter((q) => q.section === "American Government");
  if (filter === "American History") return CIVICS_QUESTIONS.filter((q) => q.section === "American History");
  if (filter === "Symbols and Holidays") return CIVICS_QUESTIONS.filter((q) => q.section === "Symbols and Holidays");
  if (filter === "weak") {
    const s = Store.get();
    return CIVICS_QUESTIONS.filter((q) => (s.mastery[q.id] ? s.mastery[q.id].level : 0) <= 1);
  }
  return CIVICS_QUESTIONS;
}

function startFlashcardSession(filter) {
  FlashcardsState.filter = filter;
  const s = Store.get();
  const pool = flashcardFilterPool(filter);
  FlashcardsState.deck = pool.length
    ? pickWeightedByMastery(pool, s.mastery, Math.min(SESSION_SIZE, pool.length))
    : [];
  FlashcardsState.index = 0;
  FlashcardsState.flipped = false;
  FlashcardsState.sessionStats = { got: 0, shaky: 0, missed: 0 };
  renderFlashcards();
}

function renderFlashcards() {
  const app = document.getElementById("app");
  const filters = [
    ["all", "All 128"],
    ["starred", "★ 65/20 Set"],
    ["American Government", "Government"],
    ["American History", "History"],
    ["Symbols and Holidays", "Symbols & Holidays"],
    ["weak", "Weak Cards"],
  ];

  const filterRow = `
    <div class="filter-row">
      ${filters.map(([key, label]) => `<button data-filter="${key}" class="${FlashcardsState.filter === key ? "active" : ""}">${label}</button>`).join("")}
    </div>`;

  if (!FlashcardsState.deck.length) {
    app.innerHTML = `
      <h2 class="screen-title">Flashcards</h2>
      <p class="screen-subtitle">Flip each card, try to recall the answer out loud, then rate yourself. Weak cards resurface more often.</p>
      ${filterRow}
      <div class="card" style="text-align:center;">
        <p>No cards match this filter yet. Try a different one, or answer a few questions elsewhere first.</p>
      </div>`;
    attachFlashcardFilterHandlers();
    return;
  }

  if (FlashcardsState.index >= FlashcardsState.deck.length) {
    const { got, shaky, missed } = FlashcardsState.sessionStats;
    app.innerHTML = `
      <h2 class="screen-title">Flashcards</h2>
      ${filterRow}
      <div class="card result-screen">
        <h3>Session complete!</h3>
        <p>✅ Got it: ${got} &nbsp; 🤔 Shaky: ${shaky} &nbsp; ❌ Missed: ${missed}</p>
        <button class="btn btn-primary" id="newSessionBtn">Start Another Session</button>
      </div>`;
    attachFlashcardFilterHandlers();
    document.getElementById("newSessionBtn").onclick = () => startFlashcardSession(FlashcardsState.filter);
    return;
  }

  const q = FlashcardsState.deck[FlashcardsState.index];
  const profile = Store.get().profile;
  const answers = resolveAnswers(q, profile);
  const answersHtml = answers.length
    ? `<ul class="answers-list">${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
    : `<p><em>You haven't set this answer yet — add it in Settings (it's a "your own answer" question like ${DYNAMIC_LABELS[q.dynamic] || "this one"}).</em></p>`;

  app.innerHTML = `
    <h2 class="screen-title">Flashcards</h2>
    <p class="screen-subtitle">Card ${FlashcardsState.index + 1} of ${FlashcardsState.deck.length}</p>
    ${filterRow}
    <div class="flip-card-scene">
      <div class="flip-card ${FlashcardsState.flipped ? "flipped" : ""}" id="flipCard">
        <div class="flip-card-inner">
          <div class="flip-card-face flip-card-front">
            <div class="qnum">${q.section} ${q.starred ? '<span class="star">★</span>' : ""}</div>
            <div class="qtext">${escapeHtml(q.question)}</div>
          </div>
          <div class="flip-card-face flip-card-back">
            <div class="qnum">Accepted answer(s)</div>
            ${answersHtml}
          </div>
        </div>
      </div>
    </div>
    <div class="rate-row">
      ${
        FlashcardsState.flipped
          ? `
        <button class="btn btn-primary" data-rate="got">✅ Got it</button>
        <button class="btn btn-outline" data-rate="shaky">🤔 Shaky</button>
        <button class="btn" style="background:#e2e6ee;" data-rate="missed">❌ Missed</button>
      `
          : `<button class="btn btn-secondary" id="flipBtn">Tap card to reveal answer</button>`
      }
    </div>`;

  attachFlashcardFilterHandlers();

  const cardEl = document.getElementById("flipCard");
  const doFlip = () => {
    FlashcardsState.flipped = true;
    renderFlashcards();
  };
  if (cardEl) cardEl.onclick = doFlip;
  const flipBtn = document.getElementById("flipBtn");
  if (flipBtn) flipBtn.onclick = doFlip;

  document.querySelectorAll("[data-rate]").forEach((btn) => {
    btn.onclick = () => rateFlashcard(q, btn.dataset.rate);
  });
}

function attachFlashcardFilterHandlers() {
  document.querySelectorAll(".filter-row [data-filter]").forEach((btn) => {
    btn.onclick = () => startFlashcardSession(btn.dataset.filter);
  });
}

function rateFlashcard(question, rating) {
  const current = Store.getMastery(question.id).level;
  let newLevel = current;
  let xp = 0;
  if (rating === "got") {
    newLevel = Math.min(5, current + 1);
    xp = 10;
    FlashcardsState.sessionStats.got++;
  } else if (rating === "shaky") {
    newLevel = Math.max(0, current); // hold steady, needs more practice
    xp = 5;
    FlashcardsState.sessionStats.shaky++;
  } else {
    newLevel = 0;
    xp = 0;
    FlashcardsState.sessionStats.missed++;
  }
  Store.setMastery(question.id, newLevel);
  Store.touchStreak();
  if (xp > 0) awardXp(xp);
  else checkAndAwardBadgesQuiet();

  FlashcardsState.index++;
  FlashcardsState.flipped = false;
  renderFlashcards();
  updateHeaderStats();
}

function checkAndAwardBadgesQuiet() {
  const newly = checkAndAwardBadges(Store.get());
  newly.forEach((id) => {
    const b = BADGES[id];
    showToast(b.icon, `Badge earned: <strong>${b.name}</strong>`);
  });
}
