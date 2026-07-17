/* PDF to PowerPoint — renders each PDF page as a high-res image via pdf.js,
   then places one full-bleed image per slide via PptxGenJS. Image-based
   slides: layout matches the original exactly, but text is not separately
   editable (it's a picture). Runs fully in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneP2P');
  const fileInput = document.getElementById('fileInputP2P');
  const convertBtn = document.getElementById('p2pBtn');
  const statusMsg = document.getElementById('statusMsgP2P');
  const resultBox = document.getElementById('resultBoxP2P');
  const downloadLink = document.getElementById('downloadLinkP2P');
  const progressWrap = document.getElementById('progressWrapP2P');
  const progressBar = document.getElementById('progressBarP2P');

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
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        try {
          statusMsg.textContent = 'Rendering pages and building slides...';
          const pptx = new PptxGenJS();
          pptx.defineLayout({ name: 'PDF_LAYOUT', width: 10, height: 7.5 });
          pptx.layout = 'PDF_LAYOUT';

          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', 0.88);
            const slide = pptx.addSlide();

            /* Fit the image into the 10x7.5in slide while keeping aspect ratio. */
            const pageAspect = canvas.width / canvas.height;
            const slideAspect = 10 / 7.5;
            let w, h, x, y;
            if (pageAspect > slideAspect) {
              w = 10; h = 10 / pageAspect; x = 0; y = (7.5 - h) / 2;
            } else {
              h = 7.5; w = 7.5 * pageAspect; y = 0; x = (10 - w) / 2;
            }
            slide.addImage({ data: imgData, x, y, w, h });

            progressBar.style.width = ((p / numPages) * 85) + '%';
          }

          statusMsg.textContent = 'Packaging your PowerPoint file...';
          const blob = await pptx.write({ outputType: 'blob' });
          progressBar.style.width = '100%';

          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.pptx';

          resultBox.classList.add('show');
          statusMsg.textContent = `Done! ${numPages} slide${numPages === 1 ? '' : 's'} created.`;
          statusMsg.className = 'status success';
        } catch (err) {
          statusMsg.textContent = 'Something went wrong building the PowerPoint file.';
          console.error(err);
        } finally {
          convertBtn.disabled = false;
          progressWrap.classList.remove('show');
        }
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
