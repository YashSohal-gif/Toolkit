/* Image Cropper — drag-to-select a rectangle on the displayed image, with
   linked X/Y/Width/Height number fields for pixel-precise adjustment.
   The final crop is drawn from the full-resolution source image, so quality
   is not lost even though the on-screen preview may be scaled down. */

(function () {
  const dropzone = document.getElementById('dropzoneCrop');
  const fileInput = document.getElementById('fileInputCrop');
  const cropStepLabel = document.getElementById('cropStepLabel');
  const cropStep3Label = document.getElementById('cropStep3Label');
  const cropWorkspace = document.getElementById('cropWorkspace');
  const cropContainer = document.getElementById('cropContainer');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropSelection = document.getElementById('cropSelection');
  const cropX = document.getElementById('cropX');
  const cropY = document.getElementById('cropY');
  const cropW = document.getElementById('cropW');
  const cropH = document.getElementById('cropH');
  const cropResetBtn = document.getElementById('cropResetBtn');
  const cropActionRow = document.getElementById('cropActionRow');
  const cropBtn = document.getElementById('cropBtn');
  const statusMsg = document.getElementById('statusMsgCrop');
  const resultBox = document.getElementById('resultBoxCrop');
  const previewImg = document.getElementById('cropPreviewImg');
  const downloadLink = document.getElementById('downloadLinkCrop');

  if (!dropzone) return;

  let img = null;
  let scale = 1; /* displayed px per natural px */
  let selection = null; /* {x, y, w, h} in NATURAL image pixels */
  let dragging = false;
  let dragStart = null;

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
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Loading image...';

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      img = image;
      const maxW = 640;
      scale = Math.min(1, maxW / img.naturalWidth);
      const dispW = Math.round(img.naturalWidth * scale);
      const dispH = Math.round(img.naturalHeight * scale);

      cropCanvas.width = dispW;
      cropCanvas.height = dispH;
      const ctx = cropCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, dispW, dispH);

      selection = null;
      cropSelection.style.display = 'none';
      cropWorkspace.style.display = '';
      cropStepLabel.style.display = '';
      cropStep3Label.style.display = '';
      cropActionRow.style.display = '';
      statusMsg.textContent = `Loaded — ${img.naturalWidth} x ${img.naturalHeight}px. Drag on the image to select a crop area.`;
      statusMsg.className = 'status success';
    };
    image.src = url;
  }

  function setSelectionFromDisplayRect(dx, dy, dw, dh) {
    /* Convert displayed (on-screen) rect to natural-resolution pixels. */
    selection = {
      x: Math.round(dx / scale),
      y: Math.round(dy / scale),
      w: Math.round(dw / scale),
      h: Math.round(dh / scale)
    };
    updateOverlay();
    updateFields();
  }

  function updateOverlay() {
    if (!selection) { cropSelection.style.display = 'none'; return; }
    cropSelection.style.display = 'block';
    cropSelection.style.left = (selection.x * scale) + 'px';
    cropSelection.style.top = (selection.y * scale) + 'px';
    cropSelection.style.width = (selection.w * scale) + 'px';
    cropSelection.style.height = (selection.h * scale) + 'px';
  }

  function updateFields() {
    if (!selection) return;
    cropX.value = selection.x;
    cropY.value = selection.y;
    cropW.value = selection.w;
    cropH.value = selection.h;
  }

  cropCanvas.addEventListener('mousedown', (e) => {
    if (!img) return;
    const rect = cropCanvas.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging = true;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !img) return;
    const rect = cropCanvas.getBoundingClientRect();
    const curX = Math.max(0, Math.min(cropCanvas.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(cropCanvas.height, e.clientY - rect.top));
    const dx = Math.min(dragStart.x, curX);
    const dy = Math.min(dragStart.y, curY);
    const dw = Math.abs(curX - dragStart.x);
    const dh = Math.abs(curY - dragStart.y);
    setSelectionFromDisplayRect(dx, dy, dw, dh);
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  [cropX, cropY, cropW, cropH].forEach(input => {
    input.addEventListener('input', () => {
      if (!img) return;
      selection = {
        x: parseInt(cropX.value, 10) || 0,
        y: parseInt(cropY.value, 10) || 0,
        w: parseInt(cropW.value, 10) || 1,
        h: parseInt(cropH.value, 10) || 1
      };
      updateOverlay();
    });
  });

  cropResetBtn.addEventListener('click', () => {
    selection = null;
    cropSelection.style.display = 'none';
    cropX.value = cropY.value = cropW.value = cropH.value = '';
    resultBox.classList.remove('show');
  });

  cropBtn.addEventListener('click', () => {
    if (!img) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    if (!selection || selection.w < 1 || selection.h < 1) {
      statusMsg.textContent = 'Please drag to select a crop area first.';
      return;
    }

    const sx = Math.max(0, Math.min(selection.x, img.naturalWidth - 1));
    const sy = Math.max(0, Math.min(selection.y, img.naturalHeight - 1));
    const sw = Math.min(selection.w, img.naturalWidth - sx);
    const sh = Math.min(selection.h, img.naturalHeight - sy);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    outCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      previewImg.src = url;
      downloadLink.href = url;
      downloadLink.download = 'cropped.png';
      resultBox.classList.add('show');
      statusMsg.textContent = `Done! Cropped to ${sw} x ${sh}px.`;
      statusMsg.className = 'status success';
    }, 'image/png');
  });
})();
