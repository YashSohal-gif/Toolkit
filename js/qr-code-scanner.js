const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');
const previewImg = document.getElementById('previewImg');
const decodedText = document.getElementById('decodedText');
const copyBtn = document.getElementById('copyBtn');
const openLink = document.getElementById('openLink');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    statusMsg.textContent = 'Please upload an image file.';
    statusMsg.className = 'status error';
    return;
  }
  statusMsg.textContent = 'Scanning...';
  statusMsg.className = 'status';
  resultBox.classList.remove('show');

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        decodedText.value = code.data;
        if (/^https?:\/\//i.test(code.data)) {
          openLink.href = code.data;
          openLink.style.display = 'inline-block';
        } else {
          openLink.style.display = 'none';
        }
        statusMsg.textContent = 'QR code decoded successfully.';
        statusMsg.className = 'status success';
        resultBox.classList.add('show');
      } else {
        statusMsg.textContent = 'No QR code found in this image. Try a clearer photo.';
        statusMsg.className = 'status error';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

copyBtn.addEventListener('click', () => {
  decodedText.select();
  navigator.clipboard.writeText(decodedText.value).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Text'; }, 1500);
  });
});
