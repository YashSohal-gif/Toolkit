/* Watermark Image — stamps text over an uploaded photo, with live preview
   as the user adjusts position, size, opacity, color, and rotation.
   Runs fully in the browser via canvas. */

(function () {
  const dropzone = document.getElementById('dropzoneWm');
  const fileInput = document.getElementById('fileInputWm');
  const wmText = document.getElementById('wmText');
  const wmColor = document.getElementById('wmColor');
  const positionGroup = document.getElementById('wmPositionGroup');
  let positionValue = 'center';
  const wmSize = document.getElementById('wmSize');
  const wmOpacity = document.getElementById('wmOpacity');
  const wmAngle = document.getElementById('wmAngle');
  const previewCanvas = document.getElementById('wmPreviewCanvas');
  const wmBtn = document.getElementById('wmBtn');
  const statusMsg = document.getElementById('statusMsgWm');
  const resultBox = document.getElementById('resultBoxWm');
  const downloadLink = document.getElementById('downloadLinkWm');

  if (!dropzone) return;

  let img = null;
  let selectedFile = null;

  if (positionGroup) {
    positionGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        positionGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        positionValue = btn.dataset.value;
        renderPreview();
      });
    });
  }

  [wmText, wmColor, wmSize, wmOpacity, wmAngle].forEach(el => el.addEventListener('input', renderPreview));

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
    selectedFile = file;
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name;
    resultBox.classList.remove('show');

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      img = image;
      renderPreview();
      statusMsg.textContent = `Loaded — ${img.naturalWidth} x ${img.naturalHeight}px.`;
      statusMsg.className = 'status success';
    };
    image.src = url;
  }

  function drawWatermark(canvas) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const text = wmText.value || 'SAMPLE';
    const fontSize = Math.max(10, (parseFloat(wmSize.value) / 100) * canvas.width);
    const opacity = parseFloat(wmOpacity.value) / 100;
    const angleDeg = parseFloat(wmAngle.value);
    const angleRad = (angleDeg * Math.PI) / 180;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = wmColor.value;
    ctx.globalAlpha = opacity;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    function stampAt(x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angleRad);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    const pad = fontSize;
    if (positionValue === 'tile') {
      const stepX = ctx.measureText(text).width + fontSize * 2;
      const stepY = fontSize * 3;
      for (let y = stepY / 2; y < canvas.height + stepY; y += stepY) {
        for (let x = stepX / 2; x < canvas.width + stepX; x += stepX) {
          stampAt(x, y);
        }
      }
    } else if (positionValue === 'tl') {
      ctx.textAlign = 'left'; stampAt(pad, pad);
    } else if (positionValue === 'tr') {
      ctx.textAlign = 'right'; stampAt(canvas.width - pad, pad);
    } else if (positionValue === 'bl') {
      ctx.textAlign = 'left'; stampAt(pad, canvas.height - pad);
    } else if (positionValue === 'br') {
      ctx.textAlign = 'right'; stampAt(canvas.width - pad, canvas.height - pad);
    } else {
      stampAt(canvas.width / 2, canvas.height / 2);
    }

    ctx.globalAlpha = 1;
  }

  function renderPreview() {
    if (!img) return;
    drawWatermark(previewCanvas);
    const maxW = 460;
    const scale = Math.min(1, maxW / previewCanvas.width);
    previewCanvas.style.width = (previewCanvas.width * scale) + 'px';
    previewCanvas.style.height = (previewCanvas.height * scale) + 'px';
  }

  wmBtn.addEventListener('click', () => {
    if (!img) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    const outCanvas = document.createElement('canvas');
    drawWatermark(outCanvas);
    outCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-watermarked.png`;
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Watermark applied.';
      statusMsg.className = 'status success';
    }, 'image/png');
  });
})();
