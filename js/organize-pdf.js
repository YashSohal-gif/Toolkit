/* Organize PDF — view page thumbnails, remove pages, reorder them, then
   rebuild the PDF with pdf-lib (extract, remove, and rearrange are all
   the same underlying operation: pick pages, pick order). */

(function () {
  const dropzone = document.getElementById('dropzoneOrg');
  const fileInput = document.getElementById('fileInputOrg');
  const pageListEl = document.getElementById('orgPageList');
  const saveBtn = document.getElementById('orgSaveBtn');
  const statusMsg = document.getElementById('statusMsgOrg');
  const resultBox = document.getElementById('resultBoxOrg');
  const downloadLink = document.getElementById('downloadLinkOrg');
  const progressWrap = document.getElementById('progressWrapOrg');
  const progressBar = document.getElementById('progressBarOrg');

  if (!dropzone) return;

  let selectedFile = null;
  let pages = []; // { originalIndex, keep, thumbUrl }

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
    statusMsg.textContent = 'Loading pages...';
    pageListEl.innerHTML = '';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    pages = [];

    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      pages.push({ originalIndex: p - 1, keep: true, thumbUrl: canvas.toDataURL('image/jpeg', 0.7) });
      statusMsg.textContent = 'Loading pages... (' + p + '/' + numPages + ')';
    }

    statusMsg.textContent = 'Uncheck pages to remove them, use ↑/↓ to reorder, then save.';
    renderPageList();
  }

  function renderPageList() {
    pageListEl.innerHTML = '';
    pages.forEach((pg, idx) => {
      const item = document.createElement('div');
      item.className = 'org-page-item' + (pg.keep ? '' : ' removed');
      item.innerHTML =
        '<img src="' + pg.thumbUrl + '" alt="Page ' + (pg.originalIndex + 1) + '">' +
        '<div class="org-page-label">Page ' + (pg.originalIndex + 1) + '</div>' +
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
        renderPageList();
      });
      pageListEl.appendChild(item);
    });
  }

  saveBtn.addEventListener('click', async () => {
    const keptPages = pages.filter((p) => p.keep);
    if (keptPages.length === 0) {
      statusMsg.textContent = 'Please keep at least 1 page.';
      return;
    }

    saveBtn.disabled = true;
    adGate.run(pages.length, async () => {
      await runSave(keptPages);
    }, statusMsg, 'This ' + pages.length + '-page PDF');
  });

  async function runSave(keptPages) {
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';
    statusMsg.textContent = 'Building your PDF... this happens in your browser, nothing is uploaded.';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const outDoc = await PDFDocument.create();

      const indices = keptPages.map((p) => p.originalIndex);
      const copied = await outDoc.copyPages(srcDoc, indices);
      copied.forEach((p) => outDoc.addPage(p));
      progressBar.style.width = '90%';

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'organized.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your PDF now has ' + keptPages.length + ' page(s).';
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
