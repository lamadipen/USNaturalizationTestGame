// Mock Interview Simulator — mirrors the real USCIS civics interview format.
// The player picks their answer from multiple-choice options and the game
// grades it for them against the accepted answer(s) (or the player's own
// profile value, for questions like "who is your governor").

const InterviewState = {
  mode: null, // 'full' | '6520'
  questions: [],
  index: 0,
  results: [], // array of true/false, same length as questions answered so far
  answered: false, // has the current question been graded yet?
  lastCorrect: null,
  lastInput: "",
  optionsSet: null, // { correct, options } built once per question, or null if unbuildable
};

const FULL_COUNT = 20;
const FULL_PASS = 12;
const STARRED_DRAW = 10;
const STARRED_PASS = 6;

function startInterview(mode) {
  InterviewState.mode = mode;
  if (mode === "full") {
    InterviewState.questions = pickRandomN(CIVICS_QUESTIONS, FULL_COUNT);
  } else {
    const starredPool = CIVICS_QUESTIONS.filter((q) => q.starred);
    InterviewState.questions = pickRandomN(starredPool, STARRED_DRAW);
  }
  InterviewState.index = 0;
  InterviewState.results = [];
  InterviewState.answered = false;
  InterviewState.lastCorrect = null;
  InterviewState.lastInput = "";
  InterviewState.optionsSet = null;
  renderInterview();
}

function renderInterview() {
  const app = document.getElementById("app");

  if (!InterviewState.mode) {
    app.innerHTML = `
      <h2 class="screen-title">Mock Interview Simulator</h2>
      <p class="screen-subtitle">Just like the real USCIS interview: the officer asks, you recall the answer out loud, then pick it from the choices — the game grades it for you.</p>
      <div class="mode-grid">
        <div class="mode-card" id="startFull">
          <div class="mode-icon">🇺🇸</div>
          <h3>Full Interview</h3>
          <p>20 random questions from the full 128. Need <strong>12/20</strong> correct to pass — the standard civics test.</p>
        </div>
        <div class="mode-card" id="start6520">
          <div class="mode-icon">⭐</div>
          <h3>65/20 Interview</h3>
          <p>10 random questions from the ★ 20-question set. Need <strong>6/10</strong> correct to pass — for applicants 65+ with 20+ years as a resident.</p>
        </div>
      </div>`;
    document.getElementById("startFull").onclick = () => startInterview("full");
    document.getElementById("start6520").onclick = () => startInterview("6520");
    return;
  }

  const total = InterviewState.questions.length;

  if (InterviewState.index >= total) {
    renderInterviewResults();
    return;
  }

  const q = InterviewState.questions[InterviewState.index];
  const profile = Store.get().profile;
  const answers = resolveAnswers(q, profile);
  const hasAnswer = answers.length > 0;

  // Build (and cache) the option set once per question, the first time it's rendered.
  if (!InterviewState.answered && InterviewState.optionsSet === null) {
    InterviewState.optionsSet = buildAnswerOptions(q, profile);
  }
  const optionsSet = InterviewState.optionsSet;

  const dots = InterviewState.questions
    .map((_, i) => {
      let cls = "progress-dot";
      if (i < InterviewState.results.length) cls += InterviewState.results[i] ? " correct" : " incorrect";
      if (i === InterviewState.index) cls += " current";
      return `<span class="${cls}"></span>`;
    })
    .join("");

  let answerAreaHtml;
  if (!InterviewState.answered) {
    if (optionsSet) {
      answerAreaHtml = `
        <div class="options-grid">
          ${optionsSet.options
            .map((opt, i) => `<button class="btn btn-outline option-btn" data-option-index="${i}">${escapeHtml(opt)}</button>`)
            .join("")}
        </div>`;
    } else {
      answerAreaHtml = hasAnswer
        ? `
        <div class="reveal-box">
          <strong>Accepted answer(s):</strong>
          <ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
        </div>
        <p class="form-note"><em>Not enough contrasting answers to build multiple-choice options here — self-grade based on whether you knew it.</em></p>
        <div class="self-grade-row">
          <button class="btn btn-primary" data-self-correct="true">✅ I got it right</button>
          <button class="btn" style="background:#e2e6ee;" data-self-correct="false">❌ I missed it</button>
        </div>`
        : `
        <p class="form-note"><em>No saved answer for this "answers will vary" question — add it in Settings so the game can grade it. For now, self-grade based on whether you knew it.</em></p>
        <div class="self-grade-row">
          <button class="btn btn-primary" data-self-correct="true">✅ I got it right</button>
          <button class="btn" style="background:#e2e6ee;" data-self-correct="false">❌ I missed it</button>
        </div>`;
    }
  } else {
    const correct = InterviewState.lastCorrect;
    answerAreaHtml = `
      <div class="grade-banner ${correct ? "grade-correct" : "grade-incorrect"}">
        ${correct ? "✅ Correct!" : "❌ Not quite."}
        ${InterviewState.lastInput ? `<span class="typed-answer">You picked: "${escapeHtml(InterviewState.lastInput)}"</span>` : ""}
      </div>
      <div class="reveal-box">
        <strong>Accepted answer(s):</strong>
        ${
          answers.length
            ? `<ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
            : `<p><em>No saved answer — add it in Settings.</em></p>`
        }
      </div>
      <div class="rate-row">
        <button class="btn btn-primary" id="nextQBtn">${InterviewState.index + 1 >= total ? "See Results" : "Next Question"}</button>
      </div>`;
  }

  app.innerHTML = `
    <h2 class="screen-title">${InterviewState.mode === "full" ? "Full Interview" : "65/20 Interview"}</h2>
    <div class="progress-strip">${dots}</div>
    <div class="question-panel">
      <div class="qnum">Question ${InterviewState.index + 1} of ${total} — ${q.section}${q.starred ? " ★" : ""}</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      ${answerAreaHtml}
    </div>`;

  document.querySelectorAll("[data-option-index]").forEach((btn) => {
    btn.onclick = () => {
      const picked = optionsSet.options[Number(btn.dataset.optionIndex)];
      const isCorrect = picked.trim().toLowerCase() === optionsSet.correct.trim().toLowerCase();
      gradeInterviewAnswer(q, isCorrect, picked);
    };
  });

  document.querySelectorAll("[data-self-correct]").forEach((btn) => {
    btn.onclick = () => {
      const isCorrect = btn.dataset.selfCorrect === "true";
      gradeInterviewAnswer(q, isCorrect, "");
    };
  });

  const nextBtn = document.getElementById("nextQBtn");
  if (nextBtn) {
    nextBtn.onclick = () => {
      InterviewState.index++;
      InterviewState.answered = false;
      InterviewState.lastCorrect = null;
      InterviewState.lastInput = "";
      InterviewState.optionsSet = null;
      renderInterview();
    };
  }
}

function gradeInterviewAnswer(q, isCorrect, typedValue) {
  InterviewState.results.push(isCorrect);
  InterviewState.answered = true;
  InterviewState.lastCorrect = isCorrect;
  InterviewState.lastInput = typedValue;
  const mastery = Store.getMastery(q.id).level;
  Store.setMastery(q.id, isCorrect ? Math.min(5, mastery + 1) : Math.max(0, mastery - 1));
  if (isCorrect) awardXp(15);
  renderInterview();
  updateHeaderStats();
}

function renderInterviewResults() {
  const app = document.getElementById("app");
  const total = InterviewState.questions.length;
  const correct = InterviewState.results.filter(Boolean).length;
  const passThreshold = InterviewState.mode === "full" ? FULL_PASS : STARRED_PASS;
  const passed = correct >= passThreshold;

  Store.touchStreak();
  Store.addInterviewResult({
    date: new Date().toISOString(),
    correct,
    total,
    passed,
    mode: InterviewState.mode,
  });
  checkAndAwardBadgesQuiet();

  app.innerHTML = `
    <h2 class="screen-title">Interview Results</h2>
    <div class="card result-screen">
      <p>${InterviewState.mode === "full" ? "Full Interview (need 12/20)" : "65/20 Interview (need 6/10)"}</p>
      <div class="result-score ${passed ? "result-pass" : "result-fail"}">${correct} / ${total}</div>
      <h3 class="${passed ? "result-pass" : "result-fail"}">${passed ? "PASSED ✅" : "Not yet — keep studying"}</h3>
      <div class="rate-row">
        <button class="btn btn-primary" id="retryBtn">Try Another Interview</button>
        <button class="btn btn-outline" id="backHomeBtn">Back to Home</button>
      </div>
    </div>`;

  document.getElementById("retryBtn").onclick = () => {
    InterviewState.mode = null;
    renderInterview();
  };
  document.getElementById("backHomeBtn").onclick = () => {
    InterviewState.mode = null;
    navigateTo("home");
  };

  if (passed) fireConfetti(app);
  updateHeaderStats();
}
