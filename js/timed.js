// Timed Speed Round — beat-the-clock arcade drilling for fast recall.
// The player picks their answer from multiple-choice options; the game
// auto-grades it and briefly flashes correct/incorrect before auto-advancing.

const TimedState = {
  duration: null,
  timeLeft: 0,
  timerId: null,
  queue: [],
  current: null,
  optionsSet: null, // { correct, options } built once per question, or null if unbuildable
  feedback: null, // { correct: bool } while showing the post-answer flash, else null
  score: 0,
  combo: 0,
  bestCombo: 0,
  running: false,
};

const TIMED_FEEDBACK_MS = 900;

function nextTimedQuestion() {
  if (!TimedState.queue.length) {
    TimedState.queue = shuffleArray(CIVICS_QUESTIONS);
  }
  TimedState.current = TimedState.queue.pop();
  TimedState.feedback = null;
  TimedState.optionsSet = null;
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
      <p class="screen-subtitle">Rapid-fire recall against the clock. Pick your answer, the game grades it instantly. Chain correct answers for combo bonuses. Beat your high score!</p>
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
  const hasAnswer = answers.length > 0;

  if (!TimedState.feedback && TimedState.optionsSet === null) {
    TimedState.optionsSet = buildAnswerOptions(q, profile);
  }
  const optionsSet = TimedState.optionsSet;

  let answerAreaHtml;
  if (!TimedState.feedback) {
    if (optionsSet) {
      answerAreaHtml = `
        <div class="options-grid">
          ${optionsSet.options
            .map((opt, i) => `<button class="btn btn-outline option-btn" data-option-index="${i}">${escapeHtml(opt)}</button>`)
            .join("")}
        </div>`;
    } else {
      answerAreaHtml = `
        <p class="form-note"><em>${hasAnswer ? "Not enough contrasting answers to build multiple-choice options here" : "No saved answer — add it in Settings"}. Self-grade for now.</em></p>
        <div class="self-grade-row">
          <button class="btn btn-primary" data-self-correct="true">✅ Knew it</button>
          <button class="btn" style="background:#e2e6ee;" data-self-correct="false">❌ Missed</button>
        </div>`;
    }
  } else {
    answerAreaHtml = `
      <div class="grade-banner ${TimedState.feedback.correct ? "grade-correct" : "grade-incorrect"}">
        ${TimedState.feedback.correct ? "✅ Correct!" : "❌ Missed it"}
      </div>
      <div class="reveal-box">
        ${
          answers.length
            ? `<ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
            : `<p><em>No saved answer — add it in Settings.</em></p>`
        }
      </div>`;
  }

  app.innerHTML = `
    <div class="timer-display ${TimedState.timeLeft <= 10 ? "urgent" : ""}">⏱ <span id="timedTimerVal">${TimedState.timeLeft}</span>s</div>
    <p style="text-align:center;">Score: <strong>${TimedState.score}</strong> ${TimedState.combo > 1 ? `<span class="combo-badge">🔥 x${TimedState.combo} combo</span>` : ""}</p>
    <div class="question-panel">
      <div class="qnum">${q.section}${q.starred ? " ★" : ""}</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      ${answerAreaHtml}
    </div>`;

  document.querySelectorAll("[data-option-index]").forEach((btn) => {
    btn.onclick = () => {
      const picked = optionsSet.options[Number(btn.dataset.optionIndex)];
      const isCorrect = picked.trim().toLowerCase() === optionsSet.correct.trim().toLowerCase();
      gradeTimedAnswer(isCorrect);
    };
  });

  document.querySelectorAll("[data-self-correct]").forEach((btn) => {
    btn.onclick = () => {
      const isCorrect = btn.dataset.selfCorrect === "true";
      gradeTimedAnswer(isCorrect);
    };
  });
}

function gradeTimedAnswer(isCorrect) {
  const q = TimedState.current;
  if (isCorrect) {
    TimedState.score++;
    TimedState.combo++;
    TimedState.bestCombo = Math.max(TimedState.bestCombo, TimedState.combo);
    const mastery = Store.getMastery(q.id).level;
    Store.setMastery(q.id, Math.min(5, mastery + 1));
  } else {
    TimedState.combo = 0;
  }
  TimedState.feedback = { correct: isCorrect };
  renderTimed();

  if (TimedState.timeLeft > 0) {
    setTimeout(() => {
      if (!TimedState.running) return; // round ended while feedback was showing
      nextTimedQuestion();
      renderTimed();
    }, TIMED_FEEDBACK_MS);
  }
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
