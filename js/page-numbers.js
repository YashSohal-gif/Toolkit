/* Add Page Numbers — stamp "1", "2", "3"... (or "Page 1 of N") at the
   bottom of every page using pdf-lib. */

(function () {
  const dropzone = document.getElementById('dropzonePN');
  const fileInput = document.getElementById('fileInputPN');
  const formatGroup = document.getElementById('pnFormat');
  const positionGroup = document.getElementById('pnPosition');
  let formatValue = 'number';
  let positionValue = 'center';
  const pnBtn = document.getElementById('pnBtn');
  const statusMsg = document.getElementById('statusMsgPN');
  const resultBox = document.getElementById('resultBoxPN');
  const downloadLink = document.getElementById('downloadLinkPN');
  const progressWrap = document.getElementById('progressWrapPN');
  const progressBar = document.getElementById('progressBarPN');

  if (!dropzone) return;

  if (formatGroup) {
    formatGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        formatGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        formatValue = btn.dataset.value;
      });
    });
  }
  if (positionGroup) {
    positionGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        positionGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        positionValue = btn.dataset.value;
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

  pnBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    pnBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runPageNumbers(pdf, rgb, StandardFonts, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      pnBtn.disabled = false;
    }
  });

  async function runPageNumbers(pdf, rgb, StandardFonts, numPages) {
    statusMsg.textContent = 'Adding page numbers... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const format = formatValue;
      const position = positionValue;
      const pages = pdf.getPages();

      pages.forEach((page, i) => {
        const { width } = page.getSize();
        const label = format === 'page-of-n' ? ('Page ' + (i + 1) + ' of ' + numPages) : String(i + 1);
        const fontSize = 11;
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        let x;
        if (position === 'left') x = 30;
        else if (position === 'right') x = width - textWidth - 30;
        else x = width / 2 - textWidth / 2;

        page.drawText(label, {
          x: x,
          y: 24,
          size: fontSize,
          font: font,
          color: rgb(0.2, 0.2, 0.2)
        });
        progressBar.style.width = (10 + ((i + 1) / pages.length) * 70) + '%';
      });

      const outBytes = await pdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-numbered.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Page numbers added to all ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while adding page numbers. Please try again.';
      console.error(err);
    } finally {
      pnBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
