/* Redact PDF — draw black boxes over sensitive regions on a preview
   canvas, then rebuild the entire PDF as flattened page images (with
   the black boxes baked permanently into the pixels) via jsPDF, so the
   text/graphics underneath a redaction can never be recovered. */

(function () {
  const dropzone = document.getElementById('dropzoneRedact');
  const fileInput = document.getElementById('fileInputRedact');
  const redactStepLabel = document.getElementById('redactStepLabel');
  const pageNav = document.getElementById('redactPageNav');
  const prevPageBtn = document.getElementById('redactPrevPage');
  const nextPageBtn = document.getElementById('redactNextPage');
  const pageIndicator = document.getElementById('redactPageIndicator');
  const undoBtn = document.getElementById('redactUndoBtn');
  const canvasWrap = document.getElementById('redactCanvasWrap');
  const canvas = document.getElementById('redactCanvas');
  const overlay = document.getElementById('redactOverlay');
  const redactSaveLabel = document.getElementById('redactSaveLabel');
  const saveControls = document.getElementById('redactSaveControls');
  const saveBtn = document.getElementById('redactSaveBtn');
  const statusMsg = document.getElementById('statusMsgRedact');
  const resultBox = document.getElementById('resultBoxRedact');
  const downloadLink = document.getElementById('downloadLinkRedact');
  const progressWrap = document.getElementById('progressWrapRedact');
  const progressBar = document.getElementById('progressBarRedact');

  if (!dropzone) return;

  const PREVIEW_SCALE = 1.3;
  const OUTPUT_SCALE = 2;
  let selectedFile = null;
  let pdfDoc = null;
  let currentPage = 1;
  let boxesByPage = {}; // { pageNum: [ {x,y,w,h} in preview canvas-px ] }
  let dragStart = null;
  let dragEl = null;

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
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Loading your PDF...';
    boxesByPage = {};
    currentPage = 1;

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      redactStepLabel.style.display = '';
      pageNav.style.display = '';
      canvasWrap.style.display = '';
      redactSaveLabel.style.display = '';
      saveControls.style.display = '';
      statusMsg.textContent = 'Click and drag to draw black boxes over sensitive areas.';
      await renderCurrentPage();
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
    }
  }

  async function renderCurrentPage() {
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: PREVIEW_SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    pageIndicator.textContent = 'Page ' + currentPage + ' of ' + pdfDoc.numPages;
    redrawOverlay();
  }

  function redrawOverlay() {
    overlay.innerHTML = '';
    const boxes = boxesByPage[currentPage] || [];
    boxes.forEach((b) => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';
      el.style.width = b.w + 'px';
      el.style.height = b.h + 'px';
      el.style.background = '#000';
      overlay.appendChild(el);
    });
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  overlay.style.pointerEvents = 'auto';
  overlay.addEventListener('mousedown', (e) => {
    dragStart = canvasPoint(e);
    dragEl = document.createElement('div');
    dragEl.style.position = 'absolute';
    dragEl.style.left = dragStart.x + 'px';
    dragEl.style.top = dragStart.y + 'px';
    dragEl.style.border = '2px dashed #000';
    overlay.appendChild(dragEl);
  });
  overlay.addEventListener('mousemove', (e) => {
    if (!dragStart || !dragEl) return;
    const pt = canvasPoint(e);
    const x = Math.min(pt.x, dragStart.x);
    const y = Math.min(pt.y, dragStart.y);
    const w = Math.abs(pt.x - dragStart.x);
    const h = Math.abs(pt.y - dragStart.y);
    dragEl.style.left = x + 'px';
    dragEl.style.top = y + 'px';
    dragEl.style.width = w + 'px';
    dragEl.style.height = h + 'px';
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragStart || !dragEl) return;
    const pt = canvasPoint(e);
    const x = Math.min(pt.x, dragStart.x);
    const y = Math.min(pt.y, dragStart.y);
    const w = Math.abs(pt.x - dragStart.x);
    const h = Math.abs(pt.y - dragStart.y);
    dragStart = null;
    dragEl = null;
    if (w > 3 && h > 3) {
      if (!boxesByPage[currentPage]) boxesByPage[currentPage] = [];
      boxesByPage[currentPage].push({ x, y, w, h });
    }
    redrawOverlay();
  });

  prevPageBtn.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; await renderCurrentPage(); } });
  nextPageBtn.addEventListener('click', async () => { if (currentPage < pdfDoc.numPages) { currentPage++; await renderCurrentPage(); } });
  undoBtn.addEventListener('click', () => {
    const boxes = boxesByPage[currentPage];
    if (boxes && boxes.length) { boxes.pop(); redrawOverlay(); }
  });

  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true;
    adGate.run(pdfDoc.numPages, async () => {
      await runSave();
    }, statusMsg, 'This ' + pdfDoc.numPages + '-page PDF');
  });

  async function runSave() {
    statusMsg.textContent = 'Flattening and redacting your PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const { jsPDF } = window.jspdf;
      let doc = null;
      const numPages = pdfDoc.numPages;
      const scaleRatio = OUTPUT_SCALE / PREVIEW_SCALE;

      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: OUTPUT_SCALE });
        const outCanvas = document.createElement('canvas');
        outCanvas.width = viewport.width;
        outCanvas.height = viewport.height;
        const ctx = outCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const boxes = boxesByPage[p] || [];
        ctx.fillStyle = '#000';
        boxes.forEach((b) => {
          ctx.fillRect(b.x * scaleRatio, b.y * scaleRatio, b.w * scaleRatio, b.h * scaleRatio);
        });

        const imgData = outCanvas.toDataURL('image/jpeg', 0.92);
        const widthPt = viewport.width * 0.5;
        const heightPt = viewport.height * 0.5;
        const orientation = widthPt > heightPt ? 'l' : 'p';

        if (p === 1) {
          doc = new jsPDF({ orientation, unit: 'pt', format: [widthPt, heightPt] });
        } else {
          doc.addPage([widthPt, heightPt], orientation);
        }
        doc.addImage(imgData, 'JPEG', 0, 0, widthPt, heightPt);
        progressBar.style.width = ((p / numPages) * 100) + '%';
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-redacted.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your redacted PDF is ready — covered content has been permanently removed.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while redacting this PDF. Please try again.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
