document.addEventListener('DOMContentLoaded', () => {
  const igUrlInput = document.getElementById('igUrl');
  const fetchBtn = document.getElementById('fetchBtn');
  const statusMsg = document.getElementById('statusMsg');
  const resultsArea = document.getElementById('resultsArea');
  const videoThumb = document.getElementById('videoThumb');
  const videoTitle = document.getElementById('videoTitle');
  const qualityList = document.getElementById('qualityList');

  // =========================================================================
  // SITE OWNER CONFIGURATION
  // =========================================================================
  // The previous API_HOST value "rapidapi.com" was a placeholder — requests
  // never reached a real API. Subscribe to "Instagram Downloader - Download
  // Instagram Videos, Stories" on rapidapi.com with the key below, or swap
  // in the host of whichever Instagram API you subscribe to.
  //
  // ⚠️ SECURITY: this key is visible to anyone who opens DevTools. Set quota
  // limits on RapidAPI or proxy the call through a serverless function.
  const RAPID_API_KEY = "Be0a479797msh6616e6746724ccap1c3101jsn472515051edd";
  const API_HOST = "instagram-downloader-download-instagram-videos-stories.p.rapidapi.com";
  // =========================================================================

  fetchBtn.addEventListener('click', async () => {
    const url = igUrlInput.value.trim();
    
    if (!url || !url.includes('instagram.com')) {
      statusMsg.textContent = 'Please enter a valid Instagram URL.';
      statusMsg.style.color = 'var(--status-error)';
      return;
    }

    if (RAPID_API_KEY === "YOUR_RAPIDAPI_KEY_HERE") {
      statusMsg.innerHTML = '<strong>Site Owner:</strong> Please configure your RapidAPI key in js/instagram-downloader.js to make this tool work.';
      statusMsg.style.color = 'var(--status-error)';
      return;
    }

    statusMsg.innerHTML = '<span class="spinner" style="border-top-color: var(--accent);"></span> Fetching download links...';
    statusMsg.style.color = 'var(--text)';
    resultsArea.style.display = 'none';
    qualityList.innerHTML = '';
    fetchBtn.disabled = true;

    try {
      // NOTE: This uses a generic Instagram Downloader endpoint on RapidAPI.
      // Adjust the URL and query parameters based on the specific API you choose.
      const apiUrl = `https://${API_HOST}/index?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPID_API_KEY,
          'X-RapidAPI-Host': API_HOST
        }
      });

      if (response.status === 403 || response.status === 401) {
        throw new Error('API key not authorized. Make sure you are subscribed to this Instagram API on RapidAPI.');
      }
      if (response.status === 429) {
        throw new Error('API quota exceeded. Try again later or upgrade the RapidAPI plan.');
      }
      if (!response.ok) {
        throw new Error('API request failed (' + response.status + '). Please try again later.');
      }

      const data = await response.json();

      /* Different IG APIs return different shapes — normalise the common ones:
         {media: "url"} | {media: [...]} | {data: [...]} | {result: [...]} | {video_url} */
      let mediaList = data.media || data.data || data.result || [];
      if (typeof mediaList === 'string') mediaList = [{ url: mediaList, type: 'Video' }];
      if (!Array.isArray(mediaList)) mediaList = [mediaList];

      const thumbnail = data.thumbnail || data.thumb || data.cover || '';
      if (thumbnail) videoThumb.src = thumbnail;
      videoThumb.style.display = thumbnail ? '' : 'none';
      videoTitle.textContent = data.title || 'Instagram Post';

      const links = [];
      mediaList.forEach((media, index) => {
        if (typeof media === 'string') { links.push({ label: 'Media ' + (index + 1), url: media }); return; }
        const linkUrl = media.url || media.video_url || media.link || media.download_url;
        if (linkUrl) links.push({ label: (media.type || 'Media') + ' ' + (index + 1), url: linkUrl });
      });
      if (!links.length && data.video_url) links.push({ label: 'MP4 Video', url: data.video_url });
      if (!links.length) throw new Error('No download links found for this Instagram post. It may be private.');
      links.forEach(l => addQualityOption(l.label, l.url));

      statusMsg.textContent = '';
      resultsArea.style.display = 'block';

    } catch (err) {
      console.error(err);
      statusMsg.textContent = err.message || 'An error occurred while fetching the video. The API key might be missing or invalid.';
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
