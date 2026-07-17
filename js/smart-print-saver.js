/* Smart Print Saver — student-focused N-up print layout tool.
   Lets a student fit multiple original PDF pages onto each printed sheet
   (cutting paper/ink cost), with a configurable border, a black & white or
   inverted-colors mode, a live side-by-side preview before committing, and
   compression on the final output. Runs fully in the browser via pdf.js
   (read) + jsPDF (write) — nothing is uploaded anywhere.
*/
(function () {
  const dropzone = document.getElementById('dropzoneSPS');
  const fileInput = document.getElementById('fileInputSPS');
  const perSheetCards = document.getElementById('perSheetCards');
  const colorModeGroup = document.getElementById('colorModeSPS');
  const marginInput = document.getElementById('marginSPS');
  const qualitySelect = document.getElementById('qualitySPS');
  const generateBtn = document.getElementById('generateBtnSPS');
  const statusMsg = document.getElementById('statusMsgSPS');
  const resultBox = document.getElementById('resultBoxSPS');
  const originalPagesEl = document.getElementById('originalPagesSPS');
  const newSheetsEl = document.getElementById('newSheetsSPS');
  const fileSizeEl = document.getElementById('fileSizeSPS');
  const downloadLink = document.getElementById('downloadLinkSPS');
  const progressWrap = document.getElementById('progressWrapSPS');
  const progressBar = document.getElementById('progressBarSPS');
  const livePreviewWrap = document.getElementById('livePreviewWrap');
  const livePreviewGrid = document.getElementById('livePreviewGrid');
  const previewStatus = document.getElementById('previewStatus');
  const previewStepLabel = document.getElementById('previewStepLabel');

  if (!dropzone) return;

  /* 1-5 pages per sheet, each stacked as full-width horizontal bands
     (1 column, N rows) — page 1 on top, then each next page directly
     below it, all the way down the sheet. */
  const LAYOUTS = {
    1: { cols: 1, rows: 1 },
    2: { cols: 1, rows: 2 },
    3: { cols: 1, rows: 3 },
    4: { cols: 1, rows: 4 },
    5: { cols: 1, rows: 5 }
  };

  const SHEET_W_PT = 595.28; // A4 portrait, points
  const SHEET_H_PT = 841.89;
  const MM_TO_PT = 2.83465;

  let selectedFile = null;
  let pdfDoc = null;
  let previewTimer = null;
  let perSheetValue = 4;
  let colorModeValue = 'color';

  /* Option-card picker (pages per sheet) */
  perSheetCards.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      perSheetCards.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      perSheetValue = parseInt(card.dataset.value, 10);
      scheduleLivePreview();
    });
  });

  /* Segmented toggle (color mode) */
  colorModeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      colorModeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      colorModeValue = btn.dataset.value;
      scheduleLivePreview();
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

  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      statusMsg.className = 'status error';
      return;
    }
    selectedFile = file;
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Reading your PDF...';
    statusMsg.className = 'status';

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      statusMsg.textContent = `Loaded — ${pdfDoc.numPages} pages. Adjust the options below to preview your layout.`;
      statusMsg.className = 'status success';
      livePreviewWrap.style.display = '';
      previewStepLabel.style.display = '';
      scheduleLivePreview();
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      statusMsg.className = 'status error';
      console.error(err);
    }
  }

  function applyColorMode(canvas, mode) {
    if (mode === 'color') return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (mode === 'bw') {
        const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        d[i] = d[i + 1] = d[i + 2] = gray;
      } else if (mode === 'invert') {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  async function renderPageFitted(pageNum, cellWpx, cellHpx) {
    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = Math.min(cellWpx / baseViewport.width, cellHpx / baseViewport.height);
    const viewport = page.getViewport({ scale: fitScale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  async function buildSheetCanvas(sheetStart, perSheet, layout, marginPt, colorMode, scaleFactor) {
    const { cols, rows } = layout;
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = SHEET_W_PT * scaleFactor;
    sheetCanvas.height = SHEET_H_PT * scaleFactor;
    const ctx = sheetCanvas.getContext('2d');
    ctx.fillStyle = colorMode === 'invert' ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const marginPx = marginPt * scaleFactor;
    const cellWpx = ((SHEET_W_PT - marginPt * (cols + 1)) / cols) * scaleFactor;
    const cellHpx = ((SHEET_H_PT - marginPt * (rows + 1)) / rows) * scaleFactor;

    for (let i = 0; i < perSheet; i++) {
      const pageNum = sheetStart + i;
      if (pageNum > pdfDoc.numPages) break;

      const pageCanvas = await renderPageFitted(pageNum, cellWpx, cellHpx);
      applyColorMode(pageCanvas, colorMode);

      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = marginPx + col * (cellWpx + marginPx);
      const cellY = marginPx + row * (cellHpx + marginPx);
      const drawX = cellX + (cellWpx - pageCanvas.width) / 2;
      const drawY = cellY + (cellHpx - pageCanvas.height) / 2;

      ctx.drawImage(pageCanvas, drawX, drawY);
      ctx.strokeStyle = colorMode === 'invert' ? '#444444' : '#d0d5dd';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellWpx, cellHpx);
    }

    return sheetCanvas;
  }

  function scheduleLivePreview() {
    if (!pdfDoc) return;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(runLivePreview, 350);
  }

  async function runLivePreview() {
    if (!pdfDoc) return;
    const perSheet = perSheetValue;
    const marginMm = parseFloat(marginInput.value) || 0;
    const marginPt = marginMm * MM_TO_PT;
    const colorMode = colorModeValue;
    const layout = LAYOUTS[perSheet];
    const totalSheets = Math.ceil(pdfDoc.numPages / perSheet);
    const previewCount = Math.min(3, totalSheets);

    previewStatus.textContent = 'Rendering preview...';
    livePreviewGrid.innerHTML = '';

    try {
      for (let s = 0; s < previewCount; s++) {
        const sheetStart = s * perSheet + 1;
        const canvas = await buildSheetCanvas(sheetStart, perSheet, layout, marginPt, colorMode, 0.6);
        canvas.style.cssText = 'width:150px;height:auto;border:1px solid var(--border);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.08);';
        livePreviewGrid.appendChild(canvas);
      }
      previewStatus.textContent = `Showing sheet 1-${previewCount} of ${totalSheets} total sheets (${pdfDoc.numPages} original pages).`;
      previewStatus.className = 'status';
    } catch (err) {
      previewStatus.textContent = 'Could not render a preview for this configuration.';
      console.error(err);
    }
  }

  marginInput.addEventListener('input', scheduleLivePreview);

  generateBtn.addEventListener('click', () => {
    if (!selectedFile || !pdfDoc) {
      statusMsg.textContent = 'Please choose a PDF first.';
      statusMsg.className = 'status error';
      return;
    }
    const numPages = pdfDoc.numPages;
    adGate.run(numPages, runGeneration, statusMsg, `This ${numPages}-page PDF`);
  });

  async function runGeneration() {
    generateBtn.disabled = true;
    statusMsg.textContent = 'Building your print-saver PDF... this happens in your browser, nothing is uploaded.';
    statusMsg.className = 'status';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    resultBox.classList.remove('show');

    try {
      const perSheet = perSheetValue;
      const marginMm = parseFloat(marginInput.value) || 0;
      const marginPt = marginMm * MM_TO_PT;
      const colorMode = colorModeValue;
      const quality = parseFloat(qualitySelect.value);
      const layout = LAYOUTS[perSheet];
      const numPages = pdfDoc.numPages;

      const { jsPDF } = window.jspdf;
      let doc = null;
      let sheetsCreated = 0;

      for (let sheetStart = 1; sheetStart <= numPages; sheetStart += perSheet) {
        const sheetCanvas = await buildSheetCanvas(sheetStart, perSheet, layout, marginPt, colorMode, 2);
        const imgData = sheetCanvas.toDataURL('image/jpeg', quality);

        if (!doc) {
          doc = new jsPDF({ orientation: 'p', unit: 'pt', format: [SHEET_W_PT, SHEET_H_PT] });
        } else {
          doc.addPage([SHEET_W_PT, SHEET_H_PT], 'p');
        }
        doc.addImage(imgData, 'JPEG', 0, 0, SHEET_W_PT, SHEET_H_PT);
        sheetsCreated++;
        progressBar.style.width = Math.min(100, (sheetStart / numPages) * 100) + '%';
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-smart-print-saver.pdf`;

      originalPagesEl.textContent = numPages + ' pages';
      newSheetsEl.textContent = sheetsCreated + ' sheets';
      fileSizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your print-friendly PDF is ready to download.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different PDF or settings.';
      statusMsg.className = 'status error';
      console.error(err);
    } finally {
      generateBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
