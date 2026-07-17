/* HTML to PDF — renders an uploaded .html file, or pasted HTML code,
   off-screen in an .office-render-host div, then uses jsPDF's .html()
   (which uses html2canvas internally) to rasterize it into a PDF.
   Best-effort: external stylesheets/scripts are not fetched. */

(function () {
  const sourceGroup = document.getElementById('htmlSourceGroup');
  let sourceValue = 'file';
  const fileWrap = document.getElementById('h2pFileWrap');
  const pasteWrap = document.getElementById('h2pPasteWrap');
  const dropzone = document.getElementById('dropzoneH2P');
  const fileInput = document.getElementById('fileInputH2P');
  const pasteInput = document.getElementById('htmlPasteInput');
  const convertBtn = document.getElementById('h2pBtn');
  const statusMsg = document.getElementById('statusMsgH2P');
  const resultBox = document.getElementById('resultBoxH2P');
  const downloadLink = document.getElementById('downloadLinkH2P');
  const renderHost = document.getElementById('h2pRenderHost');

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
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  async function getHtmlContent() {
    if (sourceValue === 'paste') {
      return pasteInput.value;
    }
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
    statusMsg.textContent = 'Rendering your HTML...';

    try {
      renderHost.innerHTML = sanitize(html);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      await doc.html(renderHost, {
        margin: [40, 40, 40, 40],
        autoPaging: 'text',
        width: 515,
        windowWidth: 700,
        callback: function (pdf) {
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'converted';
          downloadLink.download = originalName + '.pdf';

          resultBox.classList.add('show');
          statusMsg.textContent = 'Done! Note: this is a best-effort conversion — external styles/scripts are not applied.';
          statusMsg.className = 'status success';
          convertBtn.disabled = false;
        }
      });
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this HTML. Please try again.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });
})();
