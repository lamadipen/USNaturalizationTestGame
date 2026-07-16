// Mock Interview Simulator — mirrors the real USCIS civics interview format.

const InterviewState = {
  mode: null, // 'full' | '6520'
  questions: [],
  index: 0,
  results: [], // array of true/false, same length as questions answered so far
  revealed: false,
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
  InterviewState.revealed = false;
  renderInterview();
}

function renderInterview() {
  const app = document.getElementById("app");

  if (!InterviewState.mode) {
    app.innerHTML = `
      <h2 class="screen-title">Mock Interview Simulator</h2>
      <p class="screen-subtitle">Just like the real USCIS interview: the officer asks, you answer out loud, then reveal to self-grade.</p>
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

  const dots = InterviewState.questions
    .map((_, i) => {
      let cls = "progress-dot";
      if (i < InterviewState.results.length) cls += InterviewState.results[i] ? " correct" : " incorrect";
      if (i === InterviewState.index) cls += " current";
      return `<span class="${cls}"></span>`;
    })
    .join("");

  app.innerHTML = `
    <h2 class="screen-title">${InterviewState.mode === "full" ? "Full Interview" : "65/20 Interview"}</h2>
    <div class="progress-strip">${dots}</div>
    <div class="question-panel">
      <div class="qnum">Question ${InterviewState.index + 1} of ${total} — ${q.section}${q.starred ? " ★" : ""}</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      ${
        InterviewState.revealed
          ? `
        <div class="reveal-box">
          <strong>Accepted answer(s):</strong>
          ${
            answers.length
              ? `<ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
              : `<p><em>No saved answer for this "answers will vary" question — add it in Settings. For now, self-grade based on whether you knew it.</em></p>`
          }
        </div>
        <div class="self-grade-row">
          <button class="btn btn-primary" data-correct="true">✅ I got it right</button>
          <button class="btn" style="background:#e2e6ee;" data-correct="false">❌ I missed it</button>
        </div>
      `
          : `<button class="btn btn-secondary" id="revealBtn">Reveal Answer</button>`
      }
    </div>`;

  const revealBtn = document.getElementById("revealBtn");
  if (revealBtn) revealBtn.onclick = () => { InterviewState.revealed = true; renderInterview(); };

  document.querySelectorAll("[data-correct]").forEach((btn) => {
    btn.onclick = () => {
      const isCorrect = btn.dataset.correct === "true";
      InterviewState.results.push(isCorrect);
      const mastery = Store.getMastery(q.id).level;
      Store.setMastery(q.id, isCorrect ? Math.min(5, mastery + 1) : Math.max(0, mastery - 1));
      if (isCorrect) awardXp(15);
      InterviewState.index++;
      InterviewState.revealed = false;
      renderInterview();
      updateHeaderStats();
    };
  });
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
