/* Image Upscaler — honest resolution increase via incremental (step-wise,
   never more than 2x per step) high-quality canvas interpolation. This is
   NOT an AI super-resolution model — it doesn't invent new detail, it just
   resizes as cleanly as possible using the browser's bicubic-like smoothing. */

(function () {
  const dropzone = document.getElementById('dropzoneUpscale');
  const fileInput = document.getElementById('fileInputUpscale');
  const targetField = document.getElementById('upscaleTargetField');
  const targetGroup = document.getElementById('upscaleTargetGroup');
  const dimsInfo = document.getElementById('upscaleDimsInfo');
  const controls = document.getElementById('upscaleControls');
  const upscaleBtn = document.getElementById('upscaleBtn');
  const statusMsg = document.getElementById('statusMsgUpscale');
  const resultBox = document.getElementById('resultBoxUpscale');
  const newDimsEl = document.getElementById('newDimsUpscale');
  const downloadLink = document.getElementById('downloadLinkUpscale');
  const progressWrap = document.getElementById('progressWrapUpscale');
  const progressBar = document.getElementById('progressBarUpscale');

  if (!dropzone) return;

  let selectedFile = null;
  let sourceImage = null;
  let targetValue = '2';

  const FOUR_K_LONG_EDGE = 3840;

  targetGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      targetGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      targetValue = btn.dataset.value;
      updateDimsInfo();
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
    if (!file.type.startsWith('image/')) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    selectedFile = file;
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + img.width + '×' + img.height + ')';
      resultBox.classList.remove('show');
      targetField.style.display = '';
      controls.style.display = '';
      dimsInfo.style.display = '';
      statusMsg.textContent = '';
      updateDimsInfo();
    };
    img.onerror = () => { statusMsg.textContent = 'Could not load this image.'; };
    img.src = URL.createObjectURL(file);
  }

  function computeTargetDims() {
    if (!sourceImage) return { w: 0, h: 0 };
    const w = sourceImage.width, h = sourceImage.height;
    if (targetValue === '2') return { w: w * 2, h: h * 2 };
    if (targetValue === '4') return { w: w * 4, h: h * 4 };
    // 4k: scale so the longer edge reaches 3840px, but never shrink
    const longEdge = Math.max(w, h);
    const scale = Math.max(1, FOUR_K_LONG_EDGE / longEdge);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function updateDimsInfo() {
    const dims = computeTargetDims();
    dimsInfo.textContent = 'Original ' + sourceImage.width + '×' + sourceImage.height + ' → New ' + dims.w + '×' + dims.h;
  }

  function upscaleStepwise(img, targetW, targetH) {
    let curW = img.width, curH = img.height;
    let curCanvas = document.createElement('canvas');
    curCanvas.width = curW;
    curCanvas.height = curH;
    curCanvas.getContext('2d').drawImage(img, 0, 0);

    while (curW < targetW || curH < targetH) {
      const nextW = Math.min(targetW, curW * 2);
      const nextH = Math.min(targetH, curH * 2);
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nextW;
      nextCanvas.height = nextH;
      const ctx = nextCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(curCanvas, 0, 0, nextW, nextH);
      curCanvas = nextCanvas;
      curW = nextW;
      curH = nextH;
    }
    return curCanvas;
  }

  upscaleBtn.addEventListener('click', () => {
    if (!sourceImage) {
      statusMsg.textContent = 'Please choose a photo first.';
      return;
    }
    upscaleBtn.disabled = true;
    adGate.run(1, async () => {
      await runUpscale();
    }, statusMsg, 'This upscale');
  });

  async function runUpscale() {
    statusMsg.textContent = 'Upscaling... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '30%';

    try {
      const dims = computeTargetDims();
      const canvas = upscaleStepwise(sourceImage, dims.w, dims.h);
      progressBar.style.width = '90%';

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-upscaled.jpg';

      newDimsEl.textContent = canvas.width + '×' + canvas.height;
      progressBar.style.width = '100%';
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Resized to ' + canvas.width + '×' + canvas.height + '.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong upscaling this photo. Please try again.';
      console.error(err);
    } finally {
      upscaleBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
