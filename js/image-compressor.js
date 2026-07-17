/* Image Compressor Engine
   Compresses one or more image files down to (as close as possible to) a
   target file size in KB, entirely in the browser — no upload to any
   server. A single file downloads directly; multiple files are zipped.
*/

(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileListEl = document.getElementById('fileListCompress');
  const targetSizeInput = document.getElementById('targetSize');
  const targetUnitGroup = document.getElementById('targetUnit');
  let targetUnitValue = 'KB';
  const compressBtn = document.getElementById('compressBtn');
  const statusMsg = document.getElementById('statusMsg');
  const resultBox = document.getElementById('resultBox');
  const originalSizeEl = document.getElementById('originalSize');
  const compressedSizeEl = document.getElementById('compressedSize');
  const downloadLink = document.getElementById('downloadLink');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const batchProgressLabel = document.getElementById('batchProgressLabel');
  const beforeAfterWrap = document.getElementById('beforeAfterWrap');
  const baSlider = document.getElementById('baSlider');
  const baBefore = document.getElementById('baBefore');
  const baAfter = document.getElementById('baAfter');

  let files = [];

  if (!dropzone) return; // page doesn't have the tool

  if (targetUnitGroup) {
    targetUnitGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        targetUnitGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetUnitValue = btn.dataset.value;
      });
    });
  }

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
  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  function addFiles(fileListObj) {
    for (const f of fileListObj) {
      if (f.type.startsWith('image/')) files.push(f);
    }
    renderFileList();
  }

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = '';
    files.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'file-list-item';
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
    dropzone.querySelector('p').textContent = files.length
      ? files.length + ' image(s) selected'
      : 'Click or drag & drop one or more images here (JPG or PNG)';
    resultBox.classList.remove('show');
    beforeAfterWrap.style.display = 'none';
    statusMsg.textContent = '';
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality, mime) {
    return new Promise((resolve) => canvas.toBlob(resolve, mime || 'image/jpeg', quality));
  }

  function getOptions() {
    const fmtSel = document.getElementById('outputFormat');
    const maxDimSel = document.getElementById('maxDimension');
    const keepDims = document.getElementById('keepDimensions');
    return {
      mime: fmtSel ? fmtSel.value : 'image/jpeg',
      maxDim: maxDimSel ? parseInt(maxDimSel.value, 10) : 0,
      keepDimensions: keepDims ? keepDims.checked : false
    };
  }

  async function compressToTarget(file, targetKB, onProgress) {
    const opts = getOptions();
    const img = await loadImage(file);
    let width = img.width;
    let height = img.height;

    /* Optional pre-resize: cap the longest side before compressing */
    if (opts.maxDim > 0 && Math.max(width, height) > opts.maxDim) {
      const scale = opts.maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const isLossless = opts.mime === 'image/png';
    let quality = 0.9;
    let blob = null;
    let attempts = 0;
    const maxAttempts = 25;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // Phase 1: reduce quality — meaningless for PNG (lossless, no quality
    // knob), so just encode once and let phase 2's downscaling do the work.
    if (isLossless) {
      blob = await canvasToBlob(canvas, undefined, opts.mime);
      onProgress(60);
    } else {
      while (attempts < maxAttempts) {
        blob = await canvasToBlob(canvas, quality, opts.mime);
        attempts++;
        onProgress(Math.min(90, (attempts / maxAttempts) * 60));
        if (blob.size / 1024 <= targetKB || quality <= 0.05) break;
        quality -= 0.06;
      }
    }

    // Phase 2: if still too big, progressively downscale dimensions
    // (skipped when the user locked the exact dimensions)
    let scaleAttempts = 0;
    while (!opts.keepDimensions && blob.size / 1024 > targetKB && scaleAttempts < 10) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      if (width < 20 || height < 20) break;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      if (isLossless) {
        blob = await canvasToBlob(canvas, undefined, opts.mime);
      } else {
        quality = 0.85;
        for (let i = 0; i < 12; i++) {
          blob = await canvasToBlob(canvas, quality, opts.mime);
          if (blob.size / 1024 <= targetKB || quality <= 0.05) break;
          quality -= 0.07;
        }
      }
      scaleAttempts++;
      onProgress(60 + Math.min(35, (scaleAttempts / 10) * 35));
    }

    onProgress(100);
    return blob;
  }

  function extFor(mime) {
    return mime === 'image/webp' ? 'webp' : (mime === 'image/png' ? 'png' : 'jpg');
  }

  compressBtn.addEventListener('click', async () => {
    if (files.length === 0) {
      statusMsg.textContent = 'Please choose at least one image first.';
      return;
    }
    const rawTarget = parseFloat(targetSizeInput.value);
    if (!rawTarget || rawTarget <= 0) {
      statusMsg.textContent = 'Please enter a valid target size.';
      return;
    }
    const unit = targetUnitValue;
    const targetKB = unit === 'MB' ? rawTarget * 1024 : rawTarget;

    compressBtn.disabled = true;
    statusMsg.textContent = 'Compressing... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    beforeAfterWrap.style.display = 'none';

    try {
      if (files.length === 1) {
        // Single file: identical to the original single-file experience,
        // plus a before/after slider since there's exactly one result to compare.
        const file = files[0];
        const blob = await compressToTarget(file, targetKB, (pct) => {
          progressBar.style.width = pct + '%';
        });

        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        const originalName = file.name.replace(/\.[^/.]+$/, '');
        downloadLink.download = `${originalName}-compressed.${extFor(blob.type)}`;

        originalSizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
        compressedSizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';

        if (baBefore.src && baBefore.src.startsWith('blob:')) URL.revokeObjectURL(baBefore.src);
        if (baAfter.src && baAfter.src.startsWith('blob:')) URL.revokeObjectURL(baAfter.src);
        baBefore.src = URL.createObjectURL(file);
        baAfter.src = url;
        beforeAfterWrap.style.display = '';
        baSlider.style.setProperty('--ba-pos', '50%');
        setupBeforeAfterSlider(baSlider);

        resultBox.classList.add('show');
        const achieved = blob.size / 1024;
        if (achieved <= targetKB * 1.05) {
          statusMsg.textContent = 'Done! Your image is ready to download.';
          statusMsg.className = 'status success';
        } else {
          statusMsg.textContent = 'Compressed as much as possible while keeping it usable — could not fully reach the target without losing too much quality.';
          statusMsg.className = 'status';
        }
      } else {
        // Batch: compress every file to the same target, zip the results.
        batchProgressLabel.style.display = 'block';
        const zip = new JSZip();
        let totalOriginal = 0, totalCompressed = 0, failCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          batchProgressLabel.textContent = `Compressing ${i + 1} of ${files.length}: ${file.name}`;
          try {
            const blob = await compressToTarget(file, targetKB, (pct) => {
              progressBar.style.width = (((i + pct / 100) / files.length) * 100) + '%';
            });
            const originalName = file.name.replace(/\.[^/.]+$/, '');
            zip.file(`${originalName}-compressed.${extFor(blob.type)}`, blob);
            totalOriginal += file.size;
            totalCompressed += blob.size;
          } catch (err) {
            console.error('Failed to compress ' + file.name, err);
            failCount++;
          }
        }

        batchProgressLabel.textContent = 'Packaging ZIP...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        downloadLink.href = url;
        downloadLink.download = 'compressed-images.zip';

        originalSizeEl.textContent = (totalOriginal / 1024).toFixed(1) + ' KB (total)';
        compressedSizeEl.textContent = (totalCompressed / 1024).toFixed(1) + ' KB (total)';

        resultBox.classList.add('show');
        const okCount = files.length - failCount;
        statusMsg.textContent = failCount
          ? `Done! ${okCount} of ${files.length} image(s) compressed and zipped (${failCount} failed).`
          : `Done! ${okCount} image(s) compressed and zipped, ready to download.`;
        statusMsg.className = 'status success';
        batchProgressLabel.style.display = 'none';
      }
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different image.';
      console.error(err);
    } finally {
      compressBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
