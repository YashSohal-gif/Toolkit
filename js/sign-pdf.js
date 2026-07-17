/* Sign PDF — draw or type a signature onto a small canvas, drag it onto
   position over a rendered PDF page preview, then embed the signature
   image into the real PDF at the right coordinates via pdf-lib. */

(function () {
  const dropzone = document.getElementById('dropzoneSign');
  const fileInput = document.getElementById('fileInputSign');
  const signStepLabel2 = document.getElementById('signStepLabel2');
  const signCreateWrap = document.getElementById('signCreateWrap');
  const methodGroup = document.getElementById('signMethodGroup');
  const drawWrap = document.getElementById('signDrawWrap');
  const drawCanvas = document.getElementById('signDrawCanvas');
  const clearBtn = document.getElementById('signClearBtn');
  const typeWrap = document.getElementById('signTypeWrap');
  const typeInput = document.getElementById('signTypeInput');
  const useBtn = document.getElementById('signUseBtn');
  const signStepLabel3 = document.getElementById('signStepLabel3');
  const pageNav = document.getElementById('signPageNav');
  const prevPageBtn = document.getElementById('signPrevPage');
  const nextPageBtn = document.getElementById('signNextPage');
  const pageIndicator = document.getElementById('signPageIndicator');
  const canvasWrap = document.getElementById('signCanvasWrap');
  const pageCanvas = document.getElementById('signPageCanvas');
  const stampImg = document.getElementById('signStamp');
  const hint = document.getElementById('signHint');
  const sizeControls = document.getElementById('signSizeControls');
  const sizeSlider = document.getElementById('signSizeSlider');
  const signStepLabel4 = document.getElementById('signStepLabel4');
  const saveControls = document.getElementById('signSaveControls');
  const saveBtn = document.getElementById('signSaveBtn');
  const statusMsg = document.getElementById('statusMsgSign');
  const resultBox = document.getElementById('resultBoxSign');
  const downloadLink = document.getElementById('downloadLinkSign');
  const progressWrap = document.getElementById('progressWrapSign');
  const progressBar = document.getElementById('progressBarSign');

  if (!dropzone) return;

  const SCALE = 1.3;
  let selectedFile = null;
  let pdfDoc = null;
  let currentPage = 1;
  let methodValue = 'draw';
  let signatureDataUrl = null;
  let stampX = 40, stampY = 40, stampW = 180, stampH = 70;
  let dragging = false, dragOffsetX = 0, dragOffsetY = 0;
  let drawing = false;
  const drawCtx = drawCanvas.getContext('2d');
  drawCtx.lineWidth = 2.5;
  drawCtx.lineCap = 'round';
  drawCtx.strokeStyle = '#111';

  function drawPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx * (drawCanvas.width / rect.width), y: cy * (drawCanvas.height / rect.height) };
  }
  drawCanvas.addEventListener('pointerdown', (e) => { drawing = true; const p = drawPos(e); drawCtx.beginPath(); drawCtx.moveTo(p.x, p.y); });
  drawCanvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = drawPos(e); drawCtx.lineTo(p.x, p.y); drawCtx.stroke(); });
  window.addEventListener('pointerup', () => { drawing = false; });
  clearBtn.addEventListener('click', () => drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height));

  methodGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      methodGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      methodValue = btn.dataset.value;
      drawWrap.style.display = methodValue === 'draw' ? '' : 'none';
      typeWrap.style.display = methodValue === 'type' ? '' : 'none';
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
      return;
    }
    selectedFile = file;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Loading your PDF...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      signStepLabel2.style.display = '';
      signCreateWrap.style.display = '';
      statusMsg.textContent = 'Draw or type your signature, then continue.';
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
    }
  }

  useBtn.addEventListener('click', async () => {
    if (methodValue === 'draw') {
      signatureDataUrl = drawCanvas.toDataURL('image/png');
    } else {
      const name = typeInput.value.trim();
      if (!name) { statusMsg.textContent = 'Please type your name first.'; return; }
      const tmp = document.createElement('canvas');
      tmp.width = 500; tmp.height = 160;
      const tctx = tmp.getContext('2d');
      tctx.font = 'italic 56px "Segoe Script", "Brush Script MT", cursive';
      tctx.fillStyle = '#111';
      tctx.textBaseline = 'middle';
      tctx.fillText(name, 20, 90);
      signatureDataUrl = tmp.toDataURL('image/png');
    }

    signStepLabel3.style.display = '';
    pageNav.style.display = '';
    canvasWrap.style.display = '';
    hint.style.display = '';
    sizeControls.style.display = '';
    signStepLabel4.style.display = '';
    saveControls.style.display = '';
    currentPage = 1;
    await renderCurrentPage();
    stampImg.src = signatureDataUrl;
    stampImg.style.display = '';
    positionStamp();
    statusMsg.textContent = 'Drag your signature into place, resize it, then save.';
  });

  async function renderCurrentPage() {
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: SCALE });
    pageCanvas.width = viewport.width;
    pageCanvas.height = viewport.height;
    const ctx = pageCanvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    pageIndicator.textContent = 'Page ' + currentPage + ' of ' + pdfDoc.numPages;
  }

  function positionStamp() {
    stampImg.style.left = stampX + 'px';
    stampImg.style.top = stampY + 'px';
    stampImg.style.width = stampW + 'px';
    stampImg.style.height = stampH + 'px';
  }

  stampImg.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = canvasWrap.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left - stampX;
    dragOffsetY = e.clientY - rect.top - stampY;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = canvasWrap.getBoundingClientRect();
    stampX = e.clientX - rect.left - dragOffsetX;
    stampY = e.clientY - rect.top - dragOffsetY;
    positionStamp();
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  sizeSlider.addEventListener('input', () => {
    const w = parseInt(sizeSlider.value, 10);
    const ratio = stampH / stampW;
    stampW = w;
    stampH = w * ratio;
    positionStamp();
  });

  prevPageBtn.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; await renderCurrentPage(); } });
  nextPageBtn.addEventListener('click', async () => { if (currentPage < pdfDoc.numPages) { currentPage++; await renderCurrentPage(); } });

  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true;
    adGate.run(pdfDoc.numPages, async () => {
      await runSave();
    }, statusMsg, 'This ' + pdfDoc.numPages + '-page PDF');
  });

  async function runSave() {
    statusMsg.textContent = 'Saving your signed PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pages = doc.getPages();
      const page = pages[currentPage - 1];
      const { height } = page.getSize();

      const pngBytes = await (await fetch(signatureDataUrl)).arrayBuffer();
      const pngImage = await doc.embedPng(pngBytes);

      const pdfX = stampX / SCALE;
      const pdfW = stampW / SCALE;
      const pdfH = stampH / SCALE;
      const pdfY = height - (stampY / SCALE) - pdfH;

      page.drawImage(pngImage, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });

      progressBar.style.width = '80%';
      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-signed.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your signature has been added to page ' + currentPage + '.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while saving your signed PDF. Please try again.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
