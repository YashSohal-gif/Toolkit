document.addEventListener('DOMContentLoaded', () => {
  const ytUrlInput = document.getElementById('ytUrl');
  const fetchBtn = document.getElementById('fetchBtn');
  const statusMsg = document.getElementById('statusMsg');
  const resultsArea = document.getElementById('resultsArea');
  const formatButtons = document.querySelectorAll('.format-options button');
  const videoThumb = document.getElementById('videoThumb');
  const videoTitle = document.getElementById('videoTitle');
  const videoDuration = document.getElementById('videoDuration');
  const qualityList = document.getElementById('qualityList');

  // =========================================================================
  // SITE OWNER CONFIGURATION
  // =========================================================================
  // The previous API_HOST value "rapidapi.com" was a placeholder — requests
  // never reached a real API. Each RapidAPI product has its own host:
  //   Audio (MP3):  subscribe to "YouTube MP3" (youtube-mp36) on rapidapi.com
  //   Video (MP4):  subscribe to "YTStream" on rapidapi.com
  // Both must be subscribed under the SAME account as the key below.
  //
  // ⚠️ SECURITY: this key is visible to anyone who opens DevTools on your
  // site. Set quota limits on RapidAPI, or proxy these calls through a tiny
  // serverless function (Cloudflare Workers is free) to hide the key.
  const RAPID_API_KEY = "Be0a479797msh6616e6746724ccap1c3101jsn472515051edd";
  const AUDIO_API_HOST = "youtube-mp36.p.rapidapi.com";
  const VIDEO_API_HOST = "ytstream-download-youtube-videos.p.rapidapi.com";
  // =========================================================================

  let selectedFormat = 'video';

  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.dataset.format;
    });
  });

  function formatDuration(seconds) {
    const s = parseInt(seconds, 10);
    if (!s || isNaN(s)) return null;
    const m = Math.floor(s / 60), sec = s % 60;
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }

  async function apiGet(host, path) {
    const response = await fetch(`https://${host}${path}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': host
      }
    });
    if (response.status === 403 || response.status === 401) {
      throw new Error('API key not authorized. Make sure you are subscribed to this API on RapidAPI with this key.');
    }
    if (response.status === 429) {
      throw new Error('API quota exceeded for this month/minute. Try again later or upgrade the RapidAPI plan.');
    }
    if (!response.ok) throw new Error('API request failed (' + response.status + '). Please try again later.');
    return response.json();
  }

  /* youtube-mp36 returns {status:"processing"} while it converts —
     poll a few times before giving up. */
  async function fetchMp3(videoId) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const data = await apiGet(AUDIO_API_HOST, `/dl?id=${videoId}`);
      if (data.status === 'ok' && data.link) return data;
      if (data.status === 'fail') throw new Error(data.msg || 'This video could not be converted to MP3.');
      statusMsg.textContent = `Converting to MP3... (${(attempt + 1) * 3}s)`;
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('Conversion is taking too long — please try again in a minute.');
  }

  fetchBtn.addEventListener('click', async () => {
    const url = ytUrlInput.value.trim();

    if (!url) {
      statusMsg.textContent = 'Please enter a valid YouTube URL.';
      statusMsg.style.color = 'var(--status-error)';
      return;
    }

    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|shorts\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      statusMsg.textContent = 'Could not detect a valid YouTube Video ID from the URL.';
      statusMsg.style.color = 'var(--status-error)';
      return;
    }

    statusMsg.innerHTML = '<span class="spinner" style="border-top-color: var(--accent);"></span> Fetching download links...';
    statusMsg.style.color = 'var(--text)';
    resultsArea.style.display = 'none';
    qualityList.innerHTML = '';
    fetchBtn.disabled = true;

    try {
      videoThumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      if (selectedFormat === 'audio') {
        const data = await fetchMp3(videoId);
        videoTitle.textContent = data.title || 'YouTube Video';
        const dur = formatDuration(data.duration);
        videoDuration.textContent = dur ? `Duration: ${dur}` : '';
        addQualityOption(`MP3 Audio${data.filesize ? ' (' + (data.filesize / 1048576).toFixed(1) + ' MB)' : ''}`, data.link);
      } else {
        const data = await apiGet(VIDEO_API_HOST, `/dl?id=${videoId}`);
        if (data.status && data.status !== 'OK' && data.status !== 'ok') {
          throw new Error(data.reason || data.msg || 'This video is unavailable for download.');
        }
        videoTitle.textContent = data.title || 'YouTube Video';
        const dur = formatDuration(data.lengthSeconds);
        videoDuration.textContent = dur ? `Duration: ${dur}` : '';
        if (Array.isArray(data.thumbnail) && data.thumbnail.length) {
          videoThumb.src = data.thumbnail[data.thumbnail.length - 1].url;
        }

        /* "formats" entries contain video+audio muxed; adaptiveFormats are
           video-only or audio-only — prefer the muxed ones. */
        const muxed = (data.formats || []).filter(f => f.url);
        if (muxed.length === 0) throw new Error('No downloadable formats found for this video.');
        muxed.forEach(f => {
          const label = (f.qualityLabel || f.quality || 'MP4') + (f.mimeType ? ' · ' + f.mimeType.split(';')[0].replace('video/', '') : '');
          addQualityOption(label, f.url);
        });
      }

      statusMsg.textContent = '';
      resultsArea.style.display = 'block';
    } catch (err) {
      console.error(err);
      statusMsg.textContent = err.message || 'An error occurred while fetching the video.';
      statusMsg.style.color = 'var(--status-error)';
    } finally {
      fetchBtn.disabled = false;
    }
  });

  function addQualityOption(label, url) {
    const item = document.createElement('div');
    item.className = 'quality-item';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = '';
    link.textContent = 'Download';

    item.appendChild(labelSpan);
    item.appendChild(link);
    qualityList.appendChild(item);
  }
});
