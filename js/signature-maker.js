/* Signature Maker — draw a signature with mouse/touch, or type one in a
   cursive font, then download as a transparent PNG. */

(function () {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const clearBtn = document.getElementById('sigClearBtn');
  const downloadBtn = document.getElementById('sigDownloadBtn');
  const colorSelect = document.getElementById('sigColor');
  const modeRadios = document.querySelectorAll('input[name="sigMode"]');
  const drawPanel = document.getElementById('sigDrawPanel');
  const typePanel = document.getElementById('sigTypePanel');
  const typeInput = document.getElementById('sigTypeInput');
  const fontSelect = document.getElementById('sigFont');
  const typePreview = document.getElementById('sigTypePreview');
  const statusMsg = document.getElementById('statusMsgSig');
  const resultBox = document.getElementById('resultBoxSig');
  const downloadLink = document.getElementById('downloadLinkSig');

  const uploadPanel = document.getElementById('sigUploadPanel');
  const dropzone = document.getElementById('sigDropzone');
  const uploadInput = document.getElementById('sigUploadInput');
  const removeBgCheckbox = document.getElementById('sigUploadRemoveBg');
  const uploadPreviewWrap = document.getElementById('sigUploadPreviewWrap');
  const uploadPreview = document.getElementById('sigUploadPreview');

  let drawing = false;
  let hasDrawn = false;
  let lastX = 0, lastY = 0;
  let uploadedImg = null;

  function removeWhiteBackground(imgEl, threshold, softness) {
    threshold = threshold || 235;
    softness = softness || 45;
    const c = document.createElement('canvas');
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const cx = c.getContext('2d');
    cx.drawImage(imgEl, 0, 0);
    const data = cx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (lum > threshold) {
        px[i + 3] = 0;
      } else if (lum > threshold - softness) {
        const t = (threshold - lum) / softness;
        px[i + 3] = Math.round(px[i + 3] * t);
      }
    }
    cx.putImageData(data, 0, 0);
    return c;
  }

  function renderUploadPreview() {
    if (!uploadedImg) return;
    uploadPreviewWrap.style.display = 'block';
    if (removeBgCheckbox.checked) {
      const c = removeWhiteBackground(uploadedImg);
      uploadPreview.width = c.width;
      uploadPreview.height = c.height;
      uploadPreview.getContext('2d').clearRect(0, 0, c.width, c.height);
      uploadPreview.getContext('2d').drawImage(c, 0, 0);
    } else {
      uploadPreview.width = uploadedImg.naturalWidth;
      uploadPreview.height = uploadedImg.naturalHeight;
      uploadPreview.getContext('2d').drawImage(uploadedImg, 0, 0);
    }
  }

  function handleUpload(file) {
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { uploadedImg = img; renderUploadPreview(); resultBox.classList.remove('show'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener('click', () => uploadInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
  });
  uploadInput.addEventListener('change', (e) => { if (e.target.files.length) handleUpload(e.target.files[0]); });
  removeBgCheckbox.addEventListener('change', renderUploadPreview);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resizeCanvas();

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function startDraw(e) {
    drawing = true;
    hasDrawn = true;
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
  }
  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.strokeStyle = colorSelect.value;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }
  function endDraw() { drawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: true });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    resultBox.classList.remove('show');
  });

  modeRadios.forEach((r) => r.addEventListener('change', () => {
    const mode = document.querySelector('input[name="sigMode"]:checked').value;
    drawPanel.style.display = mode === 'draw' ? 'block' : 'none';
    typePanel.style.display = mode === 'type' ? 'block' : 'none';
    uploadPanel.style.display = mode === 'upload' ? 'block' : 'none';
  }));

  function updateTypePreview() {
    typePreview.textContent = typeInput.value || 'Your Signature';
    typePreview.style.fontFamily = fontSelect.value;
    typePreview.style.color = colorSelect.value;
  }
  typeInput.addEventListener('input', updateTypePreview);
  fontSelect.addEventListener('change', updateTypePreview);
  colorSelect.addEventListener('change', updateTypePreview);
  updateTypePreview();

  downloadBtn.addEventListener('click', () => {
    const mode = document.querySelector('input[name="sigMode"]:checked').value;

    if (mode === 'draw') {
      if (!hasDrawn) {
        statusMsg.textContent = 'Please draw your signature first.';
        return;
      }
      canvas.toBlob((blob) => {
        finish(blob);
      }, 'image/png');
    } else if (mode === 'type') {
      const text = typeInput.value.trim() || 'Signature';
      const outCanvas = document.createElement('canvas');
      outCanvas.width = 700;
      outCanvas.height = 220;
      const octx = outCanvas.getContext('2d');
      octx.clearRect(0, 0, outCanvas.width, outCanvas.height);
      octx.font = '80px ' + fontSelect.value;
      octx.fillStyle = colorSelect.value;
      octx.textBaseline = 'middle';
      octx.textAlign = 'center';
      octx.fillText(text, outCanvas.width / 2, outCanvas.height / 2);
      outCanvas.toBlob((blob) => {
        finish(blob);
      }, 'image/png');
    } else if (mode === 'upload') {
      if (!uploadedImg) {
        statusMsg.textContent = 'Please upload a signature image first.';
        return;
      }
      const outCanvas = removeBgCheckbox.checked
        ? removeWhiteBackground(uploadedImg)
        : (() => {
            const c = document.createElement('canvas');
            c.width = uploadedImg.naturalWidth;
            c.height = uploadedImg.naturalHeight;
            c.getContext('2d').drawImage(uploadedImg, 0, 0);
            return c;
          })();
      outCanvas.toBlob((blob) => {
        finish(blob);
      }, 'image/png');
    }
  });

  function finish(blob) {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = 'signature.png';
    resultBox.classList.add('show');
    statusMsg.textContent = 'Done! Transparent PNG ready to download.';
    statusMsg.className = 'status success';
  }
})();
