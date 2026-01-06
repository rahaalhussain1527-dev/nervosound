import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

// ELEMENTS
const newUserName = document.getElementById("newUserName");
const addUserBtn = document.getElementById("addUserBtn");
const userSelect = document.getElementById("userSelect");

const freqSelect = document.getElementById("freqSelect");
const audio = document.getElementById("audio");
const liveSecondsEl = document.getElementById("liveSeconds");

const moodBefore = document.getElementById("moodBefore");
const moodAfter = document.getElementById("moodAfter");
const saveSessionBtn = document.getElementById("saveSessionBtn");

const statTotal = document.getElementById("statTotal");
const statAvg = document.getElementById("statAvg");
const statMost = document.getElementById("statMost");

const testBtn = document.getElementById("testFirestoreBtn");

// TIMER
let timer = null;
let seconds = 0;

audio.addEventListener("play", () => {
  if (timer) return;
  timer = setInterval(() => {
    seconds++;
    liveSecondsEl.textContent = seconds;
  }, 1000);
});

audio.addEventListener("pause", () => {
  clearInterval(timer);
  timer = null;
});

freqSelect.addEventListener("change", () => {
  audio.src = `${freqSelect.value}.mp3`;
  audio.load();
  seconds = 0;
  liveSecondsEl.textContent = "0";
});

// USERS
async function loadUsers() {
  userSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.textContent = d.data().name;
    userSelect.appendChild(opt);
  });
}

addUserBtn.onclick = async () => {
  if (!newUserName.value) return;
  await addDoc(collection(db, "users"), { name: newUserName.value });
  newUserName.value = "";
  loadUsers();
};

// SESSIONS
saveSessionBtn.onclick = async () => {
  if (!userSelect.value || seconds === 0) return alert("Play audio first");

  const before = Number(moodBefore.value);
  const after = Number(moodAfter.value);

  await addDoc(collection(db, "sessions"), {
    user: userSelect.value,
    freq: freqSelect.value,
    duration: seconds,
    before,
    after,
    improvement: after - before,
    date: new Date().toISOString()
  });

  seconds = 0;
  liveSecondsEl.textContent = "0";
  loadStats();
};

// STATS
async function loadStats() {
  const snap = await getDocs(collection(db, "sessions"));
  const data = snap.docs.map(d => d.data());

  statTotal.textContent = data.length;

  if (!data.length) return;

  const avg =
    data.reduce((s, x) => s + x.improvement, 0) / data.length;
  statAvg.textContent = avg.toFixed(2);

  const count = {};
  data.forEach(s => count[s.freq] = (count[s.freq] || 0) + 1);
  statMost.textContent = Object.keys(count).sort((a,b)=>count[b]-count[a])[0];
}

// TEST FIRESTORE
testBtn.onclick = async () => {
  const ref = await addDoc(collection(db, "test"), {
    hello: "world",
    time: new Date().toISOString()
  });
  alert("Firestore OK: " + ref.id);
};

// START
audio.src = "432.mp3";
loadUsers();
loadStats();
