/* Image Sharpener — genuine unsharp-mask convolution filter. Boosts
   contrast along detected edges to make a slightly soft photo look
   crisper. Not AI, not true deblurring — an honest classical filter. */

(function () {
  const dropzone = document.getElementById('dropzoneSharpen');
  const fileInput = document.getElementById('fileInputSharpen');
  const previewWrap = document.getElementById('sharpenPreviewWrap');
  const canvas = document.getElementById('sharpenCanvas');
  const amountField = document.getElementById('sharpenAmountField');
  const amountSlider = document.getElementById('sharpenAmount');
  const extraFields = document.getElementById('sharpenExtraFields');
  const radiusSelect = document.getElementById('sharpenRadius');
  const noiseSlider = document.getElementById('noiseReduction');
  const noiseVal = document.getElementById('noiseReductionVal');
  const grainSlider = document.getElementById('filmGrain');
  const grainVal = document.getElementById('filmGrainVal');
  const controls = document.getElementById('sharpenControls');
  const downloadBtn = document.getElementById('sharpenDownloadBtn');
  const statusMsg = document.getElementById('statusMsgSharpen');

  if (!dropzone) return;

  let originalImageData = null;
  let baseImage = null;

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

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    const img = new Image();
    img.onload = () => {
      baseImage = img;
      const MAX_DIM = 1600;
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = MAX_DIM / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      originalImageData = ctx.getImageData(0, 0, w, h);

      previewWrap.style.display = '';
      amountField.style.display = '';
      extraFields.style.display = '';
      controls.style.display = '';
      statusMsg.textContent = 'Drag the slider to adjust sharpening strength.';
      applySharpen();
    };
    img.onerror = () => { statusMsg.textContent = 'Could not load this image.'; };
    img.src = URL.createObjectURL(file);
  }

  /* Separable box blur (horizontal pass then vertical pass) via a sliding
     window sum — O(w*h) regardless of radius, unlike a naive NxN convolution.
     This is what lets the radius be a user-adjustable control instead of a
     fixed 3x3 kernel: radius 1 behaves like the old fixed sharpen, a larger
     radius is what turns "sharpness" into "acutance" (broad edge contrast). */
  function boxBlur(data, w, h, radius) {
    if (radius <= 0) return data.slice();
    const size = radius * 2 + 1;
    const tmp = new Float32Array(data.length);
    const out = new Uint8ClampedArray(data.length);

    for (let y = 0; y < h; y++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Math.min(w - 1, Math.max(0, k));
          sum += data[(y * w + sx) * 4 + c];
        }
        for (let x = 0; x < w; x++) {
          tmp[(y * w + x) * 4 + c] = sum / size;
          const addX = Math.min(w - 1, x + radius + 1);
          const subX = Math.max(0, x - radius);
          sum += data[(y * w + addX) * 4 + c] - data[(y * w + subX) * 4 + c];
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Math.min(h - 1, Math.max(0, k));
          sum += tmp[(sy * w + x) * 4 + c];
        }
        for (let y = 0; y < h; y++) {
          out[(y * w + x) * 4 + c] = sum / size;
          const addY = Math.min(h - 1, y + radius + 1);
          const subY = Math.max(0, y - radius);
          sum += tmp[(addY * w + x) * 4 + c] - tmp[(subY * w + x) * 4 + c];
        }
      }
    }
    for (let i = 3; i < out.length; i += 4) out[i] = data[i];
    return out;
  }

  function applySharpen() {
    if (!originalImageData) return;
    const amount = parseInt(amountSlider.value, 10) / 100; // 0..1
    const radius = parseInt(radiusSelect.value, 10) || 2;
    const noiseAmt = parseInt(noiseSlider.value, 10) / 100;
    const grainAmt = parseInt(grainSlider.value, 10);
    const w = originalImageData.width, h = originalImageData.height;

    let working = originalImageData.data;

    // Pass 1: noise reduction — blend a light blur into the original.
    // Blending (not a hard replace) keeps real edges from going mushy.
    if (noiseAmt > 0) {
      const denoiseBlur = boxBlur(working, w, h, 1);
      const blended = new Uint8ClampedArray(working.length);
      for (let i = 0; i < working.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          blended[i + c] = working[i + c] * (1 - noiseAmt) + denoiseBlur[i + c] * noiseAmt;
        }
        blended[i + 3] = working[i + 3];
      }
      working = blended;
    }

    // Pass 2: unsharp mask — sharpened = original + amount*(original - blurred).
    // A larger blur radius here is exactly what turns this into an acutance
    // (broad local-contrast) effect instead of fine-detail sharpening.
    if (amount > 0) {
      const blurred = boxBlur(working, w, h, radius);
      const strength = amount * 2.2;
      const sharpened = new Uint8ClampedArray(working.length);
      for (let i = 0; i < working.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const detail = working[i + c] - blurred[i + c];
          sharpened[i + c] = Math.max(0, Math.min(255, working[i + c] + detail * strength));
        }
        sharpened[i + 3] = working[i + 3];
      }
      working = sharpened;
    }

    // Pass 3: synthetic film grain — a stylistic effect added last, after
    // sharpening, so it isn't itself amplified by the unsharp mask.
    if (grainAmt > 0) {
      const grained = new Uint8ClampedArray(working.length);
      const strength = grainAmt / 100 * 40; // up to +/-40 luminance noise at 100%
      for (let i = 0; i < working.length; i += 4) {
        const noise = (Math.random() - 0.5) * 2 * strength;
        for (let c = 0; c < 3; c++) {
          grained[i + c] = Math.max(0, Math.min(255, working[i + c] + noise));
        }
        grained[i + 3] = working[i + 3];
      }
      working = grained;
    }

    const outData = new ImageData(new Uint8ClampedArray(working), w, h);
    canvas.getContext('2d').putImageData(outData, 0, 0);
  }

  amountSlider.addEventListener('input', applySharpen);
  radiusSelect.addEventListener('change', applySharpen);
  noiseSlider.addEventListener('input', () => { noiseVal.textContent = noiseSlider.value; applySharpen(); });
  grainSlider.addEventListener('input', () => { grainVal.textContent = grainSlider.value; applySharpen(); });

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'sharpened-photo.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  });
})();
