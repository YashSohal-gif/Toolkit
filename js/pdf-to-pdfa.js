/* PDF to "PDF/A" (simplified archival export) — flattens every page into a
   rendered image (via pdf.js) and rebuilds a new self-contained PDF (via
   jsPDF) with basic archival metadata set. This is NOT a certified
   ISO 19005 PDF/A file — it's a practical, dependency-free flattened PDF
   for long-term storage. Runs fully in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneP2A');
  const fileInput = document.getElementById('fileInputP2A');
  const qualityGroup = document.getElementById('qualityP2A');
  let qualityValue = 0.85;
  const convertBtn = document.getElementById('p2aBtn');
  const statusMsg = document.getElementById('statusMsgP2A');
  const resultBox = document.getElementById('resultBoxP2A');
  const downloadLink = document.getElementById('downloadLinkP2A');
  const progressWrap = document.getElementById('progressWrapP2A');
  const progressBar = document.getElementById('progressBarP2A');

  if (!dropzone) return;

  let selectedFile = null;

  if (qualityGroup) {
    qualityGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        qualityGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        qualityValue = parseFloat(btn.dataset.value);
      });
    });
  }

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
          statusMsg.textContent = 'Flattening pages...';
          const { jsPDF } = window.jspdf;
          let doc = null;

          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', qualityValue);
            const widthPt = canvas.width * (72 / 96 / 2);
            const heightPt = canvas.height * (72 / 96 / 2);
            const orientation = widthPt > heightPt ? 'l' : 'p';

            if (p === 1) {
              doc = new jsPDF({ orientation, unit: 'pt', format: [widthPt, heightPt] });
            } else {
              doc.addPage([widthPt, heightPt], orientation);
            }
            doc.addImage(imgData, 'JPEG', 0, 0, widthPt, heightPt);
            progressBar.style.width = ((p / numPages) * 85) + '%';
          }

          doc.setProperties({
            title: selectedFile.name.replace(/\.[^/.]+$/, ''),
            subject: 'Flattened archival export',
            creator: 'KBResize PDF to PDF/A',
            keywords: 'archival, flattened, long-term storage'
          });

          statusMsg.textContent = 'Packaging your archival PDF...';
          const blob = doc.output('blob');
          progressBar.style.width = '100%';

          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '-archival.pdf';

          resultBox.classList.add('show');
          statusMsg.textContent = 'Done! Your flattened, archive-friendly PDF is ready.';
          statusMsg.className = 'status success';
        } catch (err) {
          statusMsg.textContent = 'Something went wrong building the archival PDF.';
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
