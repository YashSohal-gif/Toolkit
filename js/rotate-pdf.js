/* Rotate PDF — rotate every page by 90/180/270 degrees, using pdf-lib
   (no rasterizing, original quality preserved). */

(function () {
  const dropzone = document.getElementById('dropzoneRotate');
  const fileInput = document.getElementById('fileInputRotate');
  const angleGroup = document.getElementById('rotateAngle');
  let angleValue = 90;
  const rotateBtn = document.getElementById('rotateBtn');
  const statusMsg = document.getElementById('statusMsgRotate');
  const resultBox = document.getElementById('resultBoxRotate');
  const downloadLink = document.getElementById('downloadLinkRotate');
  const progressWrap = document.getElementById('progressWrapRotate');
  const progressBar = document.getElementById('progressBarRotate');

  if (!dropzone) return;

  if (angleGroup) {
    angleGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        angleGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        angleValue = parseInt(btn.dataset.value, 10);
      });
    });
  }

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

  rotateBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    rotateBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument, degrees } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runRotate(pdf, PDFDocument, degrees, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      rotateBtn.disabled = false;
    }
  });

  async function runRotate(pdf, PDFDocument, degrees, numPages) {
    statusMsg.textContent = 'Rotating... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const angle = angleValue;
      const pages = pdf.getPages();
      pages.forEach((page) => {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      });
      progressBar.style.width = '80%';

      const outBytes = await pdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-rotated.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! All ' + numPages + ' page(s) rotated ' + angle + '°.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while rotating. Please try again.';
      console.error(err);
    } finally {
      rotateBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
