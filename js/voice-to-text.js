/* Voice to Text — live dictation using the browser's native
   SpeechRecognition API (webkitSpeechRecognition in Chrome/Edge). No
   server involved on this site's side; the browser handles recognition. */

(function () {
  const langGroup = document.getElementById('voiceLangGroup');
  const startBtn = document.getElementById('voiceStartBtn');
  const stopBtn = document.getElementById('voiceStopBtn');
  const clearBtn = document.getElementById('voiceClearBtn');
  const status = document.getElementById('voiceStatus');
  const output = document.getElementById('voiceOutput');
  const downloadBtn = document.getElementById('voiceDownloadBtn');
  const copyBtn = document.getElementById('voiceCopyBtn');

  if (!startBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let finalTranscript = '';
  let langValue = 'en-US';

  langGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      langGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      langValue = btn.dataset.value;
      if (recognition) recognition.lang = langValue;
    });
  });

  if (!SpeechRecognition) {
    status.textContent = 'Your browser does not support live speech recognition. Please try Chrome or Edge.';
    status.className = 'status error';
    startBtn.disabled = true;
    return;
  }

  function setupRecognition() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langValue;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      output.value = finalTranscript + interim;
    };

    recognition.onerror = (event) => {
      status.textContent = 'Recognition error: ' + event.error + '. Try again.';
      status.className = 'status error';
    };

    recognition.onend = () => {
      if (listening) {
        // Chrome stops after silence; auto-restart while the user hasn't clicked Stop.
        recognition.start();
      }
    };
  }

  startBtn.addEventListener('click', () => {
    setupRecognition();
    finalTranscript = output.value ? output.value + ' ' : '';
    listening = true;
    recognition.start();
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
    status.textContent = 'Listening... speak now.';
    status.className = 'status success';
  });

  stopBtn.addEventListener('click', () => {
    listening = false;
    if (recognition) recognition.stop();
    startBtn.style.display = '';
    stopBtn.style.display = 'none';
    status.textContent = 'Stopped.';
    status.className = 'status';
  });

  clearBtn.addEventListener('click', () => {
    output.value = '';
    finalTranscript = '';
  });

  downloadBtn.addEventListener('click', () => {
    if (!output.value.trim()) {
      status.textContent = 'Nothing to download yet.';
      return;
    }
    const blob = new Blob([output.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dictated-text.txt';
    link.click();
  });

  copyBtn.addEventListener('click', async () => {
    if (!output.value.trim()) return;
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = 'Copied to clipboard!';
      status.className = 'status success';
    } catch (err) {
      status.textContent = 'Could not copy automatically — please select and copy manually.';
    }
  });
})();
