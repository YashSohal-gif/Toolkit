/* Scan to PDF — capture photos via camera (getUserMedia) or file upload,
   review/reorder them as page thumbnails, then combine into one PDF
   (one image per page) via jsPDF. Nothing leaves the browser.

   Camera mode adds a draggable crop-grid overlay (only the boxed area is
   captured) and a document filter (Auto Enhance / B&W / Grayscale) that's
   applied automatically to every page, whether captured or uploaded. */

(function () {
  const cameraBtn = document.getElementById('cameraBtnScan');
  const uploadBtn = document.getElementById('uploadBtnScan');
  const fileInput = document.getElementById('fileInputScan');
  const cameraWrap = document.getElementById('cameraWrapScan');
  const stage = document.getElementById('scanCameraStage');
  const video = document.getElementById('cameraVideoScan');
  const cropGuide = document.getElementById('scanCropGuide');
  const captureBtn = document.getElementById('captureBtnScan');
  const closeCameraBtn = document.getElementById('closeCameraBtnScan');
  const captureCanvas = document.getElementById('captureCanvasScan');
  const filterGroup = document.getElementById('scanFilterGroup');
  const pageListEl = document.getElementById('scanPageList');
  const saveBtn = document.getElementById('scanSaveBtn');
  const statusMsg = document.getElementById('statusMsgScan');
  const resultBox = document.getElementById('resultBoxScan');
  const downloadLink = document.getElementById('downloadLinkScan');
  const progressWrap = document.getElementById('progressWrapScan');
  const progressBar = document.getElementById('progressBarScan');

  if (!cameraBtn) return;

  let pages = []; // { file, thumbUrl, keep }
  let stream = null;
  let filterMode = 'color';

  // =========================================================================
  // Document filter engine — grayscale, auto-enhance (percentile contrast
  // stretch), and B&W (Otsu global threshold). Built on a single grayscale +
  // histogram pass so it stays fast even on full camera-resolution photos.
  // =========================================================================
  function computeGrayAndHistogram(imgData) {
    const d = imgData.data;
    const gray = new Uint8ClampedArray(d.length / 4);
    const hist = new Array(256).fill(0);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
      gray[j] = g;
      hist[g]++;
    }
    return { gray, hist };
  }

  function percentileFromHistogram(hist, total, pct) {
    const target = total * pct;
    let cum = 0;
    for (let t = 0; t < 256; t++) {
      cum += hist[t];
      if (cum >= target) return t;
    }
    return 255;
  }

  /* Otsu's method: finds the gray-level threshold that best separates the
     image into two classes (ink vs. paper) by maximizing between-class variance. */
  function otsuThreshold(hist, total) {
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = -1, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > maxVar) { maxVar = varBetween; threshold = t; }
    }
    return threshold;
  }

  function applyScanFilter(canvas, mode) {
    if (mode === 'color') return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const { gray, hist } = computeGrayAndHistogram(imgData);
    const total = gray.length;

    if (mode === 'gray') {
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        d[i] = d[i + 1] = d[i + 2] = gray[j];
      }
    } else if (mode === 'enhance') {
      const lo = percentileFromHistogram(hist, total, 0.01);
      const hi = Math.max(lo + 1, percentileFromHistogram(hist, total, 0.99));
      const range = hi - lo;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const v = Math.max(0, Math.min(255, ((gray[j] - lo) * 255) / range));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    } else if (mode === 'bw') {
      const threshold = otsuThreshold(hist, total);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const v = gray[j] > threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  if (filterGroup) {
    filterGroup.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filterMode = btn.dataset.value;
      });
    });
  }

  /* Re-encode an already-added image file through the filter (used for
     uploads, which skip the crop guide but still get the chosen filter). */
  function filterImageFile(file, mode) {
    return new Promise((resolve, reject) => {
      if (mode === 'color') { resolve(file); return; }
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 2400;
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const scale = MAX_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        applyScanFilter(c, mode);
        c.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.92);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  async function addFiles(fileListObj) {
    const incoming = Array.from(fileListObj).filter((f) => f.type.startsWith('image/'));
    for (const f of incoming) {
      const processed = await filterImageFile(f, filterMode);
      const url = URL.createObjectURL(processed);
      pages.push({ file: processed, thumbUrl: url, keep: true });
    }
    renderPageList();
    statusMsg.textContent = pages.length + ' page(s) added. Reorder or remove below, then combine.';
  }

  // =========================================================================
  // Camera + crop-guide
  // =========================================================================
  cameraBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      cameraWrap.style.display = '';
      video.onloadedmetadata = () => {
        video.play();
        sizeStageToVideo();
        resetCropGuide();
      };
    } catch (err) {
      statusMsg.textContent = 'Could not access your camera. You can still upload photos instead.';
      console.error(err);
    }
  });

  /* Size the stage box to the video's real aspect ratio (rather than letting
     CSS letterbox/crop it) so the crop guide's on-screen percentage always
     maps 1:1 to actual video pixels. */
  function sizeStageToVideo() {
    if (!video.videoWidth || !video.videoHeight) return;
    const maxW = Math.min(520, stage.parentElement.clientWidth || 520);
    const aspect = video.videoWidth / video.videoHeight;
    stage.style.width = maxW + 'px';
    stage.style.height = Math.round(maxW / aspect) + 'px';
  }
  window.addEventListener('resize', sizeStageToVideo);

  function resetCropGuide() {
    const rect = stage.getBoundingClientRect();
    const insetX = rect.width * 0.08;
    const insetY = rect.height * 0.08;
    cropGuide.style.left = insetX + 'px';
    cropGuide.style.top = insetY + 'px';
    cropGuide.style.width = (rect.width - insetX * 2) + 'px';
    cropGuide.style.height = (rect.height - insetY * 2) + 'px';
  }

  const MIN_GUIDE_SIZE = 60;

  function guideBox() {
    return {
      left: parseFloat(cropGuide.style.left) || 0,
      top: parseFloat(cropGuide.style.top) || 0,
      width: parseFloat(cropGuide.style.width) || 0,
      height: parseFloat(cropGuide.style.height) || 0
    };
  }

  function setGuideBox(box) {
    cropGuide.style.left = box.left + 'px';
    cropGuide.style.top = box.top + 'px';
    cropGuide.style.width = box.width + 'px';
    cropGuide.style.height = box.height + 'px';
  }

  /* Drag the whole box to move it */
  cropGuide.addEventListener('pointerdown', (e) => {
    if (e.target !== cropGuide) return; // handles manage their own drag
    e.preventDefault();
    const stageRect = stage.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, box: guideBox() };
    function onMove(ev) {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let left = start.box.left + dx;
      let top = start.box.top + dy;
      left = Math.max(0, Math.min(stageRect.width - start.box.width, left));
      top = Math.max(0, Math.min(stageRect.height - start.box.height, top));
      setGuideBox({ left, top, width: start.box.width, height: start.box.height });
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  /* Drag a corner handle to resize from that corner */
  cropGuide.querySelectorAll('.scan-crop-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const corner = handle.dataset.handle;
      const stageRect = stage.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, box: guideBox() };

      function onMove(ev) {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        let { left, top, width, height } = start.box;

        if (corner.includes('l')) { left = start.box.left + dx; width = start.box.width - dx; }
        if (corner.includes('r')) { width = start.box.width + dx; }
        if (corner.includes('t')) { top = start.box.top + dy; height = start.box.height - dy; }
        if (corner.includes('b')) { height = start.box.height + dy; }

        if (width < MIN_GUIDE_SIZE) { if (corner.includes('l')) left = start.box.left + start.box.width - MIN_GUIDE_SIZE; width = MIN_GUIDE_SIZE; }
        if (height < MIN_GUIDE_SIZE) { if (corner.includes('t')) top = start.box.top + start.box.height - MIN_GUIDE_SIZE; height = MIN_GUIDE_SIZE; }
        left = Math.max(0, left);
        top = Math.max(0, top);
        width = Math.min(width, stageRect.width - left);
        height = Math.min(height, stageRect.height - top);

        setGuideBox({ left, top, width, height });
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  });

  closeCameraBtn.addEventListener('click', stopCamera);

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    cameraWrap.style.display = 'none';
  }

  captureBtn.addEventListener('click', () => {
    if (!video.videoWidth) return;

    const stageRect = stage.getBoundingClientRect();
    const box = guideBox();
    const scaleX = video.videoWidth / stageRect.width;
    const scaleY = video.videoHeight / stageRect.height;
    const sx = box.left * scaleX;
    const sy = box.top * scaleY;
    const sw = box.width * scaleX;
    const sh = box.height * scaleY;

    captureCanvas.width = sw;
    captureCanvas.height = sh;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    applyScanFilter(captureCanvas, filterMode);

    captureCanvas.toBlob((blob) => {
      const file = new File([blob], 'scan-' + (pages.length + 1) + '.jpg', { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      pages.push({ file, thumbUrl: url, keep: true });
      renderPageList();
      statusMsg.textContent = pages.length + ' page(s) captured so far.';
    }, 'image/jpeg', 0.9);
  });

  // =========================================================================
  // Page list + PDF assembly (unchanged from before)
  // =========================================================================
  function renderPageList() {
    pageListEl.innerHTML = '';
    pages.forEach((pg, idx) => {
      const item = document.createElement('div');
      item.className = 'org-page-item' + (pg.keep ? '' : ' removed');
      item.innerHTML =
        '<img src="' + pg.thumbUrl + '" alt="Page ' + (idx + 1) + '">' +
        '<div class="org-page-label">Page ' + (idx + 1) + '</div>' +
        '<div class="org-page-controls">' +
          '<button class="org-btn" data-action="up" title="Move up">↑</button>' +
          '<button class="org-btn" data-action="down" title="Move down">↓</button>' +
          '<label class="org-keep"><input type="checkbox" data-action="keep" ' + (pg.keep ? 'checked' : '') + '> Keep</label>' +
        '</div>';
      item.querySelector('[data-action="up"]').addEventListener('click', () => {
        if (idx > 0) { [pages[idx - 1], pages[idx]] = [pages[idx], pages[idx - 1]]; renderPageList(); }
      });
      item.querySelector('[data-action="down"]').addEventListener('click', () => {
        if (idx < pages.length - 1) { [pages[idx + 1], pages[idx]] = [pages[idx], pages[idx + 1]]; renderPageList(); }
      });
      item.querySelector('[data-action="keep"]').addEventListener('change', (e) => {
        pages[idx].keep = e.target.checked;
      });
      pageListEl.appendChild(item);
    });
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  saveBtn.addEventListener('click', () => {
    const keptPages = pages.filter((p) => p.keep);
    if (keptPages.length === 0) {
      statusMsg.textContent = 'Please add and keep at least 1 page.';
      return;
    }
    saveBtn.disabled = true;
    adGate.run(keptPages.length, async () => {
      await runBuild(keptPages);
    }, statusMsg, 'This ' + keptPages.length + '-page scan');
  });

  async function runBuild(keptPages) {
    stopCamera();
    statusMsg.textContent = 'Building your PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const { jsPDF } = window.jspdf;
      let doc = null;

      for (let i = 0; i < keptPages.length; i++) {
        const img = await loadImage(keptPages[i].file);
        const widthPt = img.width * 0.75;
        const heightPt = img.height * 0.75;
        const orientation = widthPt > heightPt ? 'l' : 'p';

        if (i === 0) {
          doc = new jsPDF({ orientation, unit: 'pt', format: [widthPt, heightPt] });
        } else {
          doc.addPage([widthPt, heightPt], orientation);
        }
        doc.addImage(img, 'JPEG', 0, 0, widthPt, heightPt);
        progressBar.style.width = (((i + 1) / keptPages.length) * 100) + '%';
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'scanned-document.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! ' + keptPages.length + ' page(s) combined into one PDF.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try again.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
