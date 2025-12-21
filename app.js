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

const analysisTextEl = $("analysisText");

const canvas = $("chart");
const ctx = canvas.getContext("2d");

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

  return { freqAvg, avgOverall: avg, total };
}

// ---------- Better vertical chart ----------
function drawChart(freqAvg) {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const freqs = [432,852,963];
  const values = freqs.map(f => Number(freqAvg[f] || 0));

  const paddingL = 60;
  const paddingR = 24;
  const paddingT = 20;
  const paddingB = 50;

  const w = canvas.width - paddingL - paddingR;
  const h = canvas.height - paddingT - paddingB;

  // axis
  ctx.strokeStyle = "#93a4b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingL, paddingT);
  ctx.lineTo(paddingL, paddingT + h);
  ctx.lineTo(paddingL + w, paddingT + h);
  ctx.stroke();

  const minV = -10, maxV = 10;
  const yFor = (v) => paddingT + h - ((v - minV) / (maxV - minV)) * h;

  // grid + y labels (every 5)
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#c9d6e7";
  ctx.strokeStyle = "#1f2a37";

  for (let yVal = -10; yVal <= 10; yVal += 5) {
    const y = yFor(yVal);
    ctx.beginPath();
    ctx.moveTo(paddingL, y);
    ctx.lineTo(paddingL + w, y);
    ctx.stroke();
    ctx.fillText(String(yVal), 18, y + 4);
  }

  // zero line darker
  ctx.strokeStyle = "#3b556d";
  ctx.beginPath();
  ctx.moveTo(paddingL, yFor(0));
  ctx.lineTo(paddingL + w, yFor(0));
  ctx.stroke();

  const gap = w / freqs.length;
  const barW = Math.min(140, gap * 0.6);

  freqs.forEach((f, i) => {
    const v = values[i];
    const x = paddingL + i*gap + (gap - barW)/2;

    const yVal = yFor(v);
    const yZero = yFor(0);
    const y = Math.min(yVal, yZero);
    const barH = Math.abs(yZero - yVal);

    // bar
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(x, y, barW, barH);

    // value label
    ctx.fillStyle = "#e8eef6";
    ctx.font = "13px system-ui";
    ctx.fillText(v.toFixed(2), x + 6, y - 8);

    // x label
    ctx.font = "14px system-ui";
    ctx.fillText(`${f} Hz`, x + 6, paddingT + h + 30);
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

  // best frequency by avg improvement
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
  lines.push(`Average improvement overall: ${overallAvgImp.toFixed(2)} (scale 0–10 before/after, improvement = after - before)`);
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

// set default audio
audioSrc.src = "432.mp3";
audio.load();

renderAll();


// =====================================================
// ===== Spectrum (Y-axis = Hz) — CLEAR + NO OVERLAP =====
// =====================================================
(() => {
  const audioEl = document.getElementById("audio");
  const canvasEl = document.getElementById("spectrumCanvas");
  if (!audioEl || !canvasEl) return;

  const g = canvasEl.getContext("2d");

  let audioCtx, analyser, source, dataArray, rafId;

  // rolling (last 10s) dominant freq series
  const historySeconds = 10;
  const fps = 20; // smooth enough
  const maxPoints = historySeconds * fps;
  const domHistory = [];

  // target band
  const targetLo = 40;
  const targetHi = 80;

  // display range for Y-axis
  const maxHz = 2000;

  function setupAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();

    analyser.fftSize = 4096;               // higher resolution
    analyser.smoothingTimeConstant = 0.85;

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function hzFromBin(binIndex) {
    const sr = (audioCtx ? audioCtx.sampleRate : 48000);
    const binCount = analyser.frequencyBinCount; // N/2
    return (binIndex * sr) / (binCount * 2);
  }

  function getDominantHz() {
    analyser.getByteFrequencyData(dataArray);

    // only up to maxHz for analysis
    let bestI = 0;
    let bestV = -1;

    const binCount = dataArray.length;
    // compute last bin for maxHz
    let maxBin = Math.floor((maxHz / (audioCtx.sampleRate / (analyser.fftSize))) );
    maxBin = Math.max(1, Math.min(binCount - 1, maxBin));

    for (let i = 1; i <= maxBin; i++) {
      const v = dataArray[i];
      if (v > bestV) {
        bestV = v;
        bestI = i;
      }
    }
    return hzFromBin(bestI);
  }

  function getRangeHz() {
    // range of bins that are "active" (last frame)
    // threshold based on max energy
    let maxVal = 0;
    for (let i = 0; i < dataArray.length; i++) maxVal = Math.max(maxVal, dataArray[i]);
    const thr = Math.max(18, maxVal * 0.22);

    let minI = -1, maxI = -1;

    // limit to maxHz
    let maxBin = Math.floor((maxHz / (audioCtx.sampleRate / (analyser.fftSize))) );
    maxBin = Math.max(1, Math.min(dataArray.length - 1, maxBin));

    for (let i = 1; i <= maxBin; i++) {
      if (dataArray[i] >= thr) {
        if (minI === -1) minI = i;
        maxI = i;
      }
    }

    if (minI === -1) return { lo: 0, hi: 0 };
    return { lo: hzFromBin(minI), hi: hzFromBin(maxI) };
  }

  function fitCanvasToCSS() {
    // make it crisp on HiDPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    const w = Math.max(520, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height || 220));

    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame() {
    if (!analyser) return;

    // keep canvas sized nicely
    fitCanvasToCSS();

    const W = canvasEl.getBoundingClientRect().width;
    const H = canvasEl.getBoundingClientRect().height;

    // paddings (IMPORTANT for no overlap)
    const leftPad = 82;
    const rightPad = 18;
    const topPad = 26;
    const botPad = 40;

    const plotW = W - leftPad - rightPad;
    const plotH = H - topPad - botPad;

    const yForHz = (hz) => topPad + plotH - (hz / maxHz) * plotH;

    // read spectrum data
    analyser.getByteFrequencyData(dataArray);

    const dominantHz = getDominantHz();
    domHistory.push(dominantHz);
    while (domHistory.length > maxPoints) domHistory.shift();

    const range = getRangeHz();

    // background
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#0f172a";
    g.fillRect(0, 0, W, H);

    // grid + axis
    g.strokeStyle = "rgba(148,163,184,0.25)";
    g.lineWidth = 1;

    // horizontal grid + y labels (NO OVERLAP)
    const ticks = [0, 40, 80, 200, 500, 1000, 1500, 2000];

    g.font = "14px system-ui";
    g.fillStyle = "#e5e7eb";
    g.textBaseline = "middle";

    let lastY = -9999;
    const minGap = 18;

    for (const hz of ticks) {
      const y = yForHz(hz);

      // grid line
      g.beginPath();
      g.moveTo(leftPad, y);
      g.lineTo(leftPad + plotW, y);
      g.stroke();

      // label (skip if too close)
      if (Math.abs(y - lastY) >= minGap) {
        g.fillText(`${hz} Hz`, 10, y);
        lastY = y;
      }
    }

    // y-axis line
    g.strokeStyle = "rgba(148,163,184,0.55)";
    g.beginPath();
    g.moveTo(leftPad, topPad);
    g.lineTo(leftPad, topPad + plotH);
    g.stroke();

    // target band highlight (40–80 Hz)
    const yHi = yForHz(targetHi);
    const yLo = yForHz(targetLo);
    g.fillStyle = "rgba(59,130,246,0.10)";
    g.fillRect(leftPad, yHi, plotW, yLo - yHi);

    // label target band (put it TOP-RIGHT to avoid clutter)
    g.font = "13px system-ui";
    g.fillStyle = "rgba(226,232,240,0.85)";
    g.textBaseline = "top";
    g.fillText(`Target band: ${targetLo}–${targetHi} Hz`, leftPad + plotW - 220, topPad + 4);

    // line plot of dominant frequency (last 10s)
    g.strokeStyle = "rgba(59,130,246,0.95)";
    g.lineWidth = 2;
    g.beginPath();

    for (let i = 0; i < domHistory.length; i++) {
      const x = leftPad + (i / (maxPoints - 1)) * plotW;
      const y = yForHz(domHistory[i]);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    // info header (top)
    g.font = "14px system-ui";
    g.fillStyle = "#e2e8f0";
    g.textBaseline = "alphabetic";

    const domTxt = `Dominant: ${dominantHz.toFixed(1)} Hz`;
    const rangeTxt = `Range (last 10s): ${range.lo.toFixed(1)}–${range.hi.toFixed(1)} Hz`;
    g.fillText(domTxt, leftPad, 18);
    g.fillText(rangeTxt, leftPad + 210, 18);

    // x-axis label (bottom-right)
    g.font = "12px system-ui";
    g.fillStyle = "rgba(226,232,240,0.70)";
    g.textBaseline = "alphabetic";
    g.fillText(`time (last ${historySeconds}s)`, leftPad, topPad + plotH + 28);

    rafId = requestAnimationFrame(drawFrame);
  }

  audioEl.addEventListener("play", async () => {
    setupAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    if (!rafId) drawFrame();
  });

  audioEl.addEventListener("pause", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  audioEl.addEventListener("ended", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  window.addEventListener("resize", () => {
    // re-fit on resize
    fitCanvasToCSS();
  });
})();
