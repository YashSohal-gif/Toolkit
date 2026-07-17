/* Change PDF Page Size — rescale every page's content to fit a new
   standard page size (A4, Letter, Legal), preserving aspect via pdf-lib. */

(function () {
  const dropzone = document.getElementById('dropzoneRPP');
  const fileInput = document.getElementById('fileInputRPP');
  const sizeGroup = document.getElementById('rppSize');
  let sizeValue = 'a4';
  const rppBtn = document.getElementById('rppBtn');
  const statusMsg = document.getElementById('statusMsgRPP');
  const resultBox = document.getElementById('resultBoxRPP');
  const downloadLink = document.getElementById('downloadLinkRPP');
  const progressWrap = document.getElementById('progressWrapRPP');
  const progressBar = document.getElementById('progressBarRPP');

  if (!dropzone) return;

  if (sizeGroup) {
    sizeGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        sizeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sizeValue = btn.dataset.value;
      });
    });
  }

  const SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792],
    legal: [612, 1008]
  };

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

  rppBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    rppBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runResize(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      rppBtn.disabled = false;
    }
  });

  async function runResize(pdf, numPages) {
    statusMsg.textContent = 'Resizing pages... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const [targetW, targetH] = SIZES[sizeValue];
      const pages = pdf.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const scale = Math.min(targetW / width, targetH / height);
        page.scale(scale, scale);
        const newW = width * scale;
        const newH = height * scale;
        page.setSize(targetW, targetH);
        // center the scaled content on the new page
        page.translateContent((targetW - newW) / 2, (targetH - newH) / 2);
      });
      progressBar.style.width = '80%';

      const outBytes = await pdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-resized.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! All ' + numPages + ' page(s) resized to ' + sizeValue.toUpperCase() + '.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while resizing. Please try again.';
      console.error(err);
    } finally {
      rppBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
