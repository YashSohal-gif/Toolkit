/* Scanner Effect PDF — renders each page via pdf.js, then applies a
   realistic "just came out of a scanner" look: a slight random rotation
   (as if the page wasn't perfectly aligned), paper grain noise, a subtle
   warm tint, and soft edge vignette shadow. Rebuilt as a PDF via jsPDF. */

(function () {
  const dropzone = document.getElementById('dropzoneScanFx');
  const fileInput = document.getElementById('fileInputScanFx');
  const strengthGroup = document.getElementById('strengthGroupScanFx');
  const scanFxBtn = document.getElementById('scanFxBtn');
  const statusMsg = document.getElementById('statusMsgScanFx');
  const resultBox = document.getElementById('resultBoxScanFx');
  const downloadLink = document.getElementById('downloadLinkScanFx');
  const progressWrap = document.getElementById('progressWrapScanFx');
  const progressBar = document.getElementById('progressBarScanFx');

  if (!dropzone) return;

  const STRENGTHS = {
    light:  { rotate: 0.3, grain: 4,  tint: 0.03, vignette: 0.10 },
    medium: { rotate: 0.7, grain: 9,  tint: 0.06, vignette: 0.18 },
    heavy:  { rotate: 1.6, grain: 16, tint: 0.10, vignette: 0.30 }
  };

  let selectedFile = null;
  let strengthValue = 'medium';

  strengthGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      strengthGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      strengthValue = btn.dataset.value;
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

  function applyGrainAndTint(ctx, w, h, cfg) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 2 * cfg.grain;
      d[i]     = Math.max(0, Math.min(255, d[i]     + noise + cfg.tint * 20));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise + cfg.tint * 12));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function applyVignette(ctx, w, h, strength) {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  async function renderScannedPage(page, cfg) {
    const baseViewport = page.getViewport({ scale: 2 });
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = baseViewport.width;
    srcCanvas.height = baseViewport.height;
    const srcCtx = srcCanvas.getContext('2d');
    await page.render({ canvasContext: srcCtx, viewport: baseViewport }).promise;

    // Slight random rotation onto a slightly larger white "scanner bed" canvas
    const angle = (Math.random() - 0.5) * 2 * cfg.rotate * (Math.PI / 180);
    const pad = Math.ceil(Math.max(srcCanvas.width, srcCanvas.height) * 0.02) + 6;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = srcCanvas.width + pad * 2;
    outCanvas.height = srcCanvas.height + pad * 2;
    const outCtx = outCanvas.getContext('2d');
    outCtx.fillStyle = '#fdfcf8';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.save();
    outCtx.translate(outCanvas.width / 2, outCanvas.height / 2);
    outCtx.rotate(angle);
    outCtx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    outCtx.restore();

    applyGrainAndTint(outCtx, outCanvas.width, outCanvas.height, cfg);
    applyVignette(outCtx, outCanvas.width, outCanvas.height, cfg.vignette);

    return outCanvas;
  }

  scanFxBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    scanFxBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runEffect(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
      scanFxBtn.disabled = false;
    }
  });

  async function runEffect(pdf, numPages) {
    statusMsg.textContent = 'Applying scanner effect... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const cfg = STRENGTHS[strengthValue];
      const { jsPDF } = window.jspdf;
      let doc = null;

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const canvas = await renderScannedPage(page, cfg);
        const imgData = canvas.toDataURL('image/jpeg', 0.9);

        const widthPt = canvas.width * 0.5;
        const heightPt = canvas.height * 0.5;
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
      downloadLink.download = originalName + '-scanned-look.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your PDF now has a realistic scanned-document look.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong applying the effect. Please try again.';
      console.error(err);
    } finally {
      scanFxBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
