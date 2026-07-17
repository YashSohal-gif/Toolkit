/* Compare PDF — extract text lines from two PDFs via pdf.js, diff them
   with a classic LCS-based line diff, and render additions/removals. */

(function () {
  const dropzoneA = document.getElementById('dropzoneCompareA');
  const fileInputA = document.getElementById('fileInputCompareA');
  const dropzoneB = document.getElementById('dropzoneCompareB');
  const fileInputB = document.getElementById('fileInputCompareB');
  const compareBtn = document.getElementById('compareBtn');
  const statusMsg = document.getElementById('statusMsgCompare');
  const resultBox = document.getElementById('resultBoxCompare');
  const linesAddedEl = document.getElementById('linesAddedCompare');
  const linesRemovedEl = document.getElementById('linesRemovedCompare');
  const diffOutput = document.getElementById('compareDiffOutput');
  const progressWrap = document.getElementById('progressWrapCompare');
  const progressBar = document.getElementById('progressBarCompare');

  if (!dropzoneA) return;

  let fileA = null, fileB = null;

  function wireDropzone(dropzone, fileInput, setFile) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handlePick(e.dataTransfer.files[0], dropzone, setFile);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handlePick(e.target.files[0], dropzone, setFile);
    });
  }

  function handlePick(file, dropzone, setFile) {
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    setFile(file);
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name;
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  wireDropzone(dropzoneA, fileInputA, (f) => { fileA = f; });
  wireDropzone(dropzoneB, fileInputB, (f) => { fileB = f; });

  async function extractLines(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const rows = {};
      content.items.forEach((item) => {
        const y = Math.round(item.transform[5]);
        if (!rows[y]) rows[y] = [];
        rows[y].push({ x: item.transform[4], text: item.str });
      });
      const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);
      sortedYs.forEach((y) => {
        const rowText = rows[y].sort((a, b) => a.x - b.x).map((it) => it.text).join(' ').trim();
        if (rowText) lines.push(rowText);
      });
    }
    return lines;
  }

  function lcsDiff(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const result = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        result.push({ type: 'same', text: a[i] });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        result.push({ type: 'removed', text: a[i] });
        i++;
      } else {
        result.push({ type: 'added', text: b[j] });
        j++;
      }
    }
    while (i < n) { result.push({ type: 'removed', text: a[i] }); i++; }
    while (j < m) { result.push({ type: 'added', text: b[j] }); j++; }
    return result;
  }

  compareBtn.addEventListener('click', async () => {
    if (!fileA || !fileB) {
      statusMsg.textContent = 'Please choose both PDF A and PDF B.';
      return;
    }
    compareBtn.disabled = true;
    statusMsg.textContent = 'Reading both PDFs...';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const linesA = await extractLines(fileA);
      progressBar.style.width = '45%';
      const linesB = await extractLines(fileB);
      progressBar.style.width = '75%';

      statusMsg.textContent = 'Comparing text...';
      const diff = lcsDiff(linesA, linesB);
      progressBar.style.width = '100%';

      let added = 0, removed = 0;
      diffOutput.innerHTML = '';
      diff.forEach((d) => {
        const row = document.createElement('div');
        row.style.whiteSpace = 'pre-wrap';
        row.style.padding = '2px 6px';
        row.style.borderRadius = '4px';
        if (d.type === 'added') {
          row.style.background = 'rgba(22,163,74,0.15)';
          row.style.color = '#15803d';
          row.textContent = '+ ' + d.text;
          added++;
        } else if (d.type === 'removed') {
          row.style.background = 'rgba(220,38,38,0.12)';
          row.style.color = '#b91c1c';
          row.textContent = '- ' + d.text;
          removed++;
        } else {
          row.style.color = 'var(--text-muted)';
          row.textContent = '  ' + d.text;
        }
        diffOutput.appendChild(row);
      });

      linesAddedEl.textContent = added;
      linesRemovedEl.textContent = removed;
      resultBox.classList.add('show');

      statusMsg.textContent = (added === 0 && removed === 0)
        ? 'No text differences found — these PDFs have identical text content.'
        : 'Done! Found ' + added + ' added line(s) and ' + removed + ' removed line(s).';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong comparing these PDFs. Please try again.';
      console.error(err);
    } finally {
      compareBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
