// Router + Home / Settings / Stats screens + header stats.

let currentView = "home";

function navigateTo(view) {
  if (currentView === "timed" && TimedState.running) {
    clearInterval(TimedState.timerId);
    TimedState.running = false;
    TimedState.duration = null;
  }
  currentView = view;
  document.querySelectorAll("#mainNav button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  if (view === "home") renderHome();
  else if (view === "flashcards") {
    if (!FlashcardsState.deck.length) startFlashcardSession(FlashcardsState.filter);
    else renderFlashcards();
  } else if (view === "interview") renderInterview();
  else if (view === "timed") renderTimed();
  else if (view === "stats") renderStats();
  else if (view === "settings") renderSettings();

  updateHeaderStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHeaderStats() {
  const s = Store.get();
  const lvl = levelForXp(s.xp);
  const el = document.getElementById("headerStats");
  el.innerHTML = `
    <span class="level-pill">${lvl.name}</span>
    <span>${s.xp} XP</span>
    <span class="streak-pill">🔥 ${s.streak.count}-day streak</span>
  `;
}

function masteredCount(state) {
  return Object.values(state.mastery).filter((m) => m.level >= 4).length;
}

function renderHome() {
  const app = document.getElementById("app");
  const s = Store.get();
  const mastered = masteredCount(s);
  const pct = Math.round((mastered / 128) * 100);
  const lvl = levelForXp(s.xp);

  const needsSetup = !s.profile.state;

  app.innerHTML = `
    <h2 class="screen-title">Welcome back${s.profile.onboarded ? "" : ""}!</h2>
    <p class="screen-subtitle">Learn the 128 official USCIS civics questions by playing. Pick a mode below.</p>
    ${
      needsSetup
        ? `<div class="card" style="border-left:5px solid var(--gold); margin-bottom:20px;">
             <strong>One-time setup:</strong> A few questions ask about <em>your own</em> senators, representative, governor, and current officials.
             <button class="btn btn-outline" id="goSetupBtn" style="margin-left:10px;">Set Up Profile</button>
           </div>`
        : ""
    }
    <div class="mode-grid">
      <div class="mode-card" data-nav="flashcards">
        <div class="mode-icon">🗂️</div>
        <h3>Flashcards</h3>
        <p>Flip, recall, self-rate. Weak cards come back sooner so you actually memorize them.</p>
      </div>
      <div class="mode-card" data-nav="interview">
        <div class="mode-icon">🎤</div>
        <h3>Mock Interview</h3>
        <p>The real format: 20 questions, need 12 right — or the 65/20 version, 10 questions need 6 right.</p>
      </div>
      <div class="mode-card" data-nav="timed">
        <div class="mode-icon">⚡</div>
        <h3>Speed Round</h3>
        <p>Beat the clock, chain combos, and set a new high score.</p>
      </div>
    </div>
    <div class="home-progress card">
      <div class="label-row" style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong>Overall Mastery</strong><span>${mastered} / 128 (${pct}%)</span>
      </div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <p style="margin-top:14px; color:var(--muted); font-size:0.9rem;">Level: <strong>${lvl.name}</strong>${lvl.next ? ` — ${lvl.xpForNext - lvl.xpIntoLevel} XP to ${lvl.next}` : " — max level!"}</p>
    </div>`;

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.onclick = () => navigateTo(el.dataset.nav);
  });
  const setupBtn = document.getElementById("goSetupBtn");
  if (setupBtn) setupBtn.onclick = () => navigateTo("settings");
}

function renderSettings() {
  const app = document.getElementById("app");
  const s = Store.get();
  const p = s.profile;

  const stateOptions = US_STATES.map(
    (st) => `<option value="${st.name}" ${p.state === st.name ? "selected" : ""}>${st.name}</option>`
  ).join("");

  app.innerHTML = `
    <h2 class="screen-title">Your Profile</h2>
    <p class="screen-subtitle">Eight of the 128 questions ask about <em>your own</em> officials, or officials that change over time.
      Fill these in yourself so the game can quiz you accurately — the app never guesses or hardcodes current officeholders.</p>
    <div class="card">
      <form id="settingsForm">
        <div class="form-grid">
          <div class="form-field">
            <label for="stateSelect">Your State / Territory</label>
            <select id="stateSelect">
              <option value="">— Select —</option>
              ${stateOptions}
            </select>
          </div>
          <div class="form-field">
            <label>State Capital (auto-filled)</label>
            <input type="text" id="capitalDisplay" disabled />
          </div>
          <div class="form-field">
            <label for="senatorInput">One of your U.S. senators</label>
            <input type="text" id="senatorInput" value="${escapeHtml(p.senator)}" placeholder="e.g. Jane Smith" />
          </div>
          <div class="form-field">
            <label for="repInput">Your U.S. representative</label>
            <input type="text" id="repInput" value="${escapeHtml(p.representative)}" placeholder="e.g. John Doe" />
          </div>
          <div class="form-field">
            <label for="govInput">Your governor</label>
            <input type="text" id="govInput" value="${escapeHtml(p.governor)}" />
          </div>
          <div class="form-field">
            <label for="presInput">Current President</label>
            <input type="text" id="presInput" value="${escapeHtml(p.president)}" />
          </div>
          <div class="form-field">
            <label for="vpInput">Current Vice President</label>
            <input type="text" id="vpInput" value="${escapeHtml(p.vp)}" />
          </div>
          <div class="form-field">
            <label for="speakerInput">Speaker of the House</label>
            <input type="text" id="speakerInput" value="${escapeHtml(p.speaker)}" />
          </div>
          <div class="form-field">
            <label for="cjInput">Chief Justice</label>
            <input type="text" id="cjInput" value="${escapeHtml(p.chiefJustice)}" />
          </div>
        </div>
        <p class="form-note">Verify current officials at uscis.gov/citizenship/testupdates before your real interview.</p>
        <div class="rate-row" style="justify-content:flex-start;">
          <button type="submit" class="btn btn-primary">Save Profile</button>
        </div>
      </form>
    </div>

    <div class="card" style="margin-top:20px; border-top:5px solid var(--red);">
      <h3 style="margin-top:0;">Reset Progress</h3>
      <p style="color:var(--muted);">Clears all mastery levels, XP, badges, streak, and high scores on this device. This cannot be undone.</p>
      <button class="btn" style="background:#e2e6ee;" id="resetBtn">Reset All Progress</button>
    </div>`;

  const capInput = document.getElementById("capitalDisplay");
  const setCapital = (stateName) => {
    const st = US_STATES.find((x) => x.name === stateName);
    capInput.value = st ? st.capital || st.note || "" : "";
  };
  setCapital(p.state);
  document.getElementById("stateSelect").onchange = (e) => setCapital(e.target.value);

  document.getElementById("settingsForm").onsubmit = (e) => {
    e.preventDefault();
    const stateName = document.getElementById("stateSelect").value;
    Store.updateProfile({
      state: stateName || null,
      senator: document.getElementById("senatorInput").value.trim(),
      representative: document.getElementById("repInput").value.trim(),
      governor: document.getElementById("govInput").value.trim(),
      president: document.getElementById("presInput").value.trim(),
      vp: document.getElementById("vpInput").value.trim(),
      speaker: document.getElementById("speakerInput").value.trim(),
      chiefJustice: document.getElementById("cjInput").value.trim(),
      onboarded: true,
    });
    showToast("✅", "Profile saved.");
    navigateTo("home");
  };

  document.getElementById("resetBtn").onclick = () => {
    if (confirm("Reset all progress on this device? This cannot be undone.")) {
      Store.reset();
      navigateTo("home");
    }
  };
}

function renderStats() {
  const app = document.getElementById("app");
  const s = Store.get();
  const mastered = masteredCount(s);
  const lvl = levelForXp(s.xp);

  const sectionRows = SECTIONS.map((section) => {
    const qs = CIVICS_QUESTIONS.filter((q) => q.section === section);
    const done = qs.filter((q) => (s.mastery[q.id] ? s.mastery[q.id].level : 0) >= 4).length;
    const pct = Math.round((done / qs.length) * 100);
    return `
      <div class="section-mastery-row">
        <div class="label-row"><span>${section}</span><span>${done}/${qs.length}</span></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");

  const weak = CIVICS_QUESTIONS.map((q) => ({ q, level: s.mastery[q.id] ? s.mastery[q.id].level : 0 }))
    .filter((x) => x.level < 3)
    .sort((a, b) => a.level - b.level)
    .slice(0, 8);

  const badgeGrid = Object.entries(BADGES)
    .map(([id, b]) => {
      const earned = s.badges.includes(id);
      return `
      <div class="badge-item ${earned ? "earned" : ""}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      </div>`;
    })
    .join("");

  app.innerHTML = `
    <h2 class="screen-title">Your Stats</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${lvl.name}</div><div class="stat-label">Level</div></div>
      <div class="stat-box"><div class="stat-value">${s.xp}</div><div class="stat-label">Total XP</div></div>
      <div class="stat-box"><div class="stat-value">${mastered}/128</div><div class="stat-label">Mastered</div></div>
      <div class="stat-box"><div class="stat-value">🔥 ${s.streak.count}</div><div class="stat-label">Day Streak</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3 style="margin-top:0;">Mastery by Section</h3>
      ${sectionRows}
    </div>

    ${
      weak.length
        ? `<div class="card" style="margin-bottom:20px;">
             <h3 style="margin-top:0;">Needs Practice</h3>
             <ul class="weak-list">
               ${weak.map((x) => `<li>${escapeHtml(x.q.question)}</li>`).join("")}
             </ul>
           </div>`
        : ""
    }

    <div class="card">
      <h3 style="margin-top:0;">Badges</h3>
      <div class="badge-grid">${badgeGrid}</div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#mainNav button").forEach((btn) => {
    btn.onclick = () => navigateTo(btn.dataset.view);
  });
  const s = Store.get();
  navigateTo(s.profile.onboarded ? "home" : "settings");
});
