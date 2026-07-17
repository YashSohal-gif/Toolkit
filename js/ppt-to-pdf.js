/* PowerPoint (PPTX) to PDF — best-effort, TEXT ONLY. A .pptx file is a zip
   of XML; this extracts the text runs from each slide and lays them out as
   a simple text page per slide. Images, shapes, layouts, and design are NOT
   preserved -- this is a fallback for when you just need the words, not a
   real slide renderer. */

(function () {
  const dropzone = document.getElementById('dropzoneP2P');
  const fileInput = document.getElementById('fileInputP2P');
  const convertBtn = document.getElementById('p2pBtn');
  const statusMsg = document.getElementById('statusMsgP2P');
  const resultBox = document.getElementById('resultBoxP2P');
  const downloadLink = document.getElementById('downloadLinkP2P');

  if (!dropzone) return;

  let selectedFile = null;

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
    if (!/\.pptx$/i.test(file.name)) {
      statusMsg.textContent = 'Please choose a .pptx file (older .ppt files are not supported).';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  function decodeXmlEntities(str) {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function extractTextRuns(xml) {
    const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
    return matches.map((m) => decodeXmlEntities(m.replace(/<a:t>/, '').replace(/<\/a:t>/, '')));
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a .pptx file first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your presentation...';

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
          const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
          return na - nb;
        });

      if (slideFiles.length === 0) {
        statusMsg.textContent = 'Could not find any slides in this file.';
        convertBtn.disabled = false;
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: [720, 540] });

      for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.files[slideFiles[i]].async('string');
        const lines = extractTextRuns(xml).filter((t) => t.trim().length > 0);

        if (i > 0) doc.addPage([720, 540], 'l');
        doc.setFontSize(11);
        doc.setTextColor(120, 120, 120);
        doc.text('Slide ' + (i + 1) + ' of ' + slideFiles.length, 30, 30);

        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        let y = 70;
        lines.forEach((line, idx) => {
          const size = idx === 0 ? 22 : 14;
          doc.setFontSize(size);
          const wrapped = doc.splitTextToSize(line, 660);
          wrapped.forEach((w) => {
            if (y > 500) return;
            doc.text(w, 30, y);
            y += size * 1.4;
          });
          y += 8;
        });

        statusMsg.textContent = 'Converting... (' + (i + 1) + '/' + slideFiles.length + ')';
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Note: text-only conversion — images, shapes, and slide design are not included.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this file. Please try a different presentation.';
      console.error(err);
    } finally {
      convertBtn.disabled = false;
    }
  });
})();
