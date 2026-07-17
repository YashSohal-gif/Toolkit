/* PDF to Excel — approximate table extraction. Reads each page's text items
   (with their x/y positions) via pdf.js, groups items into rows by rounded
   y-position, then splits each row into separate columns wherever there's a
   wide horizontal gap between consecutive words. Writes the result as a
   sheet per page via SheetJS. Runs fully in the browser. */

(function () {
  const dropzone = document.getElementById('dropzoneP2E');
  const fileInput = document.getElementById('fileInputP2E');
  const convertBtn = document.getElementById('p2eBtn');
  const statusMsg = document.getElementById('statusMsgP2E');
  const resultBox = document.getElementById('resultBoxP2E');
  const downloadLink = document.getElementById('downloadLinkP2E');
  const progressWrap = document.getElementById('progressWrapP2E');
  const progressBar = document.getElementById('progressBarP2E');

  if (!dropzone) return;

  const COLUMN_GAP_PT = 14; /* horizontal gap (points) that counts as a new column */

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
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  function rowToColumns(rowItems) {
    // Skip pdf.js's synthetic inter-word space items — their reported width
    // spans the whole gap to the next word, which made lastEndX jump right
    // up to the next real word and erase the very gap we're trying to detect.
    const sorted = rowItems.filter(item => item.str.trim()).sort((a, b) => a.transform[4] - b.transform[4]);
    const cells = [];
    let current = '';
    let lastEndX = null;

    sorted.forEach(item => {
      const x = item.transform[4];
      const width = item.width || (item.str.length * 5);
      if (lastEndX !== null && (x - lastEndX) > COLUMN_GAP_PT) {
        cells.push(current.trim());
        current = '';
      }
      current += (current ? ' ' : '') + item.str;
      lastEndX = x + width;
    });
    if (current) cells.push(current.trim());
    return cells;
  }

  /* Smart column detection: rather than deciding column breaks from each
     row in isolation (which misaligns whenever one row's words happen to
     sit a little closer/further apart), find gaps that show up consistently
     across the whole page and use those as fixed column boundaries — so
     every row's text lands in the same spreadsheet column. */
  function detectGlobalColumnBoundaries(allItems) {
    const edges = []; // { start, end } per item, sorted by start
    allItems.forEach(item => {
      if (!item.str.trim()) return; // skip pdf.js's synthetic inter-word space
      // items — their "width" spans the whole gap to the next word, which
      // would otherwise bridge real columns together into one occupied block
      const start = item.transform[4];
      const width = item.width || (item.str.length * 5);
      edges.push({ start, end: start + width });
    });
    edges.sort((a, b) => a.start - b.start);

    // Merge overlapping/near spans into "occupied" ranges, then any gap
    // between occupied ranges that's wide enough is a candidate boundary.
    const occupied = [];
    edges.forEach(e => {
      const last = occupied[occupied.length - 1];
      if (last && e.start - last.end < COLUMN_GAP_PT) {
        last.end = Math.max(last.end, e.end);
      } else {
        occupied.push({ start: e.start, end: e.end });
      }
    });

    const boundaries = [];
    for (let i = 1; i < occupied.length; i++) {
      const gap = occupied[i].start - occupied[i - 1].end;
      if (gap > COLUMN_GAP_PT) boundaries.push((occupied[i].start + occupied[i - 1].end) / 2);
    }
    return boundaries;
  }

  function columnIndexFor(x, boundaries) {
    let col = 0;
    for (const b of boundaries) { if (x >= b) col++; else break; }
    return col;
  }

  function rowToColumnsSmart(rowItems, boundaries) {
    const sorted = rowItems.slice().sort((a, b) => a.transform[4] - b.transform[4]);
    const cells = new Array(boundaries.length + 1).fill('');
    sorted.forEach(item => {
      if (!item.str.trim()) return; // skip pdf.js's synthetic inter-word space item
      const col = columnIndexFor(item.transform[4], boundaries);
      cells[col] = (cells[col] ? cells[col] + ' ' : '') + item.str;
    });
    return cells.map(c => c.trim());
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        try {
          statusMsg.textContent = 'Extracting rows and columns...';
          const wb = XLSX.utils.book_new();

          const columnModeSel = document.getElementById('p2eColumnMode');
          const smartMode = !columnModeSel || columnModeSel.value === 'smart';

          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();

            const rows = new Map();
            content.items.forEach(item => {
              const y = Math.round(item.transform[5]);
              if (!rows.has(y)) rows.set(y, []);
              rows.get(y).push(item);
            });
            const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);

            let aoa;
            if (smartMode) {
              const boundaries = detectGlobalColumnBoundaries(content.items);
              aoa = sortedYs.map(y => rowToColumnsSmart(rows.get(y), boundaries));
            } else {
              aoa = sortedYs.map(y => rowToColumns(rows.get(y)));
            }

            const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [['(no text found on this page)']]);
            const sheetName = ('Page ' + p).slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            progressBar.style.width = ((p / numPages) * 85) + '%';
          }

          statusMsg.textContent = 'Packaging your spreadsheet...';
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], { type: 'application/octet-stream' });
          progressBar.style.width = '100%';

          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.xlsx';

          resultBox.classList.add('show');
          statusMsg.textContent = `Done! ${numPages} sheet${numPages === 1 ? '' : 's'} created, one per PDF page.`;
          statusMsg.className = 'status success';
        } catch (err) {
          statusMsg.textContent = 'Something went wrong building the spreadsheet.';
          console.error(err);
        } finally {
          convertBtn.disabled = false;
          progressWrap.classList.remove('show');
        }
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. Please try a different file.';
      console.error(err);
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
