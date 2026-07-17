/* Image Format Converter — HEIC, WEBP, PNG, JPG, BMP, GIF, SVG in;
   JPG, PNG, or WEBP out. Uses heic2any for HEIC decoding since browsers
   can't natively decode HEIC; everything else uses the canvas. */

(function () {
  const dropzone = document.getElementById('dropzoneFmt');
  const fileInput = document.getElementById('fileInputFmt');
  const fmtOutputGroup = document.getElementById('fmtOutputGroup');
  let fmtOutputValue = 'jpg';
  const convertBtn = document.getElementById('fmtBtn');
  const statusMsg = document.getElementById('statusMsgFmt');
  const resultBox = document.getElementById('resultBoxFmt');
  const downloadLink = document.getElementById('downloadLinkFmt');

  if (!dropzone) return;

  if (fmtOutputGroup) {
    fmtOutputGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        fmtOutputGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fmtOutputValue = btn.dataset.value;
      });
    });
  }

  let selectedFile = null;

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
    const isHeic = /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
    if (!file.type.startsWith('image/') && !isHeic) {
      statusMsg.textContent = 'Please choose an image file.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose an image first.';
      return;
    }
    convertBtn.disabled = true;
    statusMsg.textContent = 'Converting...';

    try {
      let workingFile = selectedFile;
      const isHeic = /\.hei[cf]$/i.test(selectedFile.name) || selectedFile.type === 'image/heic' || selectedFile.type === 'image/heif';

      if (isHeic) {
        statusMsg.textContent = 'Decoding HEIC photo (this can take a moment)...';
        const convertedBlob = await heic2any({ blob: selectedFile, toType: 'image/jpeg', quality: 0.92 });
        workingFile = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      }

      const url = URL.createObjectURL(workingFile);
      const img = await loadImage(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (fmtOutputValue === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      const extMap = { jpg: 'jpg', png: 'png', webp: 'webp' };
      const outFormat = fmtOutputValue;

      canvas.toBlob((blob) => {
        if (!blob) {
          statusMsg.textContent = 'This browser could not produce that format. Try JPG or PNG instead.';
          convertBtn.disabled = false;
          return;
        }
        const outUrl = URL.createObjectURL(blob);
        downloadLink.href = outUrl;
        const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
        downloadLink.download = originalName + '.' + extMap[outFormat];
        resultBox.classList.add('show');
        statusMsg.textContent = 'Done! Converted to ' + outFormat.toUpperCase() + '.';
        statusMsg.className = 'status success';
        convertBtn.disabled = false;
      }, mimeMap[outFormat], 0.92);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this file. Please try a different image.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });
})();
