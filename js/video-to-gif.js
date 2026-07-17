/* Video to GIF — seeks through an uploaded video at a chosen frame rate
   over a chosen time range, draws each frame to a canvas, and assembles
   them into an animated GIF using gif.js (runs via a Web Worker, fully
   client-side, no server involved). */

(function () {
  const dropzone = document.getElementById('dropzoneV2G');
  const fileInput = document.getElementById('fileInputV2G');
  const videoWrap = document.getElementById('v2gVideoWrap');
  const videoPreview = document.getElementById('v2gVideoPreview');
  const controlsWrap = document.getElementById('v2gControlsWrap');
  const startInput = document.getElementById('v2gStart');
  const endInput = document.getElementById('v2gEnd');
  const fpsGroup = document.getElementById('v2gFpsGroup');
  const sizeGroup = document.getElementById('v2gSizeGroup');
  const generateControls = document.getElementById('v2gGenerateControls');
  const generateBtn = document.getElementById('v2gGenerateBtn');
  const statusMsg = document.getElementById('statusMsgV2G');
  const resultBox = document.getElementById('resultBoxV2G');
  const resultImg = document.getElementById('v2gResultImg');
  const downloadLink = document.getElementById('downloadLinkV2G');
  const progressWrap = document.getElementById('progressWrapV2G');
  const progressBar = document.getElementById('progressBarV2G');

  if (!dropzone) return;

  let selectedFile = null;
  let fpsValue = 12;
  let widthValue = 480;

  fpsGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      fpsGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      fpsValue = parseInt(btn.dataset.value, 10);
    });
  });
  sizeGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      sizeGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      widthValue = parseInt(btn.dataset.value, 10);
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
    if (!file.type.startsWith('video/')) {
      statusMsg.textContent = 'Please choose a video file.';
      return;
    }
    selectedFile = file;
    resultBox.classList.remove('show');
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    videoWrap.style.display = '';

    videoPreview.onloadedmetadata = () => {
      startInput.value = '0';
      endInput.value = Math.min(videoPreview.duration, 3).toFixed(1);
      controlsWrap.style.display = '';
      generateControls.style.display = '';
      statusMsg.textContent = 'Video loaded — ' + videoPreview.duration.toFixed(1) + 's total. Set your range and options.';
    };
  }

  function seekTo(time) {
    return new Promise((resolve) => {
      function onSeeked() {
        videoPreview.removeEventListener('seeked', onSeeked);
        resolve();
      }
      videoPreview.addEventListener('seeked', onSeeked);
      videoPreview.currentTime = time;
    });
  }

  generateBtn.addEventListener('click', () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a video first.';
      return;
    }
    const start = parseFloat(startInput.value) || 0;
    const end = parseFloat(endInput.value) || 0;
    if (end <= start) {
      statusMsg.textContent = 'End time must be after start time.';
      return;
    }
    if (end - start > 15) {
      statusMsg.textContent = 'Please keep clips to 15 seconds or less for reasonable file sizes.';
      return;
    }

    generateBtn.disabled = true;
    const durationSeconds = Math.max(1, Math.round(end - start));
    adGate.run(durationSeconds, async () => {
      await runGenerate(start, end);
    }, statusMsg, 'This ' + durationSeconds + 's clip');
  });

  async function runGenerate(start, end) {
    statusMsg.textContent = 'Capturing frames... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const aspect = videoPreview.videoHeight / videoPreview.videoWidth;
      const outW = widthValue;
      const outH = Math.round(outW * aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: outW,
        height: outH,
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
      });

      const frameDelayMs = 1000 / fpsValue;
      const totalFrames = Math.max(1, Math.round((end - start) * fpsValue));

      videoPreview.pause();
      for (let f = 0; f < totalFrames; f++) {
        const t = start + f / fpsValue;
        await seekTo(Math.min(t, videoPreview.duration - 0.05));
        ctx.drawImage(videoPreview, 0, 0, outW, outH);
        gif.addFrame(ctx, { copy: true, delay: frameDelayMs });
        progressBar.style.width = ((f + 1) / totalFrames * 60) + '%';
      }

      statusMsg.textContent = 'Encoding GIF...';

      await new Promise((resolve, reject) => {
        gif.on('progress', (p) => {
          progressBar.style.width = (60 + p * 40) + '%';
        });
        gif.on('finished', (blob) => {
          const url = URL.createObjectURL(blob);
          resultImg.src = url;
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.gif';
          resolve();
        });
        try {
          gif.render();
        } catch (err) {
          reject(err);
        }
      });

      progressBar.style.width = '100%';
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your GIF is ready.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong creating this GIF. Please try a shorter clip or smaller size.';
      console.error(err);
    } finally {
      generateBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
