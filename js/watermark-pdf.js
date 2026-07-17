/* Watermark PDF — stamp diagonal text across every page using pdf-lib. */

(function () {
  const dropzone = document.getElementById('dropzoneWatermark');
  const fileInput = document.getElementById('fileInputWatermark');
  const textInput = document.getElementById('watermarkText');
  const opacityInput = document.getElementById('watermarkOpacity');
  const sizeInput = document.getElementById('watermarkSize');
  const watermarkBtn = document.getElementById('watermarkBtn');
  const statusMsg = document.getElementById('statusMsgWatermark');
  const resultBox = document.getElementById('resultBoxWatermark');
  const downloadLink = document.getElementById('downloadLinkWatermark');
  const progressWrap = document.getElementById('progressWrapWatermark');
  const progressBar = document.getElementById('progressBarWatermark');

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

  watermarkBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    const text = textInput.value.trim();
    if (!text) {
      statusMsg.textContent = 'Please enter watermark text.';
      return;
    }

    watermarkBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const numPages = pdf.getPageCount();

      adGate.run(numPages, async () => {
        await runWatermark(pdf, PDFDocument, rgb, degrees, StandardFonts, text, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      watermarkBtn.disabled = false;
    }
  });

  async function runWatermark(pdf, PDFDocument, rgb, degrees, StandardFonts, text, numPages) {
    statusMsg.textContent = 'Adding watermark... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const opacity = (parseInt(opacityInput.value, 10) || 20) / 100;
      const fontSize = parseInt(sizeInput.value, 10) || 48;
      const pages = pdf.getPages();

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: opacity,
          rotate: degrees(45)
        });
        progressBar.style.width = (10 + ((i + 1) / pages.length) * 70) + '%';
      });

      const outBytes = await pdf.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-watermarked.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Watermark added to all ' + numPages + ' page(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while adding the watermark. Please try again.';
      console.error(err);
    } finally {
      watermarkBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
