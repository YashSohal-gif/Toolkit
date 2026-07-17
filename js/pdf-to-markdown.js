/* PDF to Markdown — group pdf.js text items into lines by y-position,
   track each line's max font size, then classify lines as heading
   levels (largest sizes = higher-level headings) vs plain body text,
   and emit Markdown. Downloadable as .md. */

(function () {
  const dropzone = document.getElementById('dropzoneP2M');
  const fileInput = document.getElementById('fileInputP2M');
  const convertBtn = document.getElementById('p2mBtn');
  const statusMsg = document.getElementById('statusMsgP2M');
  const resultBox = document.getElementById('resultBoxP2M');
  const markdownOutput = document.getElementById('markdownOutputP2M');
  const downloadLink = document.getElementById('downloadLinkP2M');
  const progressWrap = document.getElementById('progressWrapP2M');
  const progressBar = document.getElementById('progressBarP2M');

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
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runConvert(pdf, numPages);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });

  async function runConvert(pdf, numPages) {
    statusMsg.textContent = 'Converting to Markdown... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const allLines = []; // { text, size }
      const sizeCounts = {};

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const rows = {};
        content.items.forEach((item) => {
          const y = Math.round(item.transform[5]);
          const size = Math.round(item.transform[3]);
          if (!rows[y]) rows[y] = { parts: [], maxSize: 0 };
          rows[y].parts.push({ x: item.transform[4], text: item.str });
          rows[y].maxSize = Math.max(rows[y].maxSize, size);
        });
        const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);
        sortedYs.forEach((y) => {
          const row = rows[y];
          const text = row.parts.sort((a, b) => a.x - b.x).map((it) => it.text).join(' ').trim();
          if (!text) return;
          allLines.push({ text, size: row.maxSize });
          sizeCounts[row.maxSize] = (sizeCounts[row.maxSize] || 0) + 1;
        });
        progressBar.style.width = ((p / numPages) * 70) + '%';
      }

      const bodySize = Object.keys(sizeCounts).reduce((best, s) => sizeCounts[s] > (sizeCounts[best] || 0) ? s : best, Object.keys(sizeCounts)[0]);
      const bodySizeNum = parseInt(bodySize, 10) || 12;
      const headingSizes = Object.keys(sizeCounts).map(Number).filter((s) => s > bodySizeNum + 1).sort((a, b) => b - a);

      function headingLevel(size) {
        const idx = headingSizes.indexOf(size);
        if (idx === -1) return 0;
        return Math.min(idx + 1, 3);
      }

      let md = '';
      allLines.forEach((line) => {
        const level = headingLevel(line.size);
        if (level > 0) {
          md += '\n' + '#'.repeat(level) + ' ' + line.text + '\n\n';
        } else {
          md += line.text + '\n';
        }
      });
      md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

      progressBar.style.width = '100%';
      markdownOutput.value = md;
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '.md';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Converted ' + numPages + ' page(s) to Markdown.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this PDF. Please try again.';
      console.error(err);
    } finally {
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
