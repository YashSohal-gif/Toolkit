/* Edit PDF — click-to-add text boxes, rectangles, and highlights onto
   rendered PDF pages (pdf.js for preview), then bake every edit
   permanently into the real PDF via pdf-lib coordinates. */

(function () {
  const dropzone = document.getElementById('dropzoneEdit');
  const fileInput = document.getElementById('fileInputEdit');
  const editStepLabel = document.getElementById('editStepLabel');
  const editToolField = document.getElementById('editToolField');
  const editToolGroup = document.getElementById('editToolGroup');
  const editPageNav = document.getElementById('editPageNav');
  const prevPageBtn = document.getElementById('editPrevPage');
  const nextPageBtn = document.getElementById('editNextPage');
  const pageIndicator = document.getElementById('editPageIndicator');
  const undoBtn = document.getElementById('editUndoBtn');
  const canvasWrap = document.getElementById('editCanvasWrap');
  const canvas = document.getElementById('editCanvas');
  const overlay = document.getElementById('editOverlay');
  const editSaveLabel = document.getElementById('editSaveLabel');
  const editSaveControls = document.getElementById('editSaveControls');
  const saveBtn = document.getElementById('editSaveBtn');
  const statusMsg = document.getElementById('statusMsgEdit');
  const resultBox = document.getElementById('resultBoxEdit');
  const downloadLink = document.getElementById('downloadLinkEdit');
  const progressWrap = document.getElementById('progressWrapEdit');
  const progressBar = document.getElementById('progressBarEdit');

  if (!dropzone) return;

  const SCALE = 1.3;
  let selectedFile = null;
  let pdfDoc = null;
  let currentPage = 1;
  let toolValue = 'text';
  let editsByPage = {}; // { pageNum: [ {type,x,y,w,h,text} in canvas-px ] }
  let dragStart = null;
  let dragEl = null;

  editToolGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      editToolGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      toolValue = btn.dataset.value;
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
    editsByPage = {};
    currentPage = 1;

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      editStepLabel.style.display = '';
      editToolField.style.display = '';
      editPageNav.style.display = '';
      canvasWrap.style.display = '';
      editSaveLabel.style.display = '';
      editSaveControls.style.display = '';
      statusMsg.textContent = 'Pick a tool, then click (or click-drag) on the page.';
      await renderCurrentPage();
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
    }
  }

  async function renderCurrentPage() {
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: SCALE });
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
    const edits = editsByPage[currentPage] || [];
    edits.forEach((ed) => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = ed.x + 'px';
      el.style.top = ed.y + 'px';
      if (ed.type === 'text') {
        el.textContent = ed.text;
        el.style.color = '#111';
        el.style.fontSize = '16px';
        el.style.fontWeight = '600';
        el.style.fontFamily = 'Helvetica, Arial, sans-serif';
      } else if (ed.type === 'rect') {
        el.style.width = ed.w + 'px';
        el.style.height = ed.h + 'px';
        el.style.border = '2px solid #dc2626';
      } else if (ed.type === 'highlight') {
        el.style.width = ed.w + 'px';
        el.style.height = ed.h + 'px';
        el.style.background = 'rgba(250, 204, 21, 0.45)';
      }
      overlay.appendChild(el);
    });
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  overlay.style.pointerEvents = 'auto';
  overlay.addEventListener('mousedown', (e) => {
    const pt = canvasPoint(e);
    if (toolValue === 'text') {
      const text = prompt('Text to add:');
      if (text) {
        if (!editsByPage[currentPage]) editsByPage[currentPage] = [];
        editsByPage[currentPage].push({ type: 'text', x: pt.x, y: pt.y, text });
        redrawOverlay();
      }
      return;
    }
    dragStart = pt;
    dragEl = document.createElement('div');
    dragEl.style.position = 'absolute';
    dragEl.style.left = pt.x + 'px';
    dragEl.style.top = pt.y + 'px';
    dragEl.style.border = toolValue === 'rect' ? '2px dashed #dc2626' : '2px dashed #ca8a04';
    if (toolValue === 'highlight') dragEl.style.background = 'rgba(250, 204, 21, 0.35)';
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
      if (!editsByPage[currentPage]) editsByPage[currentPage] = [];
      editsByPage[currentPage].push({ type: toolValue, x, y, w, h });
    }
    redrawOverlay();
  });

  prevPageBtn.addEventListener('click', async () => {
    if (currentPage > 1) { currentPage--; await renderCurrentPage(); }
  });
  nextPageBtn.addEventListener('click', async () => {
    if (currentPage < pdfDoc.numPages) { currentPage++; await renderCurrentPage(); }
  });
  undoBtn.addEventListener('click', () => {
    const edits = editsByPage[currentPage];
    if (edits && edits.length) { edits.pop(); redrawOverlay(); }
  });

  saveBtn.addEventListener('click', () => {
    const totalEdits = Object.values(editsByPage).reduce((sum, arr) => sum + arr.length, 0);
    if (totalEdits === 0) {
      statusMsg.textContent = 'Add at least one text box, rectangle, or highlight first.';
      return;
    }
    saveBtn.disabled = true;
    adGate.run(pdfDoc.numPages, async () => {
      await runSave();
    }, statusMsg, 'This ' + pdfDoc.numPages + '-page PDF');
  });

  async function runSave() {
    statusMsg.textContent = 'Saving your edits into the PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const outDoc = await PDFDocument.load(bytes);
      const font = await outDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = outDoc.getPages();

      Object.keys(editsByPage).forEach((pageNumStr) => {
        const pageNum = parseInt(pageNumStr, 10);
        const page = pages[pageNum - 1];
        if (!page) return;
        const { height } = page.getSize();

        editsByPage[pageNum].forEach((ed) => {
          const pdfX = ed.x / SCALE;
          if (ed.type === 'text') {
            const pdfY = height - (ed.y / SCALE) - 14;
            page.drawText(ed.text, { x: pdfX, y: pdfY, size: 14, font, color: rgb(0.07, 0.07, 0.07) });
          } else if (ed.type === 'rect') {
            const pdfY = height - (ed.y / SCALE) - (ed.h / SCALE);
            page.drawRectangle({ x: pdfX, y: pdfY, width: ed.w / SCALE, height: ed.h / SCALE, borderColor: rgb(0.86, 0.15, 0.15), borderWidth: 2 });
          } else if (ed.type === 'highlight') {
            const pdfY = height - (ed.y / SCALE) - (ed.h / SCALE);
            page.drawRectangle({ x: pdfX, y: pdfY, width: ed.w / SCALE, height: ed.h / SCALE, color: rgb(0.98, 0.8, 0.08), opacity: 0.45 });
          }
        });
      });

      progressBar.style.width = '90%';
      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-edited.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your edits have been saved into the PDF.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while saving your edits. Please try again.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
