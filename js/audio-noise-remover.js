/* Audio Noise Remover — real spectral noise gating using a hand-written
   FFT (no external DSP library). The user marks a short quiet section;
   its average magnitude spectrum becomes the "noise profile", which is
   subtracted (spectral subtraction with a spectral floor to avoid harsh
   artifacts) from every overlapping analysis window across the whole
   recording. Reconstructed via inverse FFT + overlap-add, then encoded
   to a 16-bit PCM WAV file. Everything runs in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneNoise');
  const fileInput = document.getElementById('fileInputNoise');
  const waveWrap = document.getElementById('noiseWaveWrap');
  const waveCanvas = document.getElementById('noiseWaveCanvas');
  const selectionInfo = document.getElementById('noiseSelectionInfo');
  const strengthField = document.getElementById('noiseStrengthField');
  const strengthSlider = document.getElementById('noiseStrength');
  const controls = document.getElementById('noiseControls');
  const removeBtn = document.getElementById('noiseRemoveBtn');
  const statusMsg = document.getElementById('statusMsgNoise');
  const resultBox = document.getElementById('resultBoxNoise');
  const resultAudio = document.getElementById('noiseResultAudio');
  const downloadLink = document.getElementById('downloadLinkNoise');
  const progressWrap = document.getElementById('progressWrapNoise');
  const progressBar = document.getElementById('progressBarNoise');

  if (!dropzone) return;

  const WINDOW_SIZE = 2048;
  const HOP_SIZE = 512; // 75% overlap, satisfies COLA for Hann window

  let selectedFile = null;
  let audioBuffer = null;
  let monoSamples = null;
  let selStart = null, selEnd = null;
  let dragStartX = null;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  async function handleFile(file) {
    if (!file.type.startsWith('audio/')) {
      statusMsg.textContent = 'Please choose an audio file.';
      return;
    }
    selectedFile = file;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Decoding audio...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Downmix to mono for processing.
      const numCh = audioBuffer.numberOfChannels;
      const len = audioBuffer.length;
      monoSamples = new Float32Array(len);
      for (let c = 0; c < numCh; c++) {
        const chData = audioBuffer.getChannelData(c);
        for (let i = 0; i < len; i++) monoSamples[i] += chData[i] / numCh;
      }

      drawWaveform();
      waveWrap.style.display = '';
      strengthField.style.display = '';
      controls.style.display = '';
      selStart = null; selEnd = null;
      selectionInfo.textContent = 'No selection yet — drag across the waveform.';
      statusMsg.textContent = 'Loaded — ' + audioBuffer.duration.toFixed(1) + 's audio.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Could not read this audio file. Please try a different file.';
      console.error(err);
    }
  }

  function drawWaveform() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = waveCanvas.clientWidth || 600;
    const cssH = 110;
    waveCanvas.width = cssW * dpr;
    waveCanvas.height = cssH * dpr;
    const ctx = waveCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = 'rgba(37,99,235,0.08)';
    ctx.fillRect(0, 0, cssW, cssH);

    const samplesPerPx = Math.max(1, Math.floor(monoSamples.length / cssW));
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cssW; x++) {
      let min = 1, max = -1;
      const start = x * samplesPerPx;
      for (let i = 0; i < samplesPerPx; i++) {
        const v = monoSamples[start + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const yMin = (1 - min) * (cssH / 2) / 1;
      const yMax = (1 - max) * (cssH / 2) / 1;
      ctx.moveTo(x, cssH / 2 - min * (cssH / 2));
      ctx.lineTo(x, cssH / 2 - max * (cssH / 2));
    }
    ctx.stroke();
    redrawSelection();
  }

  function redrawSelection() {
    if (selStart === null) return;
    const cssW = waveCanvas.clientWidth || 600;
    const ctx = waveCanvas.getContext('2d');
    const x1 = (selStart / monoSamples.length) * cssW;
    const x2 = (selEnd / monoSamples.length) * cssW;
    ctx.fillStyle = 'rgba(220,38,38,0.25)';
    ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), 110);
  }

  waveCanvas.addEventListener('mousedown', (e) => {
    const rect = waveCanvas.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
  });
  waveCanvas.addEventListener('mousemove', (e) => {
    if (dragStartX === null) return;
    const rect = waveCanvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const cssW = waveCanvas.clientWidth || 600;
    const s = Math.round((Math.min(dragStartX, curX) / cssW) * monoSamples.length);
    const en = Math.round((Math.max(dragStartX, curX) / cssW) * monoSamples.length);
    selStart = Math.max(0, s);
    selEnd = Math.min(monoSamples.length, en);
    drawWaveform();
  });
  window.addEventListener('mouseup', () => {
    if (dragStartX === null) return;
    dragStartX = null;
    if (selStart !== null && selEnd - selStart > 200) {
      const durS = ((selEnd - selStart) / audioBuffer.sampleRate).toFixed(2);
      selectionInfo.textContent = 'Noise sample selected: ' + durS + 's. Ready to remove noise.';
    } else {
      selStart = null; selEnd = null;
      selectionInfo.textContent = 'Selection too short — drag a wider region.';
    }
  });

  /* ---- Hand-written iterative radix-2 FFT (in-place, real+imag arrays) ---- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wRe = Math.cos(ang), wIm = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0;
        for (let k = 0; k < len / 2; k++) {
          const uRe = re[i + k], uIm = im[i + k];
          const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
          const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
          re[i + k] = uRe + vRe;
          im[i + k] = uIm + vIm;
          re[i + k + len / 2] = uRe - vRe;
          im[i + k + len / 2] = uIm - vIm;
          const nextRe = curRe * wRe - curIm * wIm;
          const nextIm = curRe * wIm + curIm * wRe;
          curRe = nextRe; curIm = nextIm;
        }
      }
    }
  }
  function ifft(re, im) {
    const n = re.length;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < n; i++) { re[i] = re[i] / n; im[i] = -im[i] / n; }
  }

  function hannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    return w;
  }

  function computeNoiseProfile(samples, start, end, win) {
    const half = WINDOW_SIZE / 2 + 1;
    const profile = new Float32Array(half);
    let frameCount = 0;
    for (let pos = start; pos + WINDOW_SIZE <= end; pos += HOP_SIZE) {
      const re = new Float32Array(WINDOW_SIZE);
      const im = new Float32Array(WINDOW_SIZE);
      for (let i = 0; i < WINDOW_SIZE; i++) re[i] = (samples[pos + i] || 0) * win[i];
      fft(re, im);
      for (let k = 0; k < half; k++) profile[k] += Math.hypot(re[k], im[k]);
      frameCount++;
    }
    if (frameCount === 0) {
      // Fallback: single frame at start
      const re = new Float32Array(WINDOW_SIZE);
      const im = new Float32Array(WINDOW_SIZE);
      for (let i = 0; i < WINDOW_SIZE; i++) re[i] = (samples[start + i] || 0) * win[i];
      fft(re, im);
      for (let k = 0; k < half; k++) profile[k] = Math.hypot(re[k], im[k]);
      return profile;
    }
    for (let k = 0; k < half; k++) profile[k] /= frameCount;
    return profile;
  }

  function denoiseSignal(samples, noiseProfile, strengthPct, onProgress) {
    const win = hannWindow(WINDOW_SIZE);
    const half = WINDOW_SIZE / 2 + 1;
    const overSubtract = 1.0 + (strengthPct / 100) * 2.0; // how aggressively to subtract
    const spectralFloor = 0.02; // keep a residual to avoid harsh "musical noise"

    const output = new Float32Array(samples.length + WINDOW_SIZE);
    const windowSum = new Float32Array(samples.length + WINDOW_SIZE);

    const totalFrames = Math.ceil(samples.length / HOP_SIZE);
    let frameIdx = 0;

    for (let pos = 0; pos < samples.length; pos += HOP_SIZE) {
      const re = new Float32Array(WINDOW_SIZE);
      const im = new Float32Array(WINDOW_SIZE);
      for (let i = 0; i < WINDOW_SIZE; i++) re[i] = (samples[pos + i] || 0) * win[i];

      fft(re, im);

      for (let k = 0; k < half; k++) {
        const mag = Math.hypot(re[k], im[k]);
        const phase = Math.atan2(im[k], re[k]);
        let newMag = mag - overSubtract * noiseProfile[k];
        const floor = spectralFloor * mag;
        if (newMag < floor) newMag = floor;
        re[k] = newMag * Math.cos(phase);
        im[k] = newMag * Math.sin(phase);
        if (k > 0 && k < WINDOW_SIZE / 2) {
          const mirror = WINDOW_SIZE - k;
          re[mirror] = re[k];
          im[mirror] = -im[k];
        }
      }

      ifft(re, im);

      for (let i = 0; i < WINDOW_SIZE; i++) {
        output[pos + i] += re[i] * win[i];
        windowSum[pos + i] += win[i] * win[i];
      }

      frameIdx++;
      if (frameIdx % 20 === 0 && onProgress) onProgress(frameIdx / totalFrames);
    }

    const cleaned = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      cleaned[i] = windowSum[i] > 1e-6 ? output[i] / windowSum[i] : output[i];
    }
    return cleaned;
  }

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  removeBtn.addEventListener('click', () => {
    if (!monoSamples) {
      statusMsg.textContent = 'Please choose an audio file first.';
      return;
    }
    if (selStart === null) {
      statusMsg.textContent = 'Please select a quiet noise sample on the waveform first.';
      return;
    }
    removeBtn.disabled = true;
    const durationForGate = Math.max(1, Math.round(audioBuffer.duration));
    adGate.run(durationForGate, async () => {
      await runDenoise();
    }, statusMsg, 'This ' + audioBuffer.duration.toFixed(0) + 's recording');
  });

  async function runDenoise() {
    statusMsg.textContent = 'Analyzing noise profile...';
    progressWrap.classList.add('show');
    progressBar.style.width = '5%';

    try {
      const win = hannWindow(WINDOW_SIZE);
      const noiseProfile = computeNoiseProfile(monoSamples, selStart, selEnd, win);
      const strength = parseInt(strengthSlider.value, 10);

      statusMsg.textContent = 'Removing noise... this happens in your browser, nothing is uploaded.';

      // Yield to the browser so the progress bar can render before the heavy loop.
      await new Promise((r) => setTimeout(r, 30));

      const cleaned = denoiseSignal(monoSamples, noiseProfile, strength, (frac) => {
        progressBar.style.width = (5 + frac * 90) + '%';
      });

      const blob = encodeWav(cleaned, audioBuffer.sampleRate);
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      resultAudio.src = url;
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-denoised.wav';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Background noise reduced.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong removing noise. Please try again.';
      console.error(err);
    } finally {
      removeBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }

  window.addEventListener('resize', () => { if (monoSamples) drawWaveform(); });
})();
