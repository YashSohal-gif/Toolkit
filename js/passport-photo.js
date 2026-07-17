/* Passport / ID Photo Maker
   Pan + zoom crop tool with standard ID photo size presets.
   Exports a single cropped photo at the correct pixel size, plus an
   optional 4x6 inch print sheet tiled with multiple copies. */

(function () {
  const dropzone = document.getElementById('dropzonePP');
  const fileInput = document.getElementById('fileInputPP');
  const presetSelect = document.getElementById('ppPreset');
  const customFields = document.getElementById('ppCustomFields');
  const customW = document.getElementById('ppCustomW');
  const customH = document.getElementById('ppCustomH');
  const cropFrame = document.getElementById('ppCropFrame');
  const cropImg = document.getElementById('ppCropImg');
  const zoomSlider = document.getElementById('ppZoom');
  const downloadBtn = document.getElementById('ppDownloadBtn');
  const sheetBtn = document.getElementById('ppSheetBtn');
  const statusMsg = document.getElementById('statusMsgPP');
  const resultBox = document.getElementById('resultBoxPP');
  const downloadLink = document.getElementById('downloadLinkPP');

  if (!dropzone) return;

  const PRESETS = {
    'india-passport': { label: 'Indian Passport (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'us-passport': { label: 'US Passport / Visa (2 x 2 in)', wmm: 50.8, hmm: 50.8 },
    'uk-passport': { label: 'UK Passport (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'canada-passport': { label: 'Canada Passport (5 x 7 cm)', wmm: 50, hmm: 70 },
    'australia-passport': { label: 'Australia Passport (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'schengen-visa': { label: 'Schengen Visa (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'china-visa': { label: 'China Visa (3.3 x 4.8 cm)', wmm: 33, hmm: 48 },
    'nigeria-passport': { label: 'Nigeria Passport (2 x 2 in)', wmm: 50.8, hmm: 50.8 },
    'pan-card': { label: 'PAN Card Photo (2.5 x 3.5 cm)', wmm: 25, hmm: 35 },
    'aadhaar-card': { label: 'Aadhaar Card (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'voter-id': { label: 'Voter ID / EPIC (2.5 x 3.5 cm)', wmm: 25, hmm: 35 },
    'driving-licence-india': { label: 'Driving Licence India (3.5 x 4.5 cm)', wmm: 35, hmm: 45 },
    'stamp': { label: 'Stamp Size (2 x 2.5 cm)', wmm: 20, hmm: 25 },
    'custom': { label: 'Custom size (mm)', wmm: 35, hmm: 45 }
  };

  function mmToPx(mm) {
    return Math.round((mm / 25.4) * 300); // 300 DPI
  }

  let img = new Image();
  let imgLoaded = false;
  let dispW = 0, dispH = 0, baseScale = 1, tx = 0, ty = 0, zoom = 1;
  let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

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

  function getTargetMM() {
    const key = presetSelect.value;
    if (key === 'custom') {
      const w = parseFloat(customW.value) || 35;
      const h = parseFloat(customH.value) || 45;
      return { wmm: w, hmm: h };
    }
    return PRESETS[key];
  }

  function updateFrameShape() {
    const { wmm, hmm } = getTargetMM();
    const frameMaxHeight = 320;
    const aspect = wmm / hmm;
    let frameH = frameMaxHeight;
    let frameW = frameH * aspect;
    if (frameW > 320) {
      frameW = 320;
      frameH = frameW / aspect;
    }
    cropFrame.style.width = frameW + 'px';
    cropFrame.style.height = frameH + 'px';
    if (imgLoaded) positionImageCentered();
  }

  presetSelect.addEventListener('change', () => {
    customFields.style.display = presetSelect.value === 'custom' ? 'flex' : 'none';
    updateFrameShape();
  });
  customW.addEventListener('input', updateFrameShape);
  customH.addEventListener('input', updateFrameShape);

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    const url = URL.createObjectURL(file);
    img = new Image();
    img.onload = () => {
      imgLoaded = true;
      cropImg.src = url;
      cropFrame.classList.add('has-image');
      zoom = 1;
      zoomSlider.value = 1;
      updateFrameShape();
      resultBox.classList.remove('show');
      statusMsg.textContent = 'Drag the photo to reposition, use the zoom slider, then download.';
    };
    img.src = url;
  }

  function positionImageCentered() {
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    baseScale = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
    const scale = baseScale * zoom;
    dispW = img.naturalWidth * scale;
    dispH = img.naturalHeight * scale;
    tx = (frameW - dispW) / 2;
    ty = (frameH - dispH) / 2;
    applyTransform();
  }

  function clampPan() {
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    const minTx = frameW - dispW;
    const minTy = frameH - dispH;
    tx = Math.min(0, Math.max(minTx, tx));
    ty = Math.min(0, Math.max(minTy, ty));
  }

  function applyTransform() {
    cropImg.style.width = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    cropImg.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
  }

  zoomSlider.addEventListener('input', () => {
    if (!imgLoaded) return;
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    const oldDispW = dispW, oldDispH = dispH;
    zoom = parseFloat(zoomSlider.value);
    const scale = baseScale * zoom;
    dispW = img.naturalWidth * scale;
    dispH = img.naturalHeight * scale;
    // keep the frame center point stable while zooming
    const cx = frameW / 2 - tx;
    const cy = frameH / 2 - ty;
    const ratioX = cx / oldDispW;
    const ratioY = cy / oldDispH;
    tx = frameW / 2 - ratioX * dispW;
    ty = frameH / 2 - ratioY * dispH;
    clampPan();
    applyTransform();
  });

  function startDrag(x, y) {
    if (!imgLoaded) return;
    dragging = true;
    startX = x; startY = y;
    startTx = tx; startTy = ty;
  }
  function moveDrag(x, y) {
    if (!dragging) return;
    tx = startTx + (x - startX);
    ty = startTy + (y - startY);
    clampPan();
    applyTransform();
  }
  function endDrag() { dragging = false; }

  cropFrame.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);
  cropFrame.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', endDrag);

  function renderCroppedCanvas() {
    const { wmm, hmm } = getTargetMM();
    const targetW = mmToPx(wmm);
    const targetH = mmToPx(hmm);
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    const scale = baseScale * zoom;

    const sx = -tx / scale;
    const sy = -ty / scale;
    const sw = frameW / scale;
    const sh = frameH / scale;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    return { canvas, targetW, targetH };
  }

  downloadBtn.addEventListener('click', () => {
    if (!imgLoaded) {
      statusMsg.textContent = 'Please choose a photo first.';
      return;
    }
    const { canvas, targetW, targetH } = renderCroppedCanvas();
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'id-photo.jpg';
      downloadLink.textContent = '⬇ Download Photo (' + targetW + '×' + targetH + 'px)';
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your ID photo is ready.';
      statusMsg.className = 'status success';
    }, 'image/jpeg', 0.95);
  });

  sheetBtn.addEventListener('click', () => {
    if (!imgLoaded) {
      statusMsg.textContent = 'Please choose a photo first.';
      return;
    }
    const { canvas: photoCanvas, targetW, targetH } = renderCroppedCanvas();

    const sheetW = 1800, sheetH = 1200; // 6x4 in at 300 DPI
    const margin = 30, gap = 20;
    const cols = Math.max(1, Math.floor((sheetW - margin * 2 + gap) / (targetW + gap)));
    const rows = Math.max(1, Math.floor((sheetH - margin * 2 + gap) / (targetH + gap)));

    const sheet = document.createElement('canvas');
    sheet.width = sheetW;
    sheet.height = sheetH;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    const gridW = cols * targetW + (cols - 1) * gap;
    const gridH = rows * targetH + (rows - 1) * gap;
    const offsetX = (sheetW - gridW) / 2;
    const offsetY = (sheetH - gridH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * (targetW + gap);
        const y = offsetY + r * (targetH + gap);
        ctx.drawImage(photoCanvas, x, y, targetW, targetH);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, targetW, targetH);
      }
    }

    sheet.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'id-photo-print-sheet.jpg';
      downloadLink.textContent = '⬇ Download Print Sheet (' + (cols * rows) + ' copies, 6×4in)';
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your print sheet has ' + (cols * rows) + ' copies ready for a photo printer.';
      statusMsg.className = 'status success';
    }, 'image/jpeg', 0.95);
  });
})();
