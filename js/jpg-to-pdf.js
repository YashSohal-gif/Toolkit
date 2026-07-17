/* JPG to PDF — combine one or more images into a single PDF, one image per page. */

(function () {
  const dropzone = document.getElementById('dropzoneJpgToPdf');
  const fileInput = document.getElementById('fileInputJpgToPdf');
  const fileListEl = document.getElementById('fileListJpgToPdf');
  const convertBtn = document.getElementById('convertBtnJpgToPdf');
  const statusMsg = document.getElementById('statusMsgJpgToPdf');
  const resultBox = document.getElementById('resultBoxJpgToPdf');
  const downloadLink = document.getElementById('downloadLinkJpgToPdf');
  const progressWrap = document.getElementById('progressWrapJpgToPdf');
  const progressBar = document.getElementById('progressBarJpgToPdf');

  if (!dropzone) return;

  let files = [];

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  function addFiles(fileListObj) {
    for (const f of fileListObj) {
      if (f.type.startsWith('image/')) files.push(f);
    }
    renderFileList();
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    files.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'file-list-item';
      /* textContent (not innerHTML) — file names are untrusted input */
      const label = document.createElement('span');
      label.textContent = `${idx + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      row.appendChild(label);
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        files.splice(idx, 1);
        renderFileList();
      });
      row.appendChild(removeBtn);
      fileListEl.appendChild(row);
    });
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };

  function getOptions() {
    const sizeSel = document.getElementById('j2pPageSize');
    const orientSel = document.getElementById('j2pOrientation');
    const marginSlider = document.getElementById('j2pMargin');
    const qualitySlider = document.getElementById('j2pQuality');
    return {
      pageSize: sizeSel ? sizeSel.value : 'auto',
      orientation: orientSel ? orientSel.value : 'auto',
      margin: marginSlider ? parseInt(marginSlider.value, 10) : 0,
      quality: qualitySlider ? parseInt(qualitySlider.value, 10) / 100 : 0.92
    };
  }

  /* Re-encode the image through a canvas so the quality slider actually
     controls the embedded JPEG's compression level. */
  function imageToJpeg(img, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparency (PNG) onto white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function buildPdf(onProgress) {
    const { jsPDF } = window.jspdf;
    const opts = getOptions();
    let doc = null;

    for (let i = 0; i < files.length; i++) {
      const img = await loadImage(files[i]);
      const imgWPt = img.width * 0.75; // px to pt approximation
      const imgHPt = img.height * 0.75;

      let pageW, pageH;
      if (opts.pageSize === 'auto') {
        pageW = imgWPt + opts.margin * 2;
        pageH = imgHPt + opts.margin * 2;
      } else {
        const base = PAGE_SIZES[opts.pageSize] || PAGE_SIZES.a4;
        const landscape = opts.orientation === 'auto' ? imgWPt > imgHPt : opts.orientation === 'l';
        pageW = landscape ? base[1] : base[0];
        pageH = landscape ? base[0] : base[1];
      }
      const orientation = pageW > pageH ? 'l' : 'p';

      if (i === 0) {
        doc = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] });
      } else {
        doc.addPage([pageW, pageH], orientation);
      }

      /* Fit the image inside the page minus margins, preserving aspect ratio */
      const availW = pageW - opts.margin * 2;
      const availH = pageH - opts.margin * 2;
      const scale = Math.min(availW / imgWPt, availH / imgHPt, 1);
      const drawW = imgWPt * scale;
      const drawH = imgHPt * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      const dataUrl = imageToJpeg(img, opts.quality);
      doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
      onProgress(((i + 1) / files.length) * 100);
    }

    return doc.output('blob');
  }

  convertBtn.addEventListener('click', async () => {
    if (files.length === 0) {
      statusMsg.textContent = 'Please add at least 1 image.';
      return;
    }

    convertBtn.disabled = true;
    adGate.run(files.length, async () => {
      await runConvert();
    }, statusMsg, `These ${files.length} image(s)`);
  });

  async function runConvert() {
    statusMsg.textContent = 'Building your PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const blob = await buildPdf((pct) => {
        progressBar.style.width = pct + '%';
      });

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'images.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = `Done! ${files.length} image(s) combined into one PDF.`;
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try again.';
      console.error(err);
    } finally {
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
