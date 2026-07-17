/* Merge PDF — combine multiple PDFs into one, in the browser, using pdf-lib.
   Unlike the compressor, this preserves original text/vector quality
   (no rasterizing) since pdf-lib copies pages directly. */

(function () {
  const dropzone = document.getElementById('dropzoneMerge');
  const fileInput = document.getElementById('fileInputMerge');
  const fileListEl = document.getElementById('fileListMerge');
  const mergeBtn = document.getElementById('mergeBtn');
  const statusMsg = document.getElementById('statusMsgMerge');
  const resultBox = document.getElementById('resultBoxMerge');
  const downloadLink = document.getElementById('downloadLinkMerge');
  const progressWrap = document.getElementById('progressWrapMerge');
  const progressBar = document.getElementById('progressBarMerge');

  if (!dropzone) return;

  let files = [];

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  function addFiles(fileListObj) {
    for (const f of fileListObj) {
      if (f.type === 'application/pdf') files.push(f);
    }
    renderFileList();
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    files.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'file-list-item';
      /* textContent (not innerHTML) — file names are untrusted input */
      const label = document.createElement('span');
      label.textContent = `${idx + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      row.appendChild(label);

      const upBtn = document.createElement('button');
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => {
        [files[idx - 1], files[idx]] = [files[idx], files[idx - 1]];
        renderFileList();
      });
      const downBtn = document.createElement('button');
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.disabled = idx === files.length - 1;
      downBtn.addEventListener('click', () => {
        [files[idx + 1], files[idx]] = [files[idx], files[idx + 1]];
        renderFileList();
      });
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        files.splice(idx, 1);
        renderFileList();
      });
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      row.appendChild(removeBtn);
      fileListEl.appendChild(row);
    });
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  async function mergeFiles(onProgress) {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (let i = 0; i < files.length; i++) {
      const bytes = await files[i].arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
      copiedPages.forEach((p) => mergedPdf.addPage(p));
      totalPages += pageIndices.length;
      onProgress(((i + 1) / files.length) * 90);
    }

    const mergedBytes = await mergedPdf.save();
    onProgress(100);
    return { blob: new Blob([mergedBytes], { type: 'application/pdf' }), totalPages };
  }

  mergeBtn.addEventListener('click', async () => {
    if (files.length < 2) {
      statusMsg.textContent = 'Please add at least 2 PDF files to merge.';
      return;
    }

    mergeBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDFs...';

    try {
      // quick page count for the ad-gate: sum pages across files
      const { PDFDocument } = PDFLib;
      let totalPages = 0;
      for (const f of files) {
        const bytes = await f.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        totalPages += doc.getPageCount();
      }

      adGate.run(totalPages, async () => {
        await runMerge();
      }, statusMsg, `This merge (${totalPages} total pages)`);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDFs. Please check the files and try again.';
      console.error(err);
      mergeBtn.disabled = false;
    }
  });

  async function runMerge() {
    statusMsg.textContent = 'Merging... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const { blob, totalPages } = await mergeFiles((pct) => {
        progressBar.style.width = pct + '%';
      });

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'merged.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = `Done! Merged ${files.length} files into one ${totalPages}-page PDF.`;
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while merging. Please try again.';
      console.error(err);
    } finally {
      mergeBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
