// ===== Frequency Tracker (Y-axis = Hz) =====
(() => {
  const audioEl = document.getElementById("audio");
  const canvas = document.getElementById("spectrumCanvas");
  if (!audioEl || !canvas) return;

  const ctx2d = canvas.getContext("2d");

  let audioCtx, analyser, source, dataArray, rafId;

  // عرض آخر كم ثانية على الرسم
  const WINDOW_SEC = 10;

  // حد أعلى لمحور التردد (Hz) لتوضيح المجال
  // إذا بدك أوسع: خليها 5000 مثلاً
  const Y_MAX_HZ = 2000;

  // تخزين نقاط (وقت, تردد)
  let points = [];

  function setupAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // IMPORTANT: لا يعمل إلا مرة واحدة لنفس audio element
    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function hzFromIndex(i) {
    // binHz = sampleRate / fftSize
    return (i * audioCtx.sampleRate) / analyser.fftSize;
  }

  function getDominantFrequencyHz() {
    analyser.getByteFrequencyData(dataArray);

    // نأخذ أقوى bin (Peak)
    let maxVal = 0;
    let maxIdx = 0;

    // تجاهل الترددات المنخفضة جدًا (0..10Hz) لأنها غالبًا ضجيج
    const START_HZ = 10;
    const startIdx = Math.floor((START_HZ * analyser.fftSize) / audioCtx.sampleRate);

    for (let i = startIdx; i < dataArray.length; i++) {
      const v = dataArray[i];
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }

    // إذا الصوت هادي جدًا
    if (maxVal < 5) return null;

    return hzFromIndex(maxIdx);
  }

  function drawAxes(paddingL, paddingT, w, h) {
    ctx2d.strokeStyle = "#93a4b8";
    ctx2d.lineWidth = 1;

    // محور Y و X
    ctx2d.beginPath();
    ctx2d.moveTo(paddingL, paddingT);
    ctx2d.lineTo(paddingL, paddingT + h);
    ctx2d.lineTo(paddingL + w, paddingT + h);
    ctx2d.stroke();

    // تدريجات Y (Hz)
    ctx2d.fillStyle = "#c9d6e7";
    ctx2d.font = "14px system-ui";

    const ticks = [0, 40, 80, 200, 500, 1000, 1500, 2000].filter(t => t <= Y_MAX_HZ);
    ticks.forEach(t => {
      const y = paddingT + h - (t / Y_MAX_HZ) * h;

      // grid line
      ctx2d.strokeStyle = "rgba(31,42,55,0.35)";
      ctx2d.beginPath();
      ctx2d.moveTo(paddingL, y);
      ctx2d.lineTo(paddingL + w, y);
      ctx2d.stroke();

      // label
      ctx2d.fillText(`${t} Hz`, 10, y + 4);
    });

    // عنوان بسيط للمحاور
    ctx2d.fillStyle = "#c9d6e7";
    ctx2d.fillText("Hz", 10, paddingT - 6);
    ctx2d.fillText("time (last 10s)", paddingL + 6, paddingT + h + 28);
  }

  function drawBand(paddingL, paddingT, w, h, hzMin, hzMax, label) {
    const y1 = paddingT + h - (clamp(hzMax, 0, Y_MAX_HZ) / Y_MAX_HZ) * h;
    const y2 = paddingT + h - (clamp(hzMin, 0, Y_MAX_HZ) / Y_MAX_HZ) * h;

    ctx2d.fillStyle = "rgba(29, 78, 216, 0.10)";
    ctx2d.fillRect(paddingL, y1, w, y2 - y1);

    ctx2d.fillStyle = "rgba(200, 220, 255, 0.85)";
    ctx2d.font = "12px system-ui";
    ctx2d.fillText(label, paddingL + 8, y1 + 14);
  }

  function draw() {
    if (!analyser || !audioCtx) return;

    const tNow = audioEl.currentTime;
    const fNow = getDominantFrequencyHz();

    // سجّل النقطة الحالية
    if (fNow !== null) {
      points.push({ t: tNow, f: fNow });
    }

    // احتفظ فقط بآخر WINDOW_SEC
    const tMin = Math.max(0, tNow - WINDOW_SEC);
    points = points.filter(p => p.t >= tMin);

    // رسم
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    const paddingL = 70;
    const paddingR = 20;
    const paddingT = 20;
    const paddingB = 45;

    const w = canvas.width - paddingL - paddingR;
    const h = canvas.height - paddingT - paddingB;

    // ظلّل مجال 40–80Hz (حسب كلام الدكتور)
    drawBand(paddingL, paddingT, w, h, 40, 80, "Target band: 40–80 Hz");

    drawAxes(paddingL, paddingT, w, h);

    // احسب min/max لآخر نافذة
    let minF = Infinity, maxF = -Infinity;
    for (const p of points) {
      minF = Math.min(minF, p.f);
      maxF = Math.max(maxF, p.f);
    }
    if (!isFinite(minF)) { minF = 0; maxF = 0; }

    // ارسم خط التردد
    if (points.length >= 2) {
      ctx2d.strokeStyle = "#1d4ed8";
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();

      points.forEach((p, idx) => {
        const x = paddingL + ((p.t - tMin) / WINDOW_SEC) * w;
        const y = paddingT + h - (clamp(p.f, 0, Y_MAX_HZ) / Y_MAX_HZ) * h;

        if (idx === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      });

      ctx2d.stroke();
    }

    // نص معلومات فوق
    ctx2d.fillStyle = "#e8eef6";
    ctx2d.font = "13px system-ui";
    const currentText = (fNow === null) ? "Dominant: —" : `Dominant: ${fNow.toFixed(1)} Hz`;
    ctx2d.fillText(currentText, paddingL + 6, 16);
    ctx2d.fillText(`Range (last ${WINDOW_SEC}s): ${minF.toFixed(1)}–${maxF.toFixed(1)} Hz`, paddingL + 160, 16);

    rafId = requestAnimationFrame(draw);
  }

  audioEl.addEventListener("play", async () => {
    setupAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    if (!rafId) draw();
  });

  audioEl.addEventListener("pause", () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  });

  audioEl.addEventListener("ended", () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  });
})();
