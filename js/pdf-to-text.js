/* PDF to Text — extract all selectable text from a PDF using pdf.js,
   download as a .txt file. */

(function () {
  const dropzone = document.getElementById('dropzoneP2T');
  const fileInput = document.getElementById('fileInputP2T');
  const convertBtn = document.getElementById('p2tBtn');
  const statusMsg = document.getElementById('statusMsgP2T');
  const resultBox = document.getElementById('resultBoxP2T');
  const downloadLink = document.getElementById('downloadLinkP2T');
  const previewBox = document.getElementById('p2tPreview');

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
    previewBox.style.display = 'none';
    statusMsg.textContent = '';
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Extracting text...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      let fullText = '';
      let totalChars = 0;
      let blankPages = 0;

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(' ');
        const trimmedLen = pageText.trim().length;
        totalChars += trimmedLen;
        if (trimmedLen < 5) blankPages++;
        fullText += '--- Page ' + p + ' ---\n' + pageText + '\n\n';
        statusMsg.textContent = 'Extracting text... (' + p + '/' + numPages + ')';
      }

      /* Vector/digital PDFs have real selectable text on nearly every page;
         a scanned (raster) PDF is a photo of a page with no text layer at
         all, so almost every page comes back near-empty here. */
      const isLikelyScanned = numPages > 0 && (blankPages / numPages) > 0.6 && totalChars < numPages * 20;
      if (isLikelyScanned) {
        previewBox.style.display = 'block';
        /* innerHTML here is safe: every value is a locally-computed number, no user/file-derived string is interpolated */
        previewBox.innerHTML = '⚠️ This looks like a scanned (image-based) PDF — ' + blankPages + ' of ' + numPages +
          ' page(s) had no real text to extract. Try the <a href="../pdf-tools/ocr-pdf.html">OCR PDF tool</a> instead, which reads text out of the page images.';
        statusMsg.textContent = 'No real text layer found — this PDF looks scanned.';
        statusMsg.className = 'status';
        resultBox.classList.remove('show');
        convertBtn.disabled = false;
        return;
      }

      const blob = new Blob([fullText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '.txt';

      previewBox.textContent = fullText.slice(0, 2000) + (fullText.length > 2000 ? '\n\n... (truncated preview, full text in download)' : '');
      previewBox.style.display = 'block';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Extracted text from ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. This PDF may be a scanned image with no selectable text.';
      console.error(err);
    } finally {
      convertBtn.disabled = false;
    }
  });
})();
