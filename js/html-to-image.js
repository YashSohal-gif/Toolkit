/* HTML to Image — renders an uploaded .html file, or pasted HTML code,
   off-screen in an .office-render-host div, then screenshots it with
   html2canvas to produce a downloadable PNG or JPG. Runs fully in the
   browser; external stylesheets/scripts are not fetched. */

(function () {
  const sourceGroup = document.getElementById('htmlImgSourceGroup');
  let sourceValue = 'file';
  const fileWrap = document.getElementById('h2iFileWrap');
  const pasteWrap = document.getElementById('h2iPasteWrap');
  const dropzone = document.getElementById('dropzoneH2I');
  const fileInput = document.getElementById('fileInputH2I');
  const pasteInput = document.getElementById('htmlImgPasteInput');
  const formatGroup = document.getElementById('h2iFormatGroup');
  let formatValue = 'png';
  const convertBtn = document.getElementById('h2iBtn');
  const statusMsg = document.getElementById('statusMsgH2I');
  const resultBox = document.getElementById('resultBoxH2I');
  const previewImg = document.getElementById('h2iPreviewImg');
  const downloadLink = document.getElementById('downloadLinkH2I');
  const renderHost = document.getElementById('h2iRenderHost');

  if (!dropzone) return;

  let selectedFile = null;

  if (sourceGroup) {
    sourceGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        sourceGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sourceValue = btn.dataset.value;
        fileWrap.style.display = sourceValue === 'file' ? '' : 'none';
        pasteWrap.style.display = sourceValue === 'paste' ? '' : 'none';
      });
    });
  }

  if (formatGroup) {
    formatGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        formatGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        formatValue = btn.dataset.value;
      });
    });
  }

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
    const isHtml = /\.html?$/i.test(file.name);
    if (!isHtml) {
      statusMsg.textContent = 'Please choose an .html or .htm file.';
      return;
    }
    selectedFile = file;
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name;
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  async function getHtmlContent() {
    if (sourceValue === 'paste') return pasteInput.value;
    if (!selectedFile) return null;
    return await selectedFile.text();
  }

  /* DOM-based sanitizer: removes script/iframe/embed elements, inline
     event handlers (onclick, onerror, ...) and javascript: URLs — a regex
     script-strip alone still lets `<img onerror=...>` execute. */
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, base, form').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = (attr.value || '').replace(/\s/g, '').toLowerCase();
        if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href') && val.startsWith('javascript:'))) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  }

  convertBtn.addEventListener('click', async () => {
    const html = await getHtmlContent();
    if (!html || !html.trim()) {
      statusMsg.textContent = sourceValue === 'file' ? 'Please choose an HTML file first.' : 'Please paste some HTML code first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Rendering and capturing your HTML...';

    try {
      renderHost.innerHTML = sanitize(html);
      renderHost.style.left = '-9999px';

      const canvas = await html2canvas(renderHost, { backgroundColor: '#ffffff' });
      const mime = formatValue === 'jpg' ? 'image/jpeg' : 'image/png';

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        downloadLink.href = url;
        const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'converted';
        downloadLink.download = originalName + '.' + (formatValue === 'jpg' ? 'jpg' : 'png');

        resultBox.classList.add('show');
        statusMsg.textContent = 'Done! Note: this is a best-effort render — external styles/scripts are not applied.';
        statusMsg.className = 'status success';
        convertBtn.disabled = false;
      }, mime, 0.92);
    } catch (err) {
      statusMsg.textContent = 'Something went wrong rendering this HTML. Please try again.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });
})();
