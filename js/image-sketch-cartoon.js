/* Image to Sketch & Cartoon — canvas-based filters, no AI model needed.
   Sketch: grayscale + Sobel edge detection, inverted into pencil lines.
   Cartoon: color posterize (quantize) + dark edge overlay. */

(function () {
  const dropzone = document.getElementById('dropzoneSketch');
  const fileInput = document.getElementById('fileInputSketch');
  const modeField = document.getElementById('sketchModeField');
  const modeGroup = document.getElementById('sketchModeGroup');
  const previewWrap = document.getElementById('sketchPreviewWrap');
  const canvas = document.getElementById('sketchCanvas');
  const intensityField = document.getElementById('sketchIntensityField');
  const intensitySlider = document.getElementById('sketchIntensity');
  const controls = document.getElementById('sketchControls');
  const downloadBtn = document.getElementById('sketchDownloadBtn');
  const statusMsg = document.getElementById('statusMsgSketch');

  if (!dropzone) return;

  let sourceImageData = null;
  let modeValue = 'sketch';

  modeGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      modeGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      modeValue = btn.dataset.value;
      applyEffect();
    });
  });

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
      const MAX_DIM = 1400;
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
      sourceImageData = ctx.getImageData(0, 0, w, h);

      previewWrap.style.display = '';
      modeField.style.display = '';
      intensityField.style.display = '';
      controls.style.display = '';
      statusMsg.textContent = 'Choose a style and adjust intensity.';
      applyEffect();
    };
    img.onerror = () => { statusMsg.textContent = 'Could not load this image.'; };
    img.src = URL.createObjectURL(file);
  }

  function toGrayscale(src) {
    const w = src.width, h = src.height;
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
      gray[p] = src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114;
    }
    return gray;
  }

  function sobelEdges(gray, w, h) {
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const edges = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sx = 0, sy = 0, k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const v = gray[(y + ky) * w + (x + kx)];
            sx += v * gx[k];
            sy += v * gy[k];
            k++;
          }
        }
        edges[y * w + x] = Math.sqrt(sx * sx + sy * sy);
      }
    }
    return edges;
  }

  function renderSketch(intensityPct) {
    const w = sourceImageData.width, h = sourceImageData.height;
    const gray = toGrayscale(sourceImageData);
    const edges = sobelEdges(gray, w, h);

    let maxEdge = 1;
    for (let i = 0; i < edges.length; i++) if (edges[i] > maxEdge) maxEdge = edges[i];

    const threshold = 1 - intensityPct / 100; // higher intensity -> lower threshold -> more lines
    const out = new ImageData(w, h);
    for (let i = 0, p = 0; i < out.data.length; i += 4, p++) {
      const normalized = edges[p] / maxEdge;
      const lineStrength = normalized > threshold * 0.35 ? normalized : 0;
      const value = 255 - Math.min(255, lineStrength * 255 * 1.8);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = value;
      out.data[i + 3] = 255;
    }
    canvas.getContext('2d').putImageData(out, 0, 0);
  }

  function renderCartoon(intensityPct) {
    const w = sourceImageData.width, h = sourceImageData.height;
    const gray = toGrayscale(sourceImageData);
    const edges = sobelEdges(gray, w, h);
    let maxEdge = 1;
    for (let i = 0; i < edges.length; i++) if (edges[i] > maxEdge) maxEdge = edges[i];

    const levels = Math.max(2, Math.round(8 - (intensityPct / 100) * 5)); // fewer levels = stronger posterize
    const step = 255 / (levels - 1);
    const edgeThreshold = 0.28;

    const out = new ImageData(w, h);
    for (let i = 0, p = 0; i < out.data.length; i += 4, p++) {
      let r = sourceImageData.data[i];
      let g = sourceImageData.data[i + 1];
      let b = sourceImageData.data[i + 2];
      r = Math.round(Math.round(r / step) * step);
      g = Math.round(Math.round(g / step) * step);
      b = Math.round(Math.round(b / step) * step);

      const isEdge = (edges[p] / maxEdge) > edgeThreshold;
      if (isEdge) { r = g = b = 20; }

      out.data[i] = Math.max(0, Math.min(255, r));
      out.data[i + 1] = Math.max(0, Math.min(255, g));
      out.data[i + 2] = Math.max(0, Math.min(255, b));
      out.data[i + 3] = 255;
    }
    canvas.getContext('2d').putImageData(out, 0, 0);
  }

  function applyEffect() {
    if (!sourceImageData) return;
    const intensity = parseInt(intensitySlider.value, 10);
    if (modeValue === 'sketch') renderSketch(intensity);
    else renderCartoon(intensity);
  }

  intensitySlider.addEventListener('input', applyEffect);

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = modeValue + '-result.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  });
})();
