const modeGroup = document.getElementById('modeGroup');
let modeValue = 'encode';
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const statusMsg = document.getElementById('statusMsg');
const copyBtn = document.getElementById('copyBtn');
const swapBtn = document.getElementById('swapBtn');

function setModeUI(value) {
  modeGroup.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === value));
  modeValue = value;
}

if (modeGroup) {
  modeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      setModeUI(btn.dataset.value);
      convert();
    });
  });
}

function convert() {
  const val = inputText.value;
  statusMsg.textContent = '';
  statusMsg.className = 'status';
  if (!val) { outputText.value = ''; return; }

  try {
    if (modeValue === 'encode') {
      outputText.value = btoa(unescape(encodeURIComponent(val)));
    } else {
      outputText.value = decodeURIComponent(escape(atob(val)));
    }
  } catch (err) {
    outputText.value = '';
    statusMsg.textContent = modeValue === 'decode' ? 'Invalid Base64 input.' : 'Could not encode this text.';
    statusMsg.className = 'status error';
  }
}

inputText.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  setModeUI(modeValue === 'encode' ? 'decode' : 'encode');
  const tmp = inputText.value;
  inputText.value = outputText.value;
  convert();
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputText.value).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Output'; }, 1500);
  });
});
