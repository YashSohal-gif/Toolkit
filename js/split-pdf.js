/* Split PDF — extract a page range into one PDF, or split every page into
   its own PDF (delivered as a ZIP). Uses pdf-lib to keep original quality. */

(function () {
  const dropzone = document.getElementById('dropzoneSplit');
  const fileInput = document.getElementById('fileInputSplit');
  const splitModeGroup = document.getElementById('splitModeGroup');
  let splitModeValue = 'range';
  const rangeField = document.getElementById('rangeField');
  const rangeInput = document.getElementById('rangeInput');
  const splitBtn = document.getElementById('splitBtn');
  const statusMsg = document.getElementById('statusMsgSplit');
  const resultBox = document.getElementById('resultBoxSplit');
  const downloadLink = document.getElementById('downloadLinkSplit');
  const progressWrap = document.getElementById('progressWrapSplit');
  const progressBar = document.getElementById('progressBarSplit');

  if (!dropzone) return;

  let selectedFile = null;

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

  const chunkField = document.getElementById('chunkField');
  const chunkSizeInput = document.getElementById('chunkSize');
  const invertToggle = document.getElementById('splitInvert');

  if (splitModeGroup) {
    splitModeGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        splitModeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        splitModeValue = btn.dataset.value;
        rangeField.style.display = splitModeValue === 'range' ? 'flex' : 'none';
        if (chunkField) chunkField.style.display = splitModeValue === 'chunk' ? 'flex' : 'none';
      });
    });
  }

  function getMode() {
    return splitModeValue;
  }

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

  function parseRange(rangeStr, maxPage) {
    // "1-3,5,7-9" -> [0,1,2,4,6,7,8] (0-indexed)
    const indices = new Set();
    const parts = rangeStr.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n, 10));
        for (let p = start; p <= end; p++) {
          if (p >= 1 && p <= maxPage) indices.add(p - 1);
        }
      } else {
        const p = parseInt(part, 10);
        if (p >= 1 && p <= maxPage) indices.add(p - 1);
      }
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  async function splitRange(pdf, PDFDocument, rangeStr) {
    const maxPage = pdf.getPageCount();
    let indices = parseRange(rangeStr, maxPage);
    if (indices.length === 0) throw new Error('No valid pages in that range.');

    /* "Remove these pages instead": keep everything NOT in the range */
    if (invertToggle && invertToggle.checked) {
      const excluded = new Set(indices);
      indices = [];
      for (let i = 0; i < maxPage; i++) if (!excluded.has(i)) indices.push(i);
      if (indices.length === 0) throw new Error('That would remove every page — nothing left to keep.');
    }

    const outDoc = await PDFDocument.create();
    const copied = await outDoc.copyPages(pdf, indices);
    copied.forEach((p) => outDoc.addPage(p));
    const bytes = await outDoc.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'split-pages.pdf', pageCount: indices.length };
  }

  /* Split into fixed-size chunks: pages 1-N, N+1-2N, ... each as its own PDF */
  async function splitChunks(pdf, PDFDocument, chunkSize, onProgress) {
    const zip = new JSZip();
    const maxPage = pdf.getPageCount();
    const size = Math.max(1, chunkSize);
    let fileCount = 0;

    for (let start = 0; start < maxPage; start += size) {
      const indices = [];
      for (let i = start; i < Math.min(start + size, maxPage); i++) indices.push(i);
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(pdf, indices);
      copied.forEach((p) => outDoc.addPage(p));
      const bytes = await outDoc.save();
      fileCount++;
      zip.file(`part-${fileCount}-pages-${start + 1}-${Math.min(start + size, maxPage)}.pdf`, bytes);
      onProgress((Math.min(start + size, maxPage) / maxPage) * 90);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, filename: 'split-parts.zip', pageCount: maxPage };
  }

  async function splitAllPages(pdf, PDFDocument, onProgress) {
    const zip = new JSZip();
    const maxPage = pdf.getPageCount();

    for (let i = 0; i < maxPage; i++) {
      const outDoc = await PDFDocument.create();
      const [copied] = await outDoc.copyPages(pdf, [i]);
      outDoc.addPage(copied);
      const bytes = await outDoc.save();
      zip.file(`page-${i + 1}.pdf`, bytes);
      onProgress(((i + 1) / maxPage) * 90);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, filename: 'split-pages.zip', pageCount: maxPage };
  }

  splitBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    splitBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runSplit(pdf, PDFDocument, numPages);
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      splitBtn.disabled = false;
    }
  });

  async function runSplit(pdf, PDFDocument, numPages) {
    statusMsg.textContent = 'Splitting... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      let result;
      if (getMode() === 'range') {
        result = await splitRange(pdf, PDFDocument, rangeInput.value);
      } else if (getMode() === 'chunk') {
        const size = chunkSizeInput ? parseInt(chunkSizeInput.value, 10) || 1 : 1;
        result = await splitChunks(pdf, PDFDocument, size, (pct) => {
          progressBar.style.width = pct + '%';
        });
      } else {
        result = await splitAllPages(pdf, PDFDocument, (pct) => {
          progressBar.style.width = pct + '%';
        });
      }
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(result.blob);
      downloadLink.href = url;
      downloadLink.download = result.filename;

      resultBox.classList.add('show');
      statusMsg.textContent = `Done! ${result.pageCount} page(s) ready to download.`;
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = err.message || 'Something went wrong while splitting. Please try again.';
      console.error(err);
    } finally {
      splitBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
