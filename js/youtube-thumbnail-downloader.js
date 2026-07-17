function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

const SIZES = [
  { key: 'maxresdefault', label: 'Max Resolution (HD)' },
  { key: 'sddefault', label: 'Standard Definition' },
  { key: 'hqdefault', label: 'High Quality' },
  { key: 'mqdefault', label: 'Medium Quality' },
  { key: 'default', label: 'Default (small)' }
];

const fetchBtn = document.getElementById('fetchBtn');
const ytUrl = document.getElementById('ytUrl');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');
const thumbGrid = document.getElementById('thumbGrid');

fetchBtn.addEventListener('click', () => {
  const id = extractYouTubeId(ytUrl.value);
  thumbGrid.innerHTML = '';
  resultBox.classList.remove('show');
  if (!id) {
    statusMsg.textContent = 'Could not find a valid YouTube video ID in that link. Please check the URL.';
    statusMsg.className = 'status error';
    return;
  }
  statusMsg.textContent = '';
  statusMsg.className = 'status';

  SIZES.forEach(size => {
    const imgUrl = `https://img.youtube.com/vi/${id}/${size.key}.jpg`;
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--card-bg);';
    const img = document.createElement('img');
    img.src = imgUrl;
    img.style.cssText = 'width:100%;display:block;background:#000;';
    img.alt = size.label + ' thumbnail';
    const info = document.createElement('div');
    info.style.cssText = 'padding:10px;text-align:center;';
    const label = document.createElement('div');
    label.textContent = size.label;
    label.style.cssText = 'font-weight:600;margin-bottom:8px;font-size:0.9rem;';
    const dl = document.createElement('a');
    dl.href = imgUrl;
    dl.download = `youtube-thumbnail-${id}-${size.key}.jpg`;
    dl.className = 'btn';
    dl.textContent = '⬇ Download';
    dl.target = '_blank';
    dl.rel = 'noopener';
    dl.style.cssText = 'display:inline-block;padding:8px 16px;font-size:0.85rem;';
    info.appendChild(label);
    info.appendChild(dl);
    card.appendChild(img);
    card.appendChild(info);
    thumbGrid.appendChild(card);

    img.addEventListener('error', () => {
      card.style.display = 'none';
    });
  });

  resultBox.classList.add('show');
});

ytUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBtn.click();
});
