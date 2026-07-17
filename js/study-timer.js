/* Study Timer — Pomodoro-style focus/break countdown timer.
   Runs entirely client-side using setInterval; no data leaves the page. */
(function () {
  const timerModeLabel = document.getElementById('timerModeLabel');
  const timerDisplay = document.getElementById('timerDisplay');
  const sessionCountLabel = document.getElementById('sessionCountLabel');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const skipBtn = document.getElementById('skipBtn');
  const presetGroup = document.getElementById('timerPreset');
  const workMinutesInput = document.getElementById('workMinutes');
  const shortBreakInput = document.getElementById('shortBreakMinutes');
  const longBreakInput = document.getElementById('longBreakMinutes');

  if (!timerDisplay) return;

  const MODES = { WORK: 'work', SHORT: 'short', LONG: 'long' };
  const SESSIONS_BEFORE_LONG_BREAK = 4;

  let mode = MODES.WORK;
  let secondsLeft = parseInt(workMinutesInput.value, 10) * 60;
  let sessionNumber = 1;
  let intervalId = null;
  let running = false;

  let audioCtx = null;
  function playChime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) { /* audio not available */ }
  }

  function getDurationSeconds(m) {
    if (m === MODES.WORK) return (parseInt(workMinutesInput.value, 10) || 25) * 60;
    if (m === MODES.SHORT) return (parseInt(shortBreakInput.value, 10) || 5) * 60;
    return (parseInt(longBreakInput.value, 10) || 15) * 60;
  }

  function updateDisplay() {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
    document.title = `${mins}:${secs} — ${mode === MODES.WORK ? 'Focus' : 'Break'} | Study Timer`;

    if (mode === MODES.WORK) {
      timerModeLabel.textContent = 'Focus session';
    } else if (mode === MODES.SHORT) {
      timerModeLabel.textContent = 'Short break';
    } else {
      timerModeLabel.textContent = 'Long break';
    }
    sessionCountLabel.textContent = `Session ${sessionNumber} of ${SESSIONS_BEFORE_LONG_BREAK}`;
  }

  function nextMode() {
    if (mode === MODES.WORK) {
      if (sessionNumber >= SESSIONS_BEFORE_LONG_BREAK) {
        mode = MODES.LONG;
        sessionNumber = 1;
      } else {
        mode = MODES.SHORT;
      }
    } else {
      if (mode === MODES.SHORT) sessionNumber++;
      mode = MODES.WORK;
    }
    secondsLeft = getDurationSeconds(mode);
    updateDisplay();
  }

  function tick() {
    secondsLeft--;
    if (secondsLeft < 0) {
      playChime();
      nextMode();
      return;
    }
    updateDisplay();
  }

  function start() {
    if (running) return;
    running = true;
    startPauseBtn.textContent = '⏸ Pause';
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    running = false;
    startPauseBtn.textContent = '▶ Start';
    clearInterval(intervalId);
  }

  startPauseBtn.addEventListener('click', () => {
    if (running) pause(); else start();
  });

  resetBtn.addEventListener('click', () => {
    pause();
    mode = MODES.WORK;
    sessionNumber = 1;
    secondsLeft = getDurationSeconds(MODES.WORK);
    updateDisplay();
  });

  skipBtn.addEventListener('click', () => {
    nextMode();
  });

  presetGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      presetGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      workMinutesInput.value = btn.dataset.work;
      shortBreakInput.value = btn.dataset.short;
      longBreakInput.value = btn.dataset.long;
      pause();
      mode = MODES.WORK;
      sessionNumber = 1;
      secondsLeft = getDurationSeconds(MODES.WORK);
      updateDisplay();
    });
  });

  [workMinutesInput, shortBreakInput, longBreakInput].forEach(input => {
    input.addEventListener('change', () => {
      if (!running) {
        secondsLeft = getDurationSeconds(mode);
        updateDisplay();
      }
    });
  });

  updateDisplay();
})();
