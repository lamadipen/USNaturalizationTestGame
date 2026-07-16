// Timed Speed Round — beat-the-clock arcade drilling for fast recall.

const TimedState = {
  duration: null,
  timeLeft: 0,
  timerId: null,
  queue: [],
  current: null,
  revealed: false,
  score: 0,
  combo: 0,
  bestCombo: 0,
  running: false,
};

function nextTimedQuestion() {
  if (!TimedState.queue.length) {
    TimedState.queue = shuffleArray(CIVICS_QUESTIONS);
  }
  TimedState.current = TimedState.queue.pop();
  TimedState.revealed = false;
}

function startTimedRound(duration) {
  TimedState.duration = duration;
  TimedState.timeLeft = duration;
  TimedState.queue = shuffleArray(CIVICS_QUESTIONS);
  TimedState.score = 0;
  TimedState.combo = 0;
  TimedState.bestCombo = 0;
  TimedState.running = true;
  nextTimedQuestion();
  renderTimed();

  clearInterval(TimedState.timerId);
  TimedState.timerId = setInterval(() => {
    TimedState.timeLeft--;
    if (TimedState.timeLeft <= 0) {
      clearInterval(TimedState.timerId);
      TimedState.running = false;
      renderTimed();
    } else {
      updateTimedTimerOnly();
    }
  }, 1000);
}

function updateTimedTimerOnly() {
  const el = document.getElementById("timedTimerVal");
  if (!el) return;
  el.textContent = TimedState.timeLeft;
  el.parentElement.classList.toggle("urgent", TimedState.timeLeft <= 10);
}

function renderTimed() {
  const app = document.getElementById("app");

  if (!TimedState.duration) {
    app.innerHTML = `
      <h2 class="screen-title">Timed Speed Round</h2>
      <p class="screen-subtitle">Rapid-fire recall against the clock. Chain correct answers for combo bonuses. Beat your high score!</p>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-value">${Store.get().highScores.timed60}</div><div class="stat-label">Best (60s)</div></div>
        <div class="stat-box"><div class="stat-value">${Store.get().highScores.timed90}</div><div class="stat-label">Best (90s)</div></div>
        <div class="stat-box"><div class="stat-value">${Store.get().highScores.timed120}</div><div class="stat-label">Best (120s)</div></div>
      </div>
      <div class="mode-select-row">
        <button class="btn btn-primary" data-dur="60">Start 60s Round</button>
        <button class="btn btn-primary" data-dur="90">Start 90s Round</button>
        <button class="btn btn-primary" data-dur="120">Start 120s Round</button>
      </div>`;
    document.querySelectorAll("[data-dur]").forEach((btn) => {
      btn.onclick = () => startTimedRound(Number(btn.dataset.dur));
    });
    return;
  }

  if (!TimedState.running) {
    renderTimedResults();
    return;
  }

  const q = TimedState.current;
  const profile = Store.get().profile;
  const answers = resolveAnswers(q, profile);

  app.innerHTML = `
    <div class="timer-display ${TimedState.timeLeft <= 10 ? "urgent" : ""}">⏱ <span id="timedTimerVal">${TimedState.timeLeft}</span>s</div>
    <p style="text-align:center;">Score: <strong>${TimedState.score}</strong> ${TimedState.combo > 1 ? `<span class="combo-badge">🔥 x${TimedState.combo} combo</span>` : ""}</p>
    <div class="question-panel">
      <div class="qnum">${q.section}${q.starred ? " ★" : ""}</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      ${
        TimedState.revealed
          ? `
        <div class="reveal-box">
          ${
            answers.length
              ? `<ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
              : `<p><em>No saved answer — add it in Settings.</em></p>`
          }
        </div>
        <div class="self-grade-row">
          <button class="btn btn-primary" data-correct="true">✅ Knew it</button>
          <button class="btn" style="background:#e2e6ee;" data-correct="false">❌ Missed</button>
        </div>`
          : `<button class="btn btn-secondary" id="timedRevealBtn">Show Answer</button>`
      }
    </div>`;

  const revealBtn = document.getElementById("timedRevealBtn");
  if (revealBtn) revealBtn.onclick = () => { TimedState.revealed = true; renderTimed(); };

  document.querySelectorAll("[data-correct]").forEach((btn) => {
    btn.onclick = () => {
      const isCorrect = btn.dataset.correct === "true";
      if (isCorrect) {
        TimedState.score++;
        TimedState.combo++;
        TimedState.bestCombo = Math.max(TimedState.bestCombo, TimedState.combo);
        const mastery = Store.getMastery(q.id).level;
        Store.setMastery(q.id, Math.min(5, mastery + 1));
      } else {
        TimedState.combo = 0;
      }
      if (TimedState.timeLeft > 0) {
        nextTimedQuestion();
        renderTimed();
      }
    };
  });
}

function renderTimedResults() {
  const app = document.getElementById("app");
  const { state, isNewRecord } = Store.setHighScore(`timed${TimedState.duration}`, TimedState.score);
  Store.touchStreak();
  if (TimedState.score > 0) awardXp(TimedState.score * 8);
  checkAndAwardBadgesQuiet();

  app.innerHTML = `
    <h2 class="screen-title">Time's Up!</h2>
    <div class="card result-screen">
      <p>${TimedState.duration}s Speed Round</p>
      <div class="result-score">${TimedState.score}</div>
      <p>Best combo: 🔥 x${TimedState.bestCombo}</p>
      ${isNewRecord ? `<p class="result-pass"><strong>New high score!</strong></p>` : `<p>Best for ${TimedState.duration}s: ${state.highScores["timed" + TimedState.duration]}</p>`}
      <div class="rate-row">
        <button class="btn btn-primary" id="retryTimedBtn">Play Again</button>
        <button class="btn btn-outline" id="timedHomeBtn">Back to Home</button>
      </div>
    </div>`;

  document.getElementById("retryTimedBtn").onclick = () => {
    TimedState.duration = null;
    renderTimed();
  };
  document.getElementById("timedHomeBtn").onclick = () => {
    TimedState.duration = null;
    navigateTo("home");
  };

  if (isNewRecord && TimedState.score > 0) fireConfetti(app);
  updateHeaderStats();
}
