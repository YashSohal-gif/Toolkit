/* Print-Saver — fit multiple original PDF pages onto each printed sheet.
   Great for cutting the paper/ink cost of printing long lecture notes/PDFs:
   e.g. a 50-page PDF at 12-per-sheet becomes about 5 printed sheets.
   Content is not summarized or reworded — pages are simply shrunk and
   arranged in a grid, exactly as they'd look printed "N-up".
   Runs fully in the browser via pdf.js (read) + jsPDF (write).
*/

(function () {
  const dropzone = document.getElementById('dropzonePrint');
  const fileInput = document.getElementById('fileInputPrint');
  const perSheetGroup = document.getElementById('perSheet');
  let perSheetValue = 4;
  const compressBtn = document.getElementById('printSaverBtn');
  const statusMsg = document.getElementById('statusMsgPrint');
  const resultBox = document.getElementById('resultBoxPrint');
  const originalPagesEl = document.getElementById('originalPages');
  const newPagesEl = document.getElementById('newPages');
  const downloadLink = document.getElementById('downloadLinkPrint');
  const progressWrap = document.getElementById('progressWrapPrint');
  const progressBar = document.getElementById('progressBarPrint');

  if (!dropzone) return;

  if (perSheetGroup) {
    perSheetGroup.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        perSheetGroup.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        perSheetValue = parseInt(card.dataset.value, 10);
      });
    });
  }

  let selectedFile = null;

  const LAYOUTS = {
    2: { cols: 1, rows: 2 },
    4: { cols: 2, rows: 2 },
    6: { cols: 2, rows: 3 },
    9: { cols: 3, rows: 3 },
    12: { cols: 3, rows: 4 },
    16: { cols: 4, rows: 4 },
  };

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
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
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  async function buildPrintSaverPdf(pdf, perSheet, onProgress) {
    const numPages = pdf.numPages;
    const { cols, rows } = LAYOUTS[perSheet];

    const sheetWidthPt = 595.28; // A4 portrait, points
    const sheetHeightPt = 841.89;
    const marginPt = 10;
    const scaleFactor = 2; // render at 2x for print sharpness

    const cellWpx = ((sheetWidthPt - marginPt * (cols + 1)) / cols) * scaleFactor;
    const cellHpx = ((sheetHeightPt - marginPt * (rows + 1)) / rows) * scaleFactor;
    const marginPx = marginPt * scaleFactor;

    const { jsPDF } = window.jspdf;
    let doc = null;
    let sheetsCreated = 0;

    for (let sheetStart = 1; sheetStart <= numPages; sheetStart += perSheet) {
      const sheetCanvas = document.createElement('canvas');
      sheetCanvas.width = sheetWidthPt * scaleFactor;
      sheetCanvas.height = sheetHeightPt * scaleFactor;
      const ctx = sheetCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

      for (let i = 0; i < perSheet; i++) {
        const pageNum = sheetStart + i;
        if (pageNum > numPages) break;

        const page = await pdf.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(cellWpx / baseViewport.width, cellHpx / baseViewport.height);
        const viewport = page.getViewport({ scale: fitScale });

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        const pctx = pageCanvas.getContext('2d');
        await page.render({ canvasContext: pctx, viewport }).promise;

        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = marginPx + col * (cellWpx + marginPx);
        const cellY = marginPx + row * (cellHpx + marginPx);
        const drawX = cellX + (cellWpx - pageCanvas.width) / 2;
        const drawY = cellY + (cellHpx - pageCanvas.height) / 2;

        ctx.drawImage(pageCanvas, drawX, drawY);
        ctx.strokeStyle = '#d0d5dd';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, cellWpx, cellHpx);
      }

      const imgData = sheetCanvas.toDataURL('image/jpeg', 0.85);
      if (!doc) {
        doc = new jsPDF({ orientation: 'p', unit: 'pt', format: [sheetWidthPt, sheetHeightPt] });
      } else {
        doc.addPage([sheetWidthPt, sheetHeightPt], 'p');
      }
      doc.addImage(imgData, 'JPEG', 0, 0, sheetWidthPt, sheetHeightPt);
      sheetsCreated++;
      onProgress(Math.min(100, (sheetStart / numPages) * 100));
    }

    return { blob: doc.output('blob'), sheetsCreated };
  }

  compressBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    const perSheet = perSheetValue;

    compressBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runLayout(pdf, perSheet, numPages);
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      compressBtn.disabled = false;
    }
  });

  async function runLayout(pdf, perSheet, numPages) {
    statusMsg.textContent = 'Building your print-saver layout... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const { blob, sheetsCreated } = await buildPrintSaverPdf(pdf, perSheet, (pct) => {
        progressBar.style.width = pct + '%';
      });

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-print-saver.pdf`;

      originalPagesEl.textContent = numPages + ' pages';
      newPagesEl.textContent = sheetsCreated + ' sheets';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your print-friendly PDF is ready to download.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different PDF.';
      console.error(err);
    } finally {
      compressBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
