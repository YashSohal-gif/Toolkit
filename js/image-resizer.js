/* Image Resizer — resize to custom pixel dimensions or a percentage, with
   an optional aspect-ratio lock. */

(function () {
  const dropzone = document.getElementById('dropzoneResize');
  const fileInput = document.getElementById('fileInputResize');
  const modeRadios = document.querySelectorAll('input[name="resizeMode"]');
  const pxFields = document.getElementById('resizePxFields');
  const pctFields = document.getElementById('resizePctFields');
  const widthInput = document.getElementById('resizeWidth');
  const heightInput = document.getElementById('resizeHeight');
  const pctInput = document.getElementById('resizePct');
  const lockAspect = document.getElementById('resizeLockAspect');
  const resizeBtn = document.getElementById('resizeBtn');
  const statusMsg = document.getElementById('statusMsgResize');
  const resultBox = document.getElementById('resultBoxResize');
  const downloadLink = document.getElementById('downloadLinkResize');

  if (!dropzone) return;

  let selectedFile = null;
  let naturalW = 0, naturalH = 0;

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

  modeRadios.forEach((r) => r.addEventListener('change', () => {
    const mode = document.querySelector('input[name="resizeMode"]:checked').value;
    pxFields.style.display = mode === 'px' ? 'flex' : 'none';
    pctFields.style.display = mode === 'pct' ? 'flex' : 'none';
  }));

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    selectedFile = file;
    const img = new Image();
    img.onload = () => {
      naturalW = img.width;
      naturalH = img.height;
      widthInput.value = naturalW;
      heightInput.value = naturalH;
      dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + naturalW + '×' + naturalH + 'px)';
      updateStats();
    };
    img.src = URL.createObjectURL(file);
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  const dpiSelect = document.getElementById('resizeDpi');
  const statsBox = document.getElementById('resizeStats');
  const megapixelsEl = document.getElementById('resizeMegapixels');
  const printSizeEl = document.getElementById('resizePrintSize');

  function currentTargetSize() {
    const mode = document.querySelector('input[name="resizeMode"]:checked').value;
    if (mode === 'px') {
      return { w: parseInt(widthInput.value, 10) || 0, h: parseInt(heightInput.value, 10) || 0 };
    }
    const pct = parseFloat(pctInput.value) || 100;
    return { w: Math.round(naturalW * (pct / 100)), h: Math.round(naturalH * (pct / 100)) };
  }

  function updateStats() {
    if (!naturalW) { statsBox.style.display = 'none'; return; }
    const { w, h } = currentTargetSize();
    if (!w || !h) { statsBox.style.display = 'none'; return; }
    const dpi = parseInt(dpiSelect.value, 10) || 300;
    megapixelsEl.textContent = ((w * h) / 1000000).toFixed(2) + ' MP';
    const inW = (w / dpi).toFixed(2), inH = (h / dpi).toFixed(2);
    const cmW = (w / dpi * 2.54).toFixed(1), cmH = (h / dpi * 2.54).toFixed(1);
    printSizeEl.textContent = inW + '"×' + inH + '" (' + cmW + '×' + cmH + ' cm)';
    printSizeEl.style.fontSize = '1.1rem';
    statsBox.style.display = '';
  }

  widthInput.addEventListener('input', () => {
    if (lockAspect.checked && naturalW) {
      heightInput.value = Math.round((parseFloat(widthInput.value) || 0) * (naturalH / naturalW));
    }
    updateStats();
  });
  heightInput.addEventListener('input', () => {
    if (lockAspect.checked && naturalH) {
      widthInput.value = Math.round((parseFloat(heightInput.value) || 0) * (naturalW / naturalH));
    }
    updateStats();
  });
  pctInput.addEventListener('input', updateStats);
  dpiSelect.addEventListener('change', updateStats);
  modeRadios.forEach((r) => r.addEventListener('change', updateStats));

  // =========================================================================
  // DPI metadata embedding — canvas.toBlob() always writes a default 72 DPI
  // tag. These rewrite the file's own resolution field after the fact so
  // photo editors / print shops read the DPI the user actually chose.
  // =========================================================================
  function crc32(buf) {
    if (!crc32.table) {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      crc32.table = t;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  async function setJpegDpi(blob, dpi) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Standard canvas JPEG output starts SOI (FFD8) + APP0/JFIF (FFE0) —
    // bytes 13 (units), 14-15 (Xdensity), 16-17 (Ydensity) per the JFIF spec.
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF && buf[3] === 0xE0) {
      buf[13] = 1; // 1 = dots per inch
      buf[14] = (dpi >> 8) & 0xFF; buf[15] = dpi & 0xFF;
      buf[16] = (dpi >> 8) & 0xFF; buf[17] = dpi & 0xFF;
      return new Blob([buf], { type: 'image/jpeg' });
    }
    return blob;
  }

  async function setPngDpi(blob, dpi) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254); // pixels per meter, what PNG's pHYs chunk stores

    const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    const data = new Uint8Array(9);
    new DataView(data.buffer).setUint32(0, ppm, false);
    new DataView(data.buffer).setUint32(4, ppm, false);
    data[8] = 1; // unit specifier: 1 = meters
    const typeAndData = new Uint8Array(type.length + data.length);
    typeAndData.set(type, 0); typeAndData.set(data, type.length);
    const crc = crc32(typeAndData);

    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    new DataView(chunk.buffer).setUint32(0, data.length, false);
    chunk.set(type, 4);
    chunk.set(data, 8);
    new DataView(chunk.buffer).setUint32(8 + data.length, crc, false);

    const parts = [buf.slice(0, 8)]; // PNG signature
    let pos = 8;
    while (pos < buf.length) {
      const len = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0, false);
      const typeStr = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
      const total = 4 + 4 + len + 4;
      if (typeStr === 'pHYs') { pos += total; continue; } // drop any existing pHYs, we replace it
      parts.push(buf.slice(pos, pos + total));
      if (typeStr === 'IHDR') parts.push(chunk); // insert ours right after IHDR
      pos += total;
    }
    const totalLen = parts.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const part of parts) { out.set(part, off); off += part.length; }
    return new Blob([out], { type: 'image/png' });
  }

  async function embedDpi(blob, mime, dpi) {
    try {
      if (mime === 'image/jpeg') return await setJpegDpi(blob, dpi);
      if (mime === 'image/png') return await setPngDpi(blob, dpi);
    } catch (e) {
      console.warn('Could not embed DPI metadata, using original file.', e);
    }
    return blob; // WebP (or a parsing failure) — return unchanged
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  resizeBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    const mode = document.querySelector('input[name="resizeMode"]:checked').value;
    let targetW, targetH;
    if (mode === 'px') {
      targetW = parseInt(widthInput.value, 10);
      targetH = parseInt(heightInput.value, 10);
    } else {
      const pct = parseFloat(pctInput.value) || 100;
      targetW = Math.round(naturalW * (pct / 100));
      targetH = Math.round(naturalH * (pct / 100));
    }
    if (!targetW || !targetH || targetW <= 0 || targetH <= 0) {
      statusMsg.textContent = 'Please enter a valid size.';
      return;
    }

    const formatSel = document.getElementById('resizeFormat');
    const qualitySlider = document.getElementById('resizeQuality');
    const noEnlarge = document.getElementById('resizeNoEnlarge');
    const mime = formatSel ? formatSel.value : 'image/jpeg';
    const quality = qualitySlider ? parseInt(qualitySlider.value, 10) / 100 : 0.95;

    if (noEnlarge && noEnlarge.checked && (targetW > naturalW || targetH > naturalH)) {
      const scale = Math.min(naturalW / targetW, naturalH / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    resizeBtn.disabled = true;
    statusMsg.textContent = 'Resizing...';

    try {
      const img = await loadImage(selectedFile);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (mime === 'image/jpeg') {
        /* JPG has no alpha — flatten transparent PNGs onto white instead of black */
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const dpi = dpiSelect ? parseInt(dpiSelect.value, 10) : 300;
      canvas.toBlob(async (rawBlob) => {
        const blob = await embedDpi(rawBlob, mime, dpi);
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
        downloadLink.download = originalName + '-' + targetW + 'x' + targetH + '.' + ext;
        resultBox.classList.add('show');
        statusMsg.textContent = 'Done! Resized to ' + targetW + '×' + targetH + 'px at ' + dpi + ' DPI.';
        statusMsg.className = 'status success';
        resizeBtn.disabled = false;
      }, mime, quality);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different image.';
      console.error(err);
      resizeBtn.disabled = false;
    }
  });
})();
