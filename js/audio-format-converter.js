const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const outputFormatGroup = document.getElementById('outputFormatGroup');
let outputFormatValue = 'mp3';
const bitrateField = document.getElementById('bitrateField');
const bitrateGroup = document.getElementById('bitrateGroup');
let bitrateValue = 128;
const convertBtn = document.getElementById('convertBtn');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');
const audioPreview = document.getElementById('audioPreview');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) setFile(fileInput.files[0]);
});

function setFile(file) {
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
    statusMsg.textContent = 'Please upload an audio file.';
    statusMsg.className = 'status error';
    return;
  }
  selectedFile = file;
  dropzone.querySelector('p').textContent = `Selected: ${file.name}`;
  statusMsg.textContent = '';
  statusMsg.className = 'status';
  resultBox.classList.remove('show');
}

if (outputFormatGroup) {
  outputFormatGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      outputFormatGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      outputFormatValue = btn.dataset.value;
      bitrateField.style.display = outputFormatValue === 'mp3' ? '' : 'none';
    });
  });
}

if (bitrateGroup) {
  bitrateGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      bitrateGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bitrateValue = parseInt(btn.dataset.value, 10);
    });
  });
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  let interleaved;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    interleaved = new Float32Array(left.length * 2);
    for (let i = 0, j = 0; i < left.length; i++, j += 2) {
      interleaved[j] = left[i];
      interleaved[j + 1] = right[i];
    }
  } else {
    interleaved = buffer.getChannelData(0);
  }
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = interleaved.length * bytesPerSample;
  const bufferArr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bufferArr);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function floatTo16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function audioBufferToMp3(buffer, kbps) {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const left = floatTo16(buffer.getChannelData(0));
  const right = channels === 2 ? floatTo16(buffer.getChannelData(1)) : null;

  const blockSize = 1152;
  const mp3Data = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    let mp3buf;
    if (channels === 2) {
      const rightChunk = right.subarray(i, i + blockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(end);
  return new Blob(mp3Data, { type: 'audio/mp3' });
}

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) {
    statusMsg.textContent = 'Please select an audio file first.';
    statusMsg.className = 'status error';
    return;
  }
  statusMsg.textContent = 'Decoding audio...';
  statusMsg.className = 'status';
  progressWrap.classList.add('show');
  progressBar.style.width = '20%';
  resultBox.classList.remove('show');

  try {
    const arrayBuffer = await selectedFile.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    progressBar.style.width = '50%';

    let blob, ext;
    if (outputFormatValue === 'wav') {
      statusMsg.textContent = 'Encoding WAV...';
      blob = audioBufferToWav(decoded);
      ext = 'wav';
    } else {
      statusMsg.textContent = 'Encoding MP3, this can take a moment...';
      await new Promise(r => setTimeout(r, 30));
      blob = audioBufferToMp3(decoded, bitrateValue);
      ext = 'mp3';
    }
    progressBar.style.width = '100%';

    const url = URL.createObjectURL(blob);
    audioPreview.src = url;
    downloadLink.href = url;
    downloadLink.download = selectedFile.name.replace(/\.[^.]+$/, '') + '.' + ext;
    resultBox.classList.add('show');
    statusMsg.textContent = 'Conversion complete!';
    statusMsg.className = 'status success';
  } catch (err) {
    statusMsg.textContent = 'Could not decode this audio file. Try a different format.';
    statusMsg.className = 'status error';
    console.error(err);
  } finally {
    setTimeout(() => progressWrap.classList.remove('show'), 600);
  }
});
