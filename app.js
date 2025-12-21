const musicSelect = document.getElementById("musicSelect");
const audioPlayer = document.getElementById("audioPlayer");
const noteBox = document.getElementById("noteBox");
const warningText = document.getElementById("warningText");
const descText = document.getElementById("descText");
const listeningTimeEl = document.getElementById("listeningTime");

let seconds = 0;
let timer = null;

const tracks = {
  relaxation: {
    file: "432.mp3",
    warning: "Uyarı: Bu içerik tıbbi tedavi yerine geçmez.",
    desc:
      "Relaxation seçildi. Analizde düşük ve orta frekansların daha belirgin olduğu gözlemlenebilir. Amaç; sakinlik ve gevşeme hissini desteklemektir."
  },
  focus: {
    file: "852.mp3",
    warning: "Uyarı: Bu içerik tıbbi tedavi yerine geçmez.",
    desc:
      "Focus seçildi. Analizde orta-yüksek bantlarda daha belirgin bileşenler görülebilir. Amaç; dikkat ve zihinsel netliği desteklemektir."
  },
  sleep: {
    file: "963.mp3",
    warning: "Uyarı: Bu içerik tıbbi tedavi yerine geçmez.",
    desc:
      "Sleep seçildi. Analizde daha yumuşak ve dengeli bir dağılım gözlemlenebilir. Amaç; rahatlama ve uykuya geçişi desteklemektir."
  }
};

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    seconds += 1;
    listeningTimeEl.textContent = String(seconds);
  }, 1000);
}

function resetSession() {
  seconds = 0;
  listeningTimeEl.textContent = "0";
  stopTimer();
}

musicSelect.addEventListener("change", () => {
  const key = musicSelect.value;
  const t = tracks[key];
  if (!t) return;

  // Not
  warningText.textContent = t.warning;
  descText.textContent = t.desc;
  noteBox.classList.remove("hidden");

  // Audio
  resetSession();
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  audioPlayer.src = "./" + t.file;   // GitHub Pages için güvenli
  audioPlayer.load();
});

audioPlayer.addEventListener("play", () => startTimer());
audioPlayer.addEventListener("pause", () => stopTimer());
audioPlayer.addEventListener("ended", () => stopTimer());
