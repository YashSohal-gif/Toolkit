/* PDF to JPG — render every page of a PDF to a JPG image, delivered as a ZIP.
   Uses pdf.js to render and JSZip to bundle. */

(function () {
  const dropzone = document.getElementById('dropzonePdfToJpg');
  const fileInput = document.getElementById('fileInputPdfToJpg');
  const convertBtn = document.getElementById('convertBtnPdfToJpg');
  const statusMsg = document.getElementById('statusMsgPdfToJpg');
  const resultBox = document.getElementById('resultBoxPdfToJpg');
  const downloadLink = document.getElementById('downloadLinkPdfToJpg');
  const progressWrap = document.getElementById('progressWrapPdfToJpg');
  const progressBar = document.getElementById('progressBarPdfToJpg');

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

  /* Parse "1-3,5,8" into a sorted list of page numbers, clamped to the doc */
  function parsePageRange(text, numPages) {
    if (!text || !text.trim()) return null; // null = all pages
    const pages = new Set();
    text.split(',').forEach(part => {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) return;
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : start;
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        if (i >= 1 && i <= numPages) pages.add(i);
      }
    });
    return pages.size ? Array.from(pages).sort((a, b) => a - b) : null;
  }

  function getOptions(numPages) {
    const scaleSel = document.getElementById('p2jScale');
    const fmtSel = document.getElementById('p2jFormat');
    const qualitySlider = document.getElementById('p2jQuality');
    const rangeInput = document.getElementById('p2jRange');
    return {
      scale: scaleSel ? parseInt(scaleSel.value, 10) : 2,
      format: fmtSel ? fmtSel.value : 'jpeg',
      quality: qualitySlider ? parseInt(qualitySlider.value, 10) / 100 : 0.9,
      pages: parsePageRange(rangeInput ? rangeInput.value : '', numPages)
    };
  }

  async function convertToJpgZip(pdf, onProgress) {
    const zip = new JSZip();
    const numPages = pdf.numPages;
    const opts = getOptions(numPages);
    const pageList = opts.pages || Array.from({ length: numPages }, (_, i) => i + 1);
    const ext = opts.format === 'png' ? 'png' : 'jpg';
    const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';

    for (let i = 0; i < pageList.length; i++) {
      const p = pageList[i];
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: opts.scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, opts.quality));
      zip.file(`page-${p}.${ext}`, blob);
      onProgress(((i + 1) / pageList.length) * 90);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, numPages: pageList.length };
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runConvert(pdf, numPages);
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });

  async function runConvert(pdf, numPages) {
    statusMsg.textContent = 'Converting... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const { blob, numPages: convertedCount } = await convertToJpgZip(pdf, (pct) => {
        progressBar.style.width = pct + '%';
      });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'pdf-pages.zip';

      resultBox.classList.add('show');
      statusMsg.textContent = `Done! ${convertedCount} page(s) converted, zipped and ready to download.`;
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different PDF.';
      console.error(err);
    } finally {
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
