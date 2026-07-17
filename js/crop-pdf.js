/* Crop PDF — trim equal margins (in inches) from every page using pdf-lib's
   crop box. Non-destructive to the underlying content, respected by viewers/printers. */

(function () {
  const dropzone = document.getElementById('dropzoneCrop');
  const fileInput = document.getElementById('fileInputCrop');
  const marginInput = document.getElementById('cropMargin');
  const cropBtn = document.getElementById('cropBtn');
  const statusMsg = document.getElementById('statusMsgCrop');
  const resultBox = document.getElementById('resultBoxCrop');
  const downloadLink = document.getElementById('downloadLinkCrop');
  const progressWrap = document.getElementById('progressWrapCrop');
  const progressBar = document.getElementById('progressBarCrop');

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

  cropBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    cropBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runCrop(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      cropBtn.disabled = false;
    }
  });

  async function runCrop(pdf, numPages) {
    statusMsg.textContent = 'Cropping... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const marginIn = parseFloat(marginInput.value) || 0;
      const marginPt = marginIn * 72;
      const pages = pdf.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.setCropBox(marginPt, marginPt, Math.max(1, width - marginPt * 2), Math.max(1, height - marginPt * 2));
      });
      progressBar.style.width = '80%';

      const outBytes = await pdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-cropped.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Cropped ' + marginIn + 'in margin from all ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while cropping. Please try again.';
      console.error(err);
    } finally {
      cropBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
