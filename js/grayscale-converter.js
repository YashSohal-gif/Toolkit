/* Grayscale / Black & White Converter — works on a single image, or every
   page of a PDF (re-rendered via pdf.js, converted, rebuilt via jsPDF). */

(function () {
  const dropzone = document.getElementById('dropzoneGray');
  const fileInput = document.getElementById('fileInputGray');
  const grayModeGroup = document.getElementById('grayModeGroup');
  let grayModeValue = 'image';
  const grayBtn = document.getElementById('grayBtn');
  const statusMsg = document.getElementById('statusMsgGray');
  const resultBox = document.getElementById('resultBoxGray');
  const downloadLink = document.getElementById('downloadLinkGray');
  const progressWrap = document.getElementById('progressWrapGray');
  const progressBar = document.getElementById('progressBarGray');
  const beforeAfterWrap = document.getElementById('beforeAfterWrapGray');
  const baSlider = document.getElementById('baSliderGray');
  const baBefore = document.getElementById('baBeforeGray');
  const baAfter = document.getElementById('baAfterGray');

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

  if (grayModeGroup) {
    grayModeGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        grayModeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        grayModeValue = btn.dataset.value;
      });
    });
  }

  function currentMode() {
    return grayModeValue;
  }

  function handleFile(file) {
    const mode = currentMode();
    if (mode === 'image' && !file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file, or switch to PDF mode.';
      return;
    }
    if (mode === 'pdf' && file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file, or switch to Image mode.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    if (beforeAfterWrap) beforeAfterWrap.style.display = 'none';
    statusMsg.textContent = '';
  }

  function applyGrayscale(ctx, w, h) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const avg = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = avg;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  async function convertImage() {
    const img = new Image();
    const url = URL.createObjectURL(selectedFile);
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    applyGrayscale(ctx, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve({ blob, filename: 'grayscale.jpg' }), 'image/jpeg', 0.92);
    });
  }

  async function convertPdf(onProgress) {
    const arrayBuffer = await selectedFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    return new Promise((resolve, reject) => {
      adGate.run(numPages, async () => {
        try {
          const { jsPDF } = window.jspdf;
          let doc = null;

          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            applyGrayscale(ctx, canvas.width, canvas.height);

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const widthPt = canvas.width * (72 / 96 / 2);
            const heightPt = canvas.height * (72 / 96 / 2);
            const orientation = widthPt > heightPt ? 'l' : 'p';
            if (p === 1) {
              doc = new jsPDF({ orientation: orientation, unit: 'pt', format: [widthPt, heightPt] });
            } else {
              doc.addPage([widthPt, heightPt], orientation);
            }
            doc.addImage(imgData, 'JPEG', 0, 0, widthPt, heightPt);
            onProgress((p / numPages) * 100);
          }

          resolve({ blob: doc.output('blob'), filename: 'grayscale.pdf' });
        } catch (err) {
          reject(err);
        }
      }, statusMsg, 'This ' + numPages + '-page PDF');
    });
  }

  grayBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a file first.';
      return;
    }

    grayBtn.disabled = true;
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    statusMsg.textContent = 'Converting... this happens in your browser, nothing is uploaded.';

    try {
      const mode = currentMode();
      let result;
      if (mode === 'image') {
        progressBar.style.width = '50%';
        result = await convertImage();
      } else {
        result = await convertPdf((pct) => { progressBar.style.width = pct + '%'; });
      }
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(result.blob);
      downloadLink.href = url;
      downloadLink.download = result.filename;

      if (mode === 'image' && beforeAfterWrap) {
        if (baBefore.src && baBefore.src.startsWith('blob:')) URL.revokeObjectURL(baBefore.src);
        if (baAfter.src && baAfter.src.startsWith('blob:')) URL.revokeObjectURL(baAfter.src);
        baBefore.src = URL.createObjectURL(selectedFile);
        baAfter.src = url;
        beforeAfterWrap.style.display = '';
        baSlider.style.setProperty('--ba-pos', '50%');
        setupBeforeAfterSlider(baSlider);
      } else if (beforeAfterWrap) {
        beforeAfterWrap.style.display = 'none';
      }

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Converted to grayscale.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try again.';
      console.error(err);
    } finally {
      grayBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
