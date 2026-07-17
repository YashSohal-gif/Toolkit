const qrText = document.getElementById('qrText');
const qrSizeGroup = document.getElementById('qrSizeGroup');
let qrSizeValue = 300;
const qrColor = document.getElementById('qrColor');
const qrBgColor = document.getElementById('qrBgColor');
const qrEcLevel = document.getElementById('qrEcLevel');
const qrFormat = document.getElementById('qrFormat');
const generateBtn = document.getElementById('generateBtn');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');
const qrCanvasHost = document.getElementById('qrCanvasHost');
const downloadLink = document.getElementById('downloadLink');

if (qrSizeGroup) {
  qrSizeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      qrSizeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      qrSizeValue = parseInt(btn.dataset.value, 10);
    });
  });
}

generateBtn.addEventListener('click', () => {
  const text = qrText.value.trim();
  if (!text) {
    statusMsg.textContent = 'Please enter some text or a link to encode.';
    statusMsg.className = 'status error';
    resultBox.classList.remove('show');
    return;
  }
  statusMsg.textContent = '';
  statusMsg.className = 'status';

  const size = qrSizeValue;
  const color = qrColor.value;
  const bgColor = qrBgColor ? qrBgColor.value : '#ffffff';
  const ecName = qrEcLevel ? qrEcLevel.value : 'H';
  const ecLevel = QRCode.CorrectLevel[ecName] !== undefined ? QRCode.CorrectLevel[ecName] : QRCode.CorrectLevel.H;

  qrCanvasHost.innerHTML = '';
  new QRCode(qrCanvasHost, {
    text: text,
    width: size,
    height: size,
    colorDark: color,
    colorLight: bgColor,
    correctLevel: ecLevel
  });

  setTimeout(() => {
    const canvas = qrCanvasHost.querySelector('canvas');
    const img = qrCanvasHost.querySelector('img');
    const fmt = qrFormat ? qrFormat.value : 'png';

    let dataUrl = null;
    if (canvas) {
      if (fmt === 'jpg') {
        /* Flatten onto the chosen background — JPG has no transparency */
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        dataUrl = out.toDataURL('image/jpeg', 0.95);
      } else {
        dataUrl = canvas.toDataURL('image/png');
      }
    } else if (img) {
      dataUrl = img.src;
    }
    if (dataUrl) {
      downloadLink.href = dataUrl;
      downloadLink.download = 'qrcode.' + (fmt === 'jpg' ? 'jpg' : 'png');
      downloadLink.textContent = '⬇ Download QR Code (' + fmt.toUpperCase() + ')';
    }
    resultBox.classList.add('show');
  }, 150);
});
