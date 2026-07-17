/* Repair PDF — best-effort rebuild of a damaged/corrupted PDF. Loads the
   source as leniently as pdf-lib allows (ignoring encryption checks where
   possible), then copies each page it can successfully parse into a fresh
   PDFDocument. Pages that throw during copy are skipped, not fatal. */

(function () {
  const dropzone = document.getElementById('dropzoneRepair');
  const fileInput = document.getElementById('fileInputRepair');
  const repairBtn = document.getElementById('repairBtn');
  const statusMsg = document.getElementById('statusMsgRepair');
  const resultBox = document.getElementById('resultBoxRepair');
  const downloadLink = document.getElementById('downloadLinkRepair');
  const pagesRecoveredEl = document.getElementById('pagesRecoveredRepair');
  const progressWrap = document.getElementById('progressWrapRepair');
  const progressBar = document.getElementById('progressBarRepair');

  if (!dropzone) return;

  let selectedFile = null;

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
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  repairBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    repairBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF as leniently as possible...';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
      const totalPages = srcDoc.getPageCount();

      adGate.run(totalPages, async () => {
        await runRepair(srcDoc, PDFDocument, totalPages);
      }, statusMsg, 'This ' + totalPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'This file is too damaged to read at all — even a lenient parser could not open it.';
      console.error(err);
      repairBtn.disabled = false;
    }
  });

  async function runRepair(srcDoc, PDFDocument, totalPages) {
    statusMsg.textContent = 'Rebuilding your PDF page by page... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    let recovered = 0;
    try {
      const outDoc = await PDFDocument.create();

      for (let i = 0; i < totalPages; i++) {
        try {
          const [copiedPage] = await outDoc.copyPages(srcDoc, [i]);
          outDoc.addPage(copiedPage);
          recovered++;
        } catch (pageErr) {
          console.warn('Skipping unreadable page ' + (i + 1), pageErr);
        }
        progressBar.style.width = (((i + 1) / totalPages) * 90) + '%';
      }

      if (recovered === 0) {
        statusMsg.textContent = 'No pages could be recovered from this file — it may be too badly damaged.';
        statusMsg.className = 'status error';
        return;
      }

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-repaired.pdf';

      pagesRecoveredEl.textContent = recovered + ' of ' + totalPages;
      resultBox.classList.add('show');
      statusMsg.textContent = recovered === totalPages
        ? 'Done! All ' + totalPages + ' page(s) rebuilt successfully.'
        : 'Done! Recovered ' + recovered + ' of ' + totalPages + ' page(s) — the rest were too damaged to read.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while rebuilding this PDF.';
      console.error(err);
    } finally {
      repairBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
