// ================= FIREBASE =================
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

// ================= HELPERS =================
const $ = (id) => document.getElementById(id);
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function nowISO() { return new Date().toISOString(); }
function fmtDate(iso) { return new Date(iso).toLocaleString("en-US"); }

// ================= ELEMENTS =================
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

// ================= TRACK METADATA =================
const TRACKS = {
  432: {
    name: "Relaxation",
    dominant: 432,
    range: [420, 560],
    note: "This track is generally calm and supports relaxation."
  },
  852: {
    name: "Healing",
    dominant: 785,
    range: [293, 890],
    note: "This track focuses on mid-range frequencies and emotional balance."
  },
  963: {
    name: "Spiritual Awareness",
    dominant: 890,
    range: [750, 960],
    note: "This track emphasizes higher harmonics and mental focus."
  }
};

function trackName(freq) {
  return TRACKS[freq]?.name || freq;
}

// ================= STATE =================
let timer = null;
let liveSeconds = 0;

// ================= FIRESTORE =================
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data().name);
}

async function saveUser(name) {
  await addDoc(collection(db, "users"), { name });
}

async function loadSessions(user = null) {
  let q = collection(db, "sessions");
  if (user) q = query(q, where("user", "==", user));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveSession(session) {
  await addDoc(collection(db, "sessions"), session);
}

async function deleteSession(id) {
  await deleteDoc(doc(db, "sessions", id));
}

// ================= USERS =================
async function renderUsers() {
  const users = await loadUsers();
  userSelect.innerHTML = "";
  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    userSelect.appendChild(opt);
  });
}

addUserBtn.addEventListener("click", async () => {
  const name = newUserName.value.trim();
  if (!name) return;
  await saveUser(name);
  newUserName.value = "";
  await renderAll();
});

openProfileBtn.addEventListener("click", () => {
  const u = userSelect.value;
  if (!u) return;
  location.href = `${location.pathname}?user=${encodeURIComponent(u)}`;
});

function currentUser() {
  const p = new URLSearchParams(location.search);
  return p.get("user") || userSelect.value || null;
}

// ================= AUDIO + TIMER =================
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
    liveSecondsEl.textContent = liveSeconds;
  }, 1000);
});

audio.addEventListener("pause", () => {
  if (timer) clearInterval(timer);
  timer = null;
});

freqSelect.addEventListener("change", () => {
  audio.pause();
  audio.currentTime = 0;
  audio.src = `${freqSelect.value}.mp3`;
  audio.load();
  resetLiveTimer();
});

// ================= SAVE SESSION =================
saveSessionBtn.addEventListener("click", async () => {
  const user = currentUser();
  if (!user) {
    alert("Select a user first");
    return;
  }

  const before = clamp(Number(moodBefore.value), 0, 10);
  const after = clamp(Number(moodAfter.value), 0, 10);
  if (liveSeconds <= 0) {
    alert("Play the audio first");
    return;
  }

  await saveSession({
    user,
    freq: Number(freqSelect.value),
    duration: liveSeconds,
    before,
    after,
    improvement: after - before,
    date: nowISO()
  });

  resetLiveTimer();
  await renderAll();
});

// ================= TABLE =================
async function renderTable() {
  const sessions = await loadSessions(currentUser());
  sessionsTableBody.innerHTML = "";

  sessions.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(s.date)}</td>
      <td>${s.user}</td>
      <td>${trackName(s.freq)}</td>
      <td>${s.duration}</td>
      <td>${s.before}</td>
      <td>${s.after}</td>
      <td>${s.improvement}</td>
      <td><button data-id="${s.id}">Delete</button></td>
    `;
    sessionsTableBody.appendChild(tr);
  });

  sessionsTableBody.querySelectorAll("button").forEach(b => {
    b.onclick = async () => {
      await deleteSession(b.dataset.id);
      await renderAll();
    };
  });
}

// ================= STATS + CHART =================
async function computeStats() {
  const sessions = await loadSessions(currentUser());
  statTotal.textContent = sessions.length;

  if (!sessions.length) {
    statAvg.textContent = "0";
    statMost.textContent = "—";
    return {};
  }

  const avg =
    sessions.reduce((s, x) => s + x.improvement, 0) / sessions.length;
  statAvg.textContent = avg.toFixed(2);

  const counts = {};
  sessions.forEach(s => counts[s.freq] = (counts[s.freq] || 0) + 1);
  const most = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  statMost.textContent = trackName(most);

  return counts;
}

// ================= FINAL ANALYSIS =================
async function generateFinalAnalysis() {
  const sessions = await loadSessions(currentUser());
  if (!sessions.length) {
    analysisTextEl.textContent = "No analysis yet.";
    return;
  }

  const bestFreq = sessions
    .map(s => s.freq)
    .sort((a,b)=>sessions.filter(x=>x.freq===b).length - sessions.filter(x=>x.freq===a).length)[0];

  const t = TRACKS[bestFreq];

  analysisTextEl.textContent =
`Final Psychological Analysis

Best performing track: ${t.name}

Spectrum analysis indicates that this track is dominated by frequencies around ${t.dominant} Hz,
generally ranging between ${t.range[0]} Hz and ${t.range[1]} Hz.

This suggests that the perceived effect is not caused by a single frequency,
but by a frequency band where multiple components coexist.

Note: This analysis is based on user-reported mood changes and is not medical advice.`;
}

// ================= RENDER =================
async function renderAll() {
  analyticsTitle.textContent = currentUser()
    ? `Analytics – ${currentUser()}`
    : "Analytics (All users)";

  await renderUsers();
  await renderTable();
  await computeStats();
  await generateFinalAnalysis();
}

// ================= START =================
audio.src = "432.mp3";
audio.load();
renderAll();
