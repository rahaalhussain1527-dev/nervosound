// ================= FIREBASE =================
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

// ================= HELPERS =================
const $ = (id) => document.getElementById(id);
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function fmtDate(ts) {
  if (!ts) return "-";
  if (ts.toDate) return ts.toDate().toLocaleString("en-US");
  return new Date(ts).toLocaleString("en-US");
}

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
    note: "Supports relaxation and calmness."
  },
  852: {
    name: "Healing",
    dominant: 785,
    range: [293, 890],
    note: "Associated with emotional balance."
  },
  963: {
    name: "Spiritual Awareness",
    dominant: 890,
    range: [750, 960],
    note: "Associated with focus and awareness."
  }
};

function trackName(freq) {
  return TRACKS[freq]?.name || freq;
}

// ================= STATE =================
let timer = null;
let liveSeconds = 0;

// ================= FIRESTORE =================
const usersRef = collection(db, "users");
const sessionsRef = collection(db, "sessions");

async function loadUsers() {
  const snap = await getDocs(usersRef);
  return snap.docs.map(d => d.data().name);
}

async function saveUser(name) {
  await addDoc(usersRef, { name });
}

async function loadSessions(user = null) {
  let q = sessionsRef;
  if (user) q = query(sessionsRef, where("user", "==", user));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveSession(session) {
  await addDoc(sessionsRef, session);
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

audio.addEventListener("ended", resetLiveTimer);

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

  const session = {
    user,
    freq: Number(freqSelect.value),
    duration: liveSeconds,
    before,
    after,
    improvement: after - before,
    createdAt: serverTimestamp()
  };

  await saveSession(session);
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
      <td>${fmtDate(s.createdAt)}</td>
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

// ================= STATS =================
async function computeStats() {
  const sessions = await loadSessions(currentUser());
  statTotal.textContent = sessions.length;

  if (!sessions.length) {
    statAvg.textContent = "0";
    statMost.textContent = "—";
    return;
  }

  const avg =
    sessions.reduce((s, x) => s + x.improvement, 0) / sessions.length;
  statAvg.textContent = avg.toFixed(2);

  const counts = {};
  sessions.forEach(s => counts[s.freq] = (counts[s.freq] || 0) + 1);
  const most = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  statMost.textContent = trackName(most);
}

// ================= FINAL ANALYSIS =================
async function generateFinalAnalysis() {
  const sessions = await loadSessions(currentUser());
  if (!sessions.length) {
    analysisTextEl.textContent = "No analysis yet.";
    return;
  }

  const counts = {};
  sessions.forEach(s => counts[s.freq] = (counts[s.freq] || 0) + 1);
  const bestFreq = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  const t = TRACKS[bestFreq];

  analysisTextEl.textContent =
`Final Psychological Analysis

Best performing track: ${t.name}

Dominant frequency ≈ ${t.dominant} Hz
Frequency range ≈ ${t.range[0]}–${t.range[1]} Hz

The observed effect appears to emerge from a frequency band rather than a single tone.

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
