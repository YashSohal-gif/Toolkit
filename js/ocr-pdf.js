/* OCR PDF — render each PDF page to a canvas via pdf.js, then run
   Tesseract.js (on-device OCR, no server) against each page image and
   concatenate the recognized text. Downloadable as a .txt file. */

(function () {
  const dropzone = document.getElementById('dropzoneOcr');
  const fileInput = document.getElementById('fileInputOcr');
  const langGroup = document.getElementById('langGroupOcr');
  const ocrBtn = document.getElementById('ocrBtn');
  const statusMsg = document.getElementById('statusMsgOcr');
  const resultBox = document.getElementById('resultBoxOcr');
  const textOutput = document.getElementById('ocrTextOutput');
  const downloadLink = document.getElementById('downloadLinkOcr');
  const progressWrap = document.getElementById('progressWrapOcr');
  const progressBar = document.getElementById('progressBarOcr');

  if (!dropzone) return;

  let selectedFile = null;
  let langValue = 'eng';

  langGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      langGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      langValue = btn.dataset.value;
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

  ocrBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    ocrBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runOcr(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
      ocrBtn.disabled = false;
    }
  });

  async function runOcr(pdf, numPages) {
    statusMsg.textContent = 'Loading OCR engine (' + langValue + ')...';
    progressWrap.classList.add('show');
    progressBar.style.width = '2%';

    try {
      const worker = await Tesseract.createWorker(langValue);
      let fullText = '';

      for (let p = 1; p <= numPages; p++) {
        statusMsg.textContent = 'Recognizing text on page ' + p + ' of ' + numPages + '...';
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const { data } = await worker.recognize(canvas);
        fullText += '--- Page ' + p + ' ---\n' + data.text.trim() + '\n\n';
        progressBar.style.width = ((p / numPages) * 95) + '%';
      }

      await worker.terminate();
      progressBar.style.width = '100%';

      textOutput.value = fullText.trim();
      const blob = new Blob([fullText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-ocr.txt';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Text recognized from ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong running OCR. Please try again, or try a shorter document.';
      console.error(err);
    } finally {
      ocrBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
