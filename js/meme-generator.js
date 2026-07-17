/* Meme Generator — classic top/bottom caption meme maker. Draws bold,
   uppercase, white-with-black-outline text at the top and bottom of the
   uploaded photo, with a live preview. Runs fully in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneMeme');
  const fileInput = document.getElementById('fileInputMeme');
  const memeTop = document.getElementById('memeTop');
  const memeBottom = document.getElementById('memeBottom');
  const previewCanvas = document.getElementById('memePreviewCanvas');
  const memeBtn = document.getElementById('memeBtn');
  const statusMsg = document.getElementById('statusMsgMeme');
  const resultBox = document.getElementById('resultBoxMeme');
  const downloadLink = document.getElementById('downloadLinkMeme');

  if (!dropzone) return;

  let img = null;
  let selectedFile = null;

  [memeTop, memeBottom].forEach(el => el.addEventListener('input', renderPreview));

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

  function drawCaptionedText(ctx, text, x, y, fontSize) {
    ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = fontSize / 12;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(text.toUpperCase(), x, y);
    ctx.fillText(text.toUpperCase(), x, y);
  }

  function drawMeme(canvas) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const fontSize = Math.max(20, canvas.width * 0.08);
    const topText = memeTop.value.trim();
    const bottomText = memeBottom.value.trim();

    if (topText) {
      drawCaptionedText(ctx, topText, canvas.width / 2, fontSize * 1.1, fontSize);
    }
    if (bottomText) {
      drawCaptionedText(ctx, bottomText, canvas.width / 2, canvas.height - fontSize * 0.4, fontSize);
    }
  }

  function renderPreview() {
    if (!img) return;
    drawMeme(previewCanvas);
    const maxW = 460;
    const scale = Math.min(1, maxW / previewCanvas.width);
    previewCanvas.style.width = (previewCanvas.width * scale) + 'px';
    previewCanvas.style.height = (previewCanvas.height * scale) + 'px';
  }

  memeBtn.addEventListener('click', () => {
    if (!img) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    const outCanvas = document.createElement('canvas');
    drawMeme(outCanvas);
    outCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = `${originalName}-meme.png`;
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your meme is ready.';
      statusMsg.className = 'status success';
    }, 'image/png');
  });
})();
