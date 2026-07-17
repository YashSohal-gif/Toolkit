/* Booklet Maker — reorders PDF pages into standard "saddle-stitch" booklet
   imposition (2 pages per sheet side, front + back), so that when the
   printed stack is folded in half and stapled at the spine, pages read in
   the correct order. Runs fully in the browser via pdf.js (read) + jsPDF
   (write) — nothing is uploaded anywhere.
*/
(function () {
  const dropzone = document.getElementById('dropzoneBM');
  const fileInput = document.getElementById('fileInputBM');
  const bookletInfo = document.getElementById('bookletInfo');
  const printerTypeGroup = document.getElementById('printerTypeBM');
  const printerInstructions = document.getElementById('printerInstructionsBM');
  const colorModeGroup = document.getElementById('colorModeBM');
  const generateBtn = document.getElementById('generateBtnBM');
  const statusMsg = document.getElementById('statusMsgBM');
  const resultBox = document.getElementById('resultBoxBM');
  const originalPagesEl = document.getElementById('originalPagesBM');
  const sheetsEl = document.getElementById('sheetsBM');
  const fileSizeEl = document.getElementById('fileSizeBM');
  const downloadLink = document.getElementById('downloadLinkBM');
  const progressWrap = document.getElementById('progressWrapBM');
  const progressBar = document.getElementById('progressBarBM');

  if (!dropzone) return;

  const SHEET_W_PT = 841.89; // A4 landscape (two portrait pages side by side)
  const SHEET_H_PT = 595.28;
  const MARGIN_PT = 14;

  let selectedFile = null;
  let pdfDoc = null;
  let printerType = 'auto';
  let colorMode = 'color';

  const INSTRUCTIONS = {
    auto: `<b>Automatic duplex printer:</b> Open the downloaded PDF, enable "Print on both sides" (duplex) in your print dialog, and set the flip option to <b>"Flip on short edge"</b>. Print the whole file as one job — the front and back of each sheet are already in the right order. Once printed, stack the sheets in page order, fold the whole stack in half together, and staple along the fold.`,
    manual: `<b>Manual duplex (no auto two-sided printing):</b> This file alternates front, back, front, back per sheet. Print the <b>odd</b> pages first (1, 3, 5...) — most print dialogs have a "print odd pages only" option. Then take that stack, flip it over (test with 2 sheets first to find the correct flip direction for your printer), place it back in the tray, and print the <b>even</b> pages (2, 4, 6...). Stack sheets in order, fold in half, and staple along the fold.`,
    single: `<b>Single-sided printing:</b> We'll arrange 2 pages per sheet in simple reading order (not a foldable booklet, since folding needs both sides printed). Just print normally, single-sided — no flipping needed. This still cuts your paper use in half.`
  };

  printerTypeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      printerTypeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      printerType = btn.dataset.value;
      printerInstructions.innerHTML = INSTRUCTIONS[printerType];
    });
  });
  printerInstructions.innerHTML = INSTRUCTIONS[printerType];

  colorModeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      colorModeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      colorMode = btn.dataset.value;
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
      const numPages = pdfDoc.numPages;
      const paddedTotal = Math.ceil(numPages / 4) * 4;
      const blanksAdded = paddedTotal - numPages;
      const sheets = paddedTotal / 4;

      bookletInfo.style.display = '';
      bookletInfo.className = 'status success';
      bookletInfo.textContent = blanksAdded > 0
        ? `Loaded — ${numPages} pages. We'll add ${blanksAdded} blank page(s) to make ${paddedTotal} pages (a multiple of 4), which prints as ${sheets} sheet${sheets > 1 ? 's' : ''}.`
        : `Loaded — ${numPages} pages. This prints as ${sheets} sheet${sheets > 1 ? 's' : ''}.`;

      statusMsg.textContent = 'Choose how you plan to print it below, then generate your booklet.';
      statusMsg.className = 'status';
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
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  async function renderPageFitted(pageNum, cellWpx, cellHpx) {
    if (!pageNum || pageNum < 1 || pageNum > pdfDoc.numPages) return null; // blank
    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = Math.min(cellWpx / baseViewport.width, cellHpx / baseViewport.height);
    const viewport = page.getViewport({ scale: fitScale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    applyColorMode(canvas, colorMode);
    return canvas;
  }

  /* Computes [leftPageNum, rightPageNum] for the front and back of every
     sheet, using the standard saddle-stitch booklet imposition formula. */
  function getBookletSheets(paddedTotal) {
    const sheetCount = paddedTotal / 4;
    const sheets = [];
    for (let s = 0; s < sheetCount; s++) {
      const frontLeft = paddedTotal - s * 2;
      const frontRight = s * 2 + 1;
      const backLeft = s * 2 + 2;
      const backRight = paddedTotal - s * 2 - 1;
      sheets.push({
        front: [frontLeft, frontRight],
        back: [backLeft, backRight]
      });
    }
    return sheets;
  }

  /* Simple sequential 2-up order for single-sided (non-foldable) printing */
  function getSequentialPairs(numPages) {
    const pairs = [];
    for (let i = 1; i <= numPages; i += 2) {
      pairs.push([i, i + 1 <= numPages ? i + 1 : null]);
    }
    return pairs;
  }

  async function buildSpreadCanvas(leftNum, rightNum, scaleFactor) {
    const canvas = document.createElement('canvas');
    canvas.width = SHEET_W_PT * scaleFactor;
    canvas.height = SHEET_H_PT * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const marginPx = MARGIN_PT * scaleFactor;
    const cellWpx = (SHEET_W_PT / 2 - MARGIN_PT * 1.5) * scaleFactor;
    const cellHpx = (SHEET_H_PT - MARGIN_PT * 2) * scaleFactor;

    const positions = [
      { num: leftNum, x: marginPx },
      { num: rightNum, x: canvas.width / 2 + marginPx / 2 }
    ];

    for (const pos of positions) {
      const pageCanvas = await renderPageFitted(pos.num, cellWpx, cellHpx);
      if (!pageCanvas) continue;
      const drawX = pos.x + (cellWpx - pageCanvas.width) / 2;
      const drawY = marginPx + (cellHpx - pageCanvas.height) / 2;
      ctx.drawImage(pageCanvas, drawX, drawY);
    }

    // spine/fold guide line at center
    ctx.strokeStyle = '#d0d5dd';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    return canvas;
  }

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
    statusMsg.textContent = 'Building your booklet PDF... this happens in your browser, nothing is uploaded.';
    statusMsg.className = 'status';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    resultBox.classList.remove('show');

    try {
      const numPages = pdfDoc.numPages;
      const { jsPDF } = window.jspdf;
      let doc = null;
      let sheetsPrinted = 0;

      if (printerType === 'single') {
        const pairs = getSequentialPairs(numPages);
        for (let i = 0; i < pairs.length; i++) {
          const [left, right] = pairs[i];
          const canvas = await buildSpreadCanvas(left, right, 2);
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          if (!doc) {
            doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [SHEET_W_PT, SHEET_H_PT] });
          } else {
            doc.addPage([SHEET_W_PT, SHEET_H_PT], 'l');
          }
          doc.addImage(imgData, 'JPEG', 0, 0, SHEET_W_PT, SHEET_H_PT);
          sheetsPrinted++;
          progressBar.style.width = Math.min(100, ((i + 1) / pairs.length) * 100) + '%';
        }
      } else {
        const paddedTotal = Math.ceil(numPages / 4) * 4;
        const sheets = getBookletSheets(paddedTotal);
        for (let i = 0; i < sheets.length; i++) {
          const sheet = sheets[i];
          const frontCanvas = await buildSpreadCanvas(sheet.front[0], sheet.front[1], 2);
          const frontImg = frontCanvas.toDataURL('image/jpeg', 0.85);
          if (!doc) {
            doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [SHEET_W_PT, SHEET_H_PT] });
          } else {
            doc.addPage([SHEET_W_PT, SHEET_H_PT], 'l');
          }
          doc.addImage(frontImg, 'JPEG', 0, 0, SHEET_W_PT, SHEET_H_PT);

          const backCanvas = await buildSpreadCanvas(sheet.back[0], sheet.back[1], 2);
          const backImg = backCanvas.toDataURL('image/jpeg', 0.85);
          doc.addPage([SHEET_W_PT, SHEET_H_PT], 'l');
          doc.addImage(backImg, 'JPEG', 0, 0, SHEET_W_PT, SHEET_H_PT);

          sheetsPrinted++;
          progressBar.style.width = Math.min(100, ((i + 1) / sheets.length) * 100) + '%';
        }
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-booklet.pdf`;

      originalPagesEl.textContent = numPages + ' pages';
      sheetsEl.textContent = sheetsPrinted + ' sheet' + (sheetsPrinted > 1 ? 's' : '');
      fileSizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Follow the printing instructions above for the best result.';
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
