/* Unlock PDF — user supplies the known password, pdf.js opens the file
   with it, each page is rendered to canvas, and the pages are rebuilt
   as a fresh, unprotected PDF via jsPDF (image-based, since removing
   real encryption + preserving vector text isn't feasible client-side). */

(function () {
  const dropzone = document.getElementById('dropzoneUnlock');
  const fileInput = document.getElementById('fileInputUnlock');
  const passwordInput = document.getElementById('unlockPassword');
  const unlockBtn = document.getElementById('unlockBtn');
  const statusMsg = document.getElementById('statusMsgUnlock');
  const resultBox = document.getElementById('resultBoxUnlock');
  const downloadLink = document.getElementById('downloadLinkUnlock');
  const progressWrap = document.getElementById('progressWrapUnlock');
  const progressBar = document.getElementById('progressBarUnlock');

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

  unlockBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    const password = passwordInput.value;
    if (!password) {
      statusMsg.textContent = 'Please enter the PDF\'s password.';
      return;
    }

    unlockBtn.disabled = true;
    statusMsg.textContent = 'Opening your PDF with the provided password...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password: password }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runUnlock(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      if (err && err.name === 'PasswordException') {
        statusMsg.textContent = 'That password did not work. Please check it and try again.';
      } else {
        statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      }
      console.error(err);
      unlockBtn.disabled = false;
    }
  });

  async function runUnlock(pdf, numPages) {
    statusMsg.textContent = 'Building your unlocked PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

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
        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        const widthPt = viewport.width * 0.5;
        const heightPt = viewport.height * 0.5;
        const orientation = widthPt > heightPt ? 'l' : 'p';

        if (p === 1) {
          doc = new jsPDF({ orientation, unit: 'pt', format: [widthPt, heightPt] });
        } else {
          doc.addPage([widthPt, heightPt], orientation);
        }
        doc.addImage(imgData, 'JPEG', 0, 0, widthPt, heightPt);
        progressBar.style.width = ((p / numPages) * 100) + '%';
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-unlocked.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Password removed from all ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while unlocking this PDF. Please try again.';
      console.error(err);
    } finally {
      unlockBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
