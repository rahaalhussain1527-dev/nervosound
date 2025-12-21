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

const analysisTextEl = $("analysisText");

const chartCanvas = $("chart");
const chartCtx = chartCanvas.getContext("2d");

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

  audio.pause();
  audio.currentTime = 0;

  // ✅ IMPORTANT FIX: set src on <audio> directly
  audio.src = `${f}.mp3`;
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
  const freqCount = {432:0, 852:0, 963:0};
  const freqImpSum = {432:0, 852:0, 963:0};
  const freqImpN = {432:0, 852:0, 963:0};

  sessions.forEach(s => {
    sumImp += s.improvement;
    freqCount[s.freq] = (freqCount[s.freq] || 0) + 1;
    freqImpSum[s.freq] = (freqImpSum[s.freq] || 0) + s.improvement;
    freqImpN[s.freq] = (freqImpN[s.freq] || 0) + 1;
  });

  const avg = total ? (sumImp / total) : 0;

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

  const freqAvg = {};
  [432,852,963].forEach(f => {
    const n = freqImpN[f] || 0;
    freqAvg[f] = n ? (freqImpSum[f] / n) : 0;
  });

  return { freqAvg, avgOverall: avg, total };
}

// ---------- Chart (Avg improvement) ----------
function drawChart(freqAvg) {
  chartCtx.clearRect(0,0,chartCanvas.width,chartCanvas.height);

  const freqs = [432,852,963];
  const values = freqs.map(f => Number(freqAvg[f] || 0));

  const paddingL = 60;
  const paddingR = 24;
  const paddingT = 20;
  const paddingB = 50;

  const w = chartCanvas.width - paddingL - paddingR;
  const h = chartCanvas.height - paddingT - paddingB;

  chartCtx.strokeStyle = "#93a4b8";
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  chartCtx.moveTo(paddingL, paddingT);
  chartCtx.lineTo(paddingL, paddingT + h);
  chartCtx.lineTo(paddingL + w, paddingT + h);
  chartCtx.stroke();

  const minV = -10, maxV = 10;
  const yFor = (v) => paddingT + h - ((v - minV) / (maxV - minV)) * h;

  chartCtx.font = "12px system-ui";
  chartCtx.fillStyle = "#c9d6e7";
  chartCtx.strokeStyle = "#1f2a37";

  for (let yVal = -10; yVal <= 10; yVal += 5) {
    const y = yFor(yVal);
    chartCtx.beginPath();
    chartCtx.moveTo(paddingL, y);
    chartCtx.lineTo(paddingL + w, y);
    chartCtx.stroke();
    chartCtx.fillText(String(yVal), 18, y + 4);
  }

  chartCtx.strokeStyle = "#3b556d";
  chartCtx.beginPath();
  chartCtx.moveTo(paddingL, yFor(0));
  chartCtx.lineTo(paddingL + w, yFor(0));
  chartCtx.stroke();

  const gap = w / freqs.length;
  const barW = Math.min(140, gap * 0.6);

  freqs.forEach((f, i) => {
    const v = values[i];
    const x = paddingL + i*gap + (gap - barW)/2;

    const yVal = yFor(v);
    const yZero = yFor(0);
    const y = Math.min(yVal, yZero);
    const barH = Math.abs(yZero - yVal);

    chartCtx.fillStyle = "#1d4ed8";
    chartCtx.fillRect(x, y, barW, barH);

    chartCtx.fillStyle = "#e8eef6";
    chartCtx.font = "13px system-ui";
    chartCtx.fillText(v.toFixed(2), x + 6, y - 8);

    chartCtx.font = "14px system-ui";
    chartCtx.fillText(`${f} Hz`, x + 6, paddingT + h + 30);
  });
}

// ---------- Final analysis text ----------
function generateFinalAnalysisText(sessions, scopeLabel) {
  if (!analysisTextEl) return;

  if (!sessions || sessions.length === 0) {
    analysisTextEl.textContent = "No analysis yet. Add sessions to see results.";
    return;
  }

  const total = sessions.length;
  let sumImp = 0;
  let sumDur = 0;

  const freq = {
    432: { n:0, imp:0, dur:0 },
    852: { n:0, imp:0, dur:0 },
    963: { n:0, imp:0, dur:0 },
  };

  sessions.forEach(s => {
    sumImp += s.improvement;
    sumDur += s.duration;
    if (!freq[s.freq]) freq[s.freq] = { n:0, imp:0, dur:0 };
    freq[s.freq].n++;
    freq[s.freq].imp += s.improvement;
    freq[s.freq].dur += s.duration;
  });

  const overallAvgImp = sumImp / total;
  const overallAvgDur = sumDur / total;

  let bestFreq = "—";
  let bestAvg = -Infinity;

  [432,852,963].forEach(f => {
    const n = freq[f].n;
    const avg = n ? (freq[f].imp / n) : null;
    if (avg !== null && avg > bestAvg) {
      bestAvg = avg;
      bestFreq = `${f} Hz`;
    }
  });

  const lines = [];
  lines.push(`Final Analysis – ${scopeLabel}`);
  lines.push(`Best frequency (highest avg improvement): ${bestFreq}`);
  lines.push(`Average improvement overall: ${overallAvgImp.toFixed(2)} (after - before)`);
  lines.push(`Average listening duration overall: ${overallAvgDur.toFixed(0)} seconds`);
  lines.push("");
  lines.push("Per-frequency summary:");

  [432,852,963].forEach(f => {
    const n = freq[f].n;
    const avgImp = n ? (freq[f].imp / n) : 0;
    const avgDur = n ? (freq[f].dur / n) : 0;
    lines.push(`• ${f} Hz: avg improvement = ${avgImp.toFixed(2)} (sessions=${n}, avg duration=${avgDur.toFixed(0)}s)`);
  });

  lines.push("");
  lines.push("Interpretation:");
  lines.push(`Based on the saved sessions, ${bestFreq} produced the strongest average mood improvement for ${scopeLabel}.`);
  lines.push("Note: This is a simple statistical summary (not medical advice).");

  analysisTextEl.textContent = lines.join("\n");
}

function renderTitle() {
  const u = getUserFromQuery();
  analyticsTitle.textContent = u ? `Analytics – ${u}` : "Analytics (All users)";
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

  const freqVal = Number(freqSelect.value);
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
    freq: freqVal,
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

  const sessions = filteredSessions();
  const scope = qUser ? qUser : "All users";
  generateFinalAnalysisText(sessions, scope);
}

// ✅ set default audio (directly on <audio>)
audio.src = "432.mp3";
audio.load();
renderAll();


// ======================================================
//   Frequency-on-Y Visualizer (dominant freq over time)
//   ✅ Y-axis = Hz, X-axis = time (last 10s)
// ======================================================
(() => {
  const audioEl = document.getElementById("audio");
  const canv = document.getElementById("spectrumCanvas");
  if (!audioEl || !canv) return;

  const ctx = canv.getContext("2d");

  function resizeCanvas() {
    const w = canv.clientWidth || canv.width;
    const h = canv.clientHeight || 240;
    canv.width = Math.floor(w * devicePixelRatio);
    canv.height = Math.floor(h * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  let audioCtx = null;
  let analyser = null;
  let source = null;

  const fftSize = 4096;
  const smoothing = 0.80;
  const maxHz = 2000;
  const targetBand = [40, 80];

  const sampleHz = 10;
  const windowSeconds = 10;
  const maxPoints = sampleHz * windowSeconds;
  const history = [];
  let rafId = null;

  function setup() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;

    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function getDominantHz() {
    const bins = analyser.frequencyBinCount;
    const data = new Float32Array(bins);
    analyser.getFloatFrequencyData(data);

    const nyquist = audioCtx.sampleRate / 2;
    const maxBin = Math.min(bins - 1, Math.floor((maxHz / nyquist) * bins));

    let bestI = 0;
    let bestVal = -Infinity;
    for (let i = 0; i <= maxBin; i++) {
      const v = data[i];
      if (v > bestVal) { bestVal = v; bestI = i; }
    }

    const freq = (bestI / bins) * nyquist;
    return freq;
  }

  function drawPlot() {
    if (!analyser) return;

    const hz = getDominantHz();
    history.push(hz);
    if (history.length > maxPoints) history.shift();

    let min = Infinity, max = -Infinity;
    for (const v of history) { if (v < min) min = v; if (v > max) max = v; }
    if (!isFinite(min)) { min = 0; max = 0; }

    const W = canv.clientWidth || 520;
    const H = canv.clientHeight || 240;

    const padL = 70;
    const padR = 18;
    const padT = 28;
    const padB = 34;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    const yForHz = (f) => {
      const ff = clamp(f, 0, maxHz);
      return padT + plotH - (ff / maxHz) * plotH;
    };

    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1;

    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(226,232,240,0.9)";

    for (let yTick = 0; yTick <= maxHz; yTick += 250) {
      const y = yForHz(yTick);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${yTick} Hz`, 10, y + 4);
    }

    ctx.strokeStyle = "rgba(226,232,240,0.7)";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    const y1 = yForHz(targetBand[0]);
    const y2 = yForHz(targetBand[1]);
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    ctx.fillRect(padL, y2, plotW, y1 - y2);

    ctx.fillStyle = "rgba(34,197,94,0.85)";
    ctx.fillText(`Target band: ${targetBand[0]}–${targetBand[1]} Hz`, padL + 10, y2 + 14);

    if (history.length >= 2) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;

      ctx.beginPath();
      history.forEach((v, i) => {
        const x = padL + (i / (maxPoints - 1)) * plotW;
        const y = yForHz(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(226,232,240,0.95)";
    ctx.font = "13px system-ui";
    const last = history[history.length - 1] || 0;
    ctx.fillText(`Dominant: ${last.toFixed(1)} Hz`, padL, 18);
    ctx.fillText(`Range (last 10s): ${min.toFixed(1)}–${max.toFixed(1)} Hz`, padL + 170, 18);

    ctx.fillStyle = "rgba(226,232,240,0.7)";
    ctx.font = "12px system-ui";
    ctx.fillText(`time (last ${windowSeconds}s)`, padL, H - 10);

    rafId = requestAnimationFrame(drawPlot);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  audioEl.addEventListener("play", async () => {
    try {
      setup();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      if (!rafId) drawPlot();
    } catch (e) {
      console.error("Visualizer error:", e);
    }
  });

  audioEl.addEventListener("pause", stop);
  audioEl.addEventListener("ended", stop);

  audioEl.addEventListener("loadedmetadata", () => {
    history.length = 0;
  });
})();
