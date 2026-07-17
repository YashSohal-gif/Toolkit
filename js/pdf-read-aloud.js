/* PDF Read Aloud — extracts text via pdf.js, splits it into manageable
   sentence-sized chunks, and reads them back-to-back using the
   browser's SpeechSynthesis API, highlighting the current sentence. */

(function () {
  const dropzone = document.getElementById('dropzoneReadAloud');
  const fileInput = document.getElementById('fileInputReadAloud');
  const controlsWrap = document.getElementById('readAloudControlsWrap');
  const voiceSelect = document.getElementById('readAloudVoice');
  const rateSlider = document.getElementById('readAloudRate');
  const pitchSlider = document.getElementById('readAloudPitch');
  const playBtn = document.getElementById('readAloudPlayBtn');
  const pauseBtn = document.getElementById('readAloudPauseBtn');
  const stopBtn = document.getElementById('readAloudStopBtn');
  const progressEl = document.getElementById('readAloudProgress');
  const statusMsg = document.getElementById('statusMsgReadAloud');
  const textPreview = document.getElementById('readAloudTextPreview');

  if (!dropzone) return;

  if (!('speechSynthesis' in window)) {
    statusMsg.textContent = 'Your browser does not support text-to-speech. Please try Chrome, Edge, or Safari.';
    statusMsg.className = 'status error';
    return;
  }

  let sentences = [];
  let currentIndex = 0;
  let isPlaying = false;

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

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = v.name + ' (' + v.lang + ')';
      voiceSelect.appendChild(opt);
    });
  }
  populateVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  function splitIntoSentences(text) {
    const rough = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
    const chunks = [];
    let buffer = '';
    rough.forEach((piece) => {
      if ((buffer + ' ' + piece).length > 220 && buffer) {
        chunks.push(buffer.trim());
        buffer = piece;
      } else {
        buffer = buffer ? buffer + ' ' + piece : piece;
      }
    });
    if (buffer.trim()) chunks.push(buffer.trim());
    return chunks.filter((s) => s.length > 0);
  }

  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    statusMsg.textContent = 'Extracting text from your PDF...';
    speechSynthesis.cancel();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items.map((it) => it.str).join(' ');
        fullText += pageText + '\n\n';
      }

      sentences = splitIntoSentences(fullText);
      if (sentences.length === 0) {
        statusMsg.textContent = 'No readable text was found in this PDF.';
        statusMsg.className = 'status error';
        return;
      }

      textPreview.innerHTML = sentences.map((s, i) => '<span id="raSent' + i + '">' + escapeHtml(s) + ' </span>').join('');
      textPreview.style.display = '';
      controlsWrap.style.display = '';
      currentIndex = 0;
      statusMsg.textContent = 'Ready — ' + sentences.length + ' sentence(s) extracted. Press Play to listen.';
      statusMsg.className = 'status success';
      progressEl.textContent = '';
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightSentence(i) {
    sentences.forEach((_, idx) => {
      const el = document.getElementById('raSent' + idx);
      if (el) el.style.background = idx === i ? 'rgba(37,99,235,0.25)' : 'transparent';
    });
    const el = document.getElementById('raSent' + i);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function speakFrom(index) {
    if (index >= sentences.length) {
      isPlaying = false;
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      progressEl.textContent = 'Finished reading.';
      return;
    }
    currentIndex = index;
    highlightSentence(index);
    progressEl.textContent = 'Reading sentence ' + (index + 1) + ' of ' + sentences.length + '...';

    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    const voices = speechSynthesis.getVoices();
    const chosen = voices[parseInt(voiceSelect.value, 10) || 0];
    if (chosen) utterance.voice = chosen;
    utterance.rate = parseFloat(rateSlider.value);
    utterance.pitch = parseFloat(pitchSlider.value);
    utterance.onend = () => {
      if (isPlaying) speakFrom(index + 1);
    };
    speechSynthesis.speak(utterance);
  }

  playBtn.addEventListener('click', () => {
    if (sentences.length === 0) {
      statusMsg.textContent = 'Please upload a PDF first.';
      return;
    }
    isPlaying = true;
    playBtn.style.display = 'none';
    pauseBtn.style.display = '';
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    } else {
      speakFrom(currentIndex);
    }
  });

  pauseBtn.addEventListener('click', () => {
    speechSynthesis.pause();
    isPlaying = false;
    playBtn.style.display = '';
    pauseBtn.style.display = 'none';
    progressEl.textContent = 'Paused.';
  });

  stopBtn.addEventListener('click', () => {
    speechSynthesis.cancel();
    isPlaying = false;
    currentIndex = 0;
    playBtn.style.display = '';
    pauseBtn.style.display = 'none';
    progressEl.textContent = 'Stopped.';
  });
})();
