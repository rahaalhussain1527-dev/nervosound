// ---------- Storage ----------
const LS_USERS = "ns_users";
const LS_SESSIONS = "ns_sessions";
const $ = (id) => document.getElementById(id);

function loadUsers() {
  return JSON.parse(localStorage.getItem(LS_USERS) || "[]");
}
function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function loadSessions() {
  return JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]");
}
function saveSessions(sessions) {
  localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));
}

// ---------- Utils ----------
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function nowISO() { return new Date().toISOString(); }
function fmtDate(iso) { return new Date(iso).toLocaleString(); }

function getUserFromQuery() {
  const p = new URLSearchParams(location.search);
  const u = p.get("user");
  return u ? u.trim() : null;
}

// ---------- State ----------
let timer = null;
let liveSeconds = 0;

// ---------- Elements ----------
const userSelect = $("userSelect");
const newUserName = $("newUserName");
const addUserBtn = $("addUserBtn");
const openProfileBtn = $("openProfileBtn");

const freqSelect = $("freqSelect");
const audio = $("audio");
const audioSrc = $("audioSrc");
const liveSecondsEl = $("liveSeconds");

const moodBefore = $("moodBefore");
const moodAfter = $("moodAfter");
const saveSessionBtn = $("saveSessionBtn");
const resetTimerBtn = $("resetTimerBtn");

const statTotal = $("statTotal");
const statAvg = $("statAvg");
const statMost = $("statMost");
const analyticsTitle = $("analyticsTitle");

const sessionsTableBody = $("sessionsTable").querySelector("tbody");
const clearAllBtn = $("clearAllBtn");

const canvas = $("chart");
const ctx = canvas.getContext("2d");

// عنصر التحليل النهائي (لازم يكون موجود بالـ HTML)
const analysisTextEl = $("analysisText");

// ---------- Init users ----------
function renderUsers() {
  const users = loadUsers();
  userSelect.innerHTML = "";
  for (const u of users) {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    userSelect.appendChild(opt);
  }
}

function ensureUserExists(name) {
  if (!name) return;
  let users = loadUsers();
  if (!users.includes(name)) {
    users.push(name);
    users.sort((a,b)=>a.localeCompare(b));
    saveUsers(users);
  }
  renderUsers();
  userSelect.value = name;
}

// ---------- Audio + timer ----------
function resetLiveTimer() {
  liveSeconds = 0;
  liveSecondsEl.textContent = "0";
  if (timer) clearInterval(timer);
  timer = null;
}

audio.addEventListener("play", () => {
  if (timer) return;
  timer = setInterval(() => {
    liveSeconds++;
    liveSecondsEl.textContent = String(liveSeconds);
  }, 1000);
});
audio.addEventListener("pause", () => {
  if (timer) clearInterval(timer);
  timer = null;
});
audio.addEventListener("ended", () => {
  if (timer) clearInterval(timer);
  timer = null;
});

freqSelect.addEventListener("change", () => {
  const f = freqSelect.value;
  audioSrc.src = `${f}.mp3`;
  audio.load();
  resetLiveTimer();
});

// ---------- Sessions / Analytics ----------
function currentUser() {
  const qUser = getUserFromQuery();
  if (qUser) return qUser;
  return userSelect.value || null;
}

function filteredSessions() {
  const sessions = loadSessions();
  const u = getUserFromQuery();
  if (!u) return sessions;
  return sessions.filter(s => s.user === u);
}

function renderTable() {
  const sessions = filteredSessions();
  sessionsTableBody.innerHTML = "";

  sessions.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(s.date)}</td>
      <td>${s.user}</td>
      <td>${s.freq} Hz</td>
      <td>${s.duration}</td>
      <td>${s.before}</td>
      <td>${s.after}</td>
      <td>${s.improvement}</td>
      <td><button data-del="${s.id}">Delete</button></td>
    `;
    sessionsTableBody.appendChild(tr);
  });

  sessionsTableBody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      let all = loadSessions();
      all = all.filter(s => s.id !== id);
      saveSessions(all);
      renderAll();
    });
  });
}

function computeStats() {
  const sessions = filteredSessions();
  const total = sessions.length;

  let sumImp = 0;
  let freqCount = {432:0, 852:0, 963:0};
  let freqImpSum = {432:0, 852:0, 963:0};
  let freqImpN = {432:0, 852:0, 963:0};

  sessions.forEach(s => {
    sumImp += s.improvement;
    freqCount[s.freq] = (freqCount[s.freq] || 0) + 1;
    freqImpSum[s.freq] = (freqImpSum[s.freq] || 0) + s.improvement;
    freqImpN[s.freq] = (freqImpN[s.freq] || 0) + 1;
  });

  const avg = total ? (sumImp / total) : 0;

  // Most used
  let most = "—";
  let bestCount = 0;
  for (const f of Object.keys(freqCount)) {
    if (freqCount[f] > bestCount) {
      bestCount = freqCount[f];
      most = bestCount ? `${f} Hz` : "—";
    }
  }

  statTotal.textContent = String(total);
  statAvg.textContent = avg.toFixed(2);
  statMost.textContent = most;

  // avg improvement per freq (for chart)
  const freqAvg = {};
  [432,852,963].forEach(f => {
    const n = freqImpN[f] || 0;
    freqAvg[f] = n ? (freqImpSum[f] / n) : 0;
  });

  return { freqAvg, avg };
}

function setupCanvasSize() {
  // يساعد إن الرسم يطلع “عمودي واضح”
  // إذا عندك CSS مضبوط، ما رح يضر
  canvas.width = canvas.clientWidth ? canvas.clientWidth : 900;
  canvas.height = 260;
}

function drawChart(freqAvg) {
  setupCanvasSize();

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const freqs = [432,852,963];
  const values = freqs.map(f => freqAvg[f] || 0);

  const padding = 40;
  const w = canvas.width - padding*2;
  const h = canvas.height - padding*2;

  // axis
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#93a4b8";
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + h);
  ctx.lineTo(padding + w, padding + h);
  ctx.stroke();

  // scale: improvement range -10..+10
  const minV = -10, maxV = 10;
  const zeroY = padding + h - ((0 - minV) / (maxV - minV)) * h;

  // zero line
  ctx.strokeStyle = "#3b556d";
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(padding + w, zeroY);
  ctx.stroke();

  const barW = w / freqs.length * 0.55;
  const gap = w / freqs.length;

  freqs.forEach((f, i) => {
    const v = values[i];
    const x = padding + i*gap + (gap - barW)/2;

    const yVal = padding + h - ((v - minV) / (maxV - minV)) * h;
    const y = Math.min(yVal, zeroY);
    const barH = Math.abs(zeroY - yVal);

    // bar
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(x, y, barW, barH);

    // labels
    ctx.fillStyle = "#e8eef6";
    ctx.font = "14px system-ui";
    ctx.fillText(`${f} Hz`, x, padding + h + 24);
    ctx.font = "13px system-ui";
    ctx.fillText(v.toFixed(2), x, y - 8);
  });

  ctx.globalAlpha = 1;
}

function renderTitle() {
  const u = getUserFromQuery();
  analyticsTitle.textContent = u ? `Analytics – ${u}` : "Analytics (All users)";
}

// ---------- FINAL ANALYSIS (النص النهائي) ----------
function generateFinalAnalysis(sessions, userNameOrAll) {
  if (!analysisTextEl) return; // إذا ما في عنصر بالـ HTML ما منعمل شي

  if (!sessions || sessions.length === 0) {
    analysisTextEl.textContent = "No sessions yet. Save at least one session to see the final analysis.";
    return;
  }

  const freqStats = {};
  sessions.forEach(s => {
    if (!freqStats[s.freq]) freqStats[s.freq] = { totalImp: 0, n: 0, totalDur: 0 };
    freqStats[s.freq].totalImp += s.improvement;
    freqStats[s.freq].totalDur += s.duration;
    freqStats[s.freq].n += 1;
  });

  // أفضل تردد حسب متوسط التحسن
  let bestFreq = null;
  let bestAvg = -Infinity;

  Object.keys(freqStats).forEach(freq => {
    const avg = freqStats[freq].totalImp / freqStats[freq].n;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestFreq = freq;
    }
  });

  const overallAvg = sessions.reduce((a, s) => a + s.improvement, 0) / sessions.length;

  // تفاصيل سريعة لكل تردد
  const lines = Object.keys(freqStats)
    .sort((a,b)=>Number(a)-Number(b))
    .map(freq => {
      const st = freqStats[freq];
      const avgImp = (st.totalImp / st.n).toFixed(2);
      const avgDur = (st.totalDur / st.n).toFixed(0);
      return `• ${freq} Hz: avg improvement = ${avgImp} (sessions=${st.n}, avg duration=${avgDur}s)`;
    });

  const who = userNameOrAll || "All users";

  analysisTextEl.textContent =
`Final Analysis – ${who}
Best frequency (highest avg improvement): ${bestFreq} Hz
Average improvement overall: ${overallAvg.toFixed(2)} (scale 0–10 before/after, improvement = after - before)

Per-frequency summary:
${lines.join("\n")}`;
}

// ---------- Actions ----------
addUserBtn.addEventListener("click", () => {
  const name = newUserName.value.trim();
  if (!name) return;
  ensureUserExists(name);
  newUserName.value = "";
  renderAll();
});

openProfileBtn.addEventListener("click", () => {
  const name = userSelect.value;
  if (!name) return;
  location.href = `${location.pathname}?user=${encodeURIComponent(name)}`;
});

saveSessionBtn.addEventListener("click", () => {
  const user = currentUser();
  if (!user) {
    alert("Please add/select a user first.");
    return;
  }

  const freq = Number(freqSelect.value);
  const before = clamp(Number(moodBefore.value), 0, 10);
  const after = clamp(Number(moodAfter.value), 0, 10);

  const duration = liveSeconds;
  if (duration <= 0) {
    alert("Play the audio first so duration > 0.");
    return;
  }

  const improvement = clamp(after - before, -10, 10);

  const all = loadSessions();
  all.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    date: nowISO(),
    user,
    freq,
    duration,
    before,
    after,
    improvement
  });
  saveSessions(all);

  resetLiveTimer();
  renderAll();
});

resetTimerBtn.addEventListener("click", () => resetLiveTimer());

clearAllBtn.addEventListener("click", () => {
  if (!confirm("This will delete ALL saved users and sessions. Continue?")) return;
  localStorage.removeItem(LS_USERS);
  localStorage.removeItem(LS_SESSIONS);
  location.href = location.pathname;
});

// ---------- Boot ----------
function renderAll() {
  renderTitle();
  renderUsers();

  const qUser = getUserFromQuery();
  if (qUser) ensureUserExists(qUser);

  renderTable();
  const { freqAvg } = computeStats();
  drawChart(freqAvg);

  // ⭐ هون السطر المهم: التحليل النهائي
  const sessions = filteredSessions();
  const who = getUserFromQuery() ? getUserFromQuery() : "All users";
  generateFinalAnalysis(sessions, who);
}

// default audio
audioSrc.src = "432.mp3";
audio.load();

renderAll();
