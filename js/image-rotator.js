/* Image Rotator — rotates the uploaded image 90/180/270 degrees by redrawing
   it onto a correctly-sized rotated canvas (swapping width/height for 90/270),
   so there's no quality loss. Runs fully in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneRotate');
  const fileInput = document.getElementById('fileInputRotate');
  const angleGroup = document.getElementById('rotateAngleGroup');
  let angleValue = 90;
  const previewCanvas = document.getElementById('rotatePreviewCanvas');
  const rotateBtn = document.getElementById('rotateBtn');
  const statusMsg = document.getElementById('statusMsgRotate');
  const resultBox = document.getElementById('resultBoxRotate');
  const downloadLink = document.getElementById('downloadLinkRotate');

  if (!dropzone) return;

  let img = null;
  let selectedFile = null;

  if (angleGroup) {
    angleGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        angleGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        angleValue = parseInt(btn.dataset.value, 10);
        renderPreview();
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

  function drawRotated(canvas, angle) {
    const rad = (angle * Math.PI) / 180;
    const swap = angle === 90 || angle === 270;
    canvas.width = swap ? img.naturalHeight : img.naturalWidth;
    canvas.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }

  function renderPreview() {
    if (!img) return;
    const maxW = 420;
    const scale = Math.min(1, maxW / (angleValue === 90 || angleValue === 270 ? img.naturalHeight : img.naturalWidth));
    drawRotated(previewCanvas, angleValue);
    previewCanvas.style.width = (previewCanvas.width * scale) + 'px';
    previewCanvas.style.height = (previewCanvas.height * scale) + 'px';
  }

  rotateBtn.addEventListener('click', () => {
    if (!img) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    const outCanvas = document.createElement('canvas');
    drawRotated(outCanvas, angleValue);
    outCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-rotated-${angleValue}.png`;
      resultBox.classList.add('show');
      statusMsg.textContent = `Done! Rotated ${angleValue}°.`;
      statusMsg.className = 'status success';
    }, 'image/png');
  });
})();
