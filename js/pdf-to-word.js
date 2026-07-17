/* PDF to Word — extracts each page's text via pdf.js and hand-builds a
   valid .docx (a zip of OOXML parts) via JSZip.

   ✨ Magic Layer: instead of dumping raw lines, it reconstructs the document:
   - detects headings from font size (relative to the document's body size)
   - detects bold / italic runs from the embedded font names
   - groups lines into real flowing paragraphs (with hyphen de-hyphenation)
   - detects centered lines (titles, "Section A", exam headers) and centers them
   - rebuilds word spacing from glyph x-positions so words never fuse together */

(function () {
  const dropzone = document.getElementById('dropzoneP2W');
  const fileInput = document.getElementById('fileInputP2W');
  const convertBtn = document.getElementById('p2wBtn');
  const statusMsg = document.getElementById('statusMsgP2W');
  const resultBox = document.getElementById('resultBoxP2W');
  const downloadLink = document.getElementById('downloadLinkP2W');
  const progressWrap = document.getElementById('progressWrapP2W');
  const progressBar = document.getElementById('progressBarP2W');

  /* New option controls */
  const magicToggle = document.getElementById('p2wMagic');
  const layoutModeSel = document.getElementById('p2wLayoutMode');
  const pageBreaksToggle = document.getElementById('p2wPageBreaks');
  const dehyphenToggle = document.getElementById('p2wDehyphen');
  const fontSel = document.getElementById('p2wFont');

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

  /* Magic Layer master switch enables/disables its sub-options */
  if (magicToggle) {
    magicToggle.addEventListener('change', () => {
      const on = magicToggle.checked;
      [layoutModeSel, dehyphenToggle].forEach(el => { if (el) el.disabled = !on; });
    });
  }

  function handleFile(file) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    dropzone.classList.add('has-file');
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
    statusMsg.className = 'status';
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /* ---------- Magic Layer: page analysis ---------- */

  /* Extract positioned text runs from a pdf.js page, resolving each item's
     real font name (e.g. "Helvetica-Bold") so we can detect bold/italic. */
  async function extractRuns(page) {
    const content = await page.getTextContent();
    const runs = [];
    content.items.forEach(item => {
      if (!item.str || !item.str.trim()) {
        if (item.str !== ' ') return; // keep single spaces, drop empties
      }
      const size = Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.transform[3]) || 10;
      let fontName = '';
      try {
        const fontObj = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
        fontName = (fontObj && fontObj.name) ? fontObj.name : '';
      } catch (e) { /* font not resolvable — style detection just degrades */ }
      const lower = fontName.toLowerCase();
      runs.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
        size: size,
        bold: /bold|black|heavy|semibold|demi/.test(lower),
        italic: /italic|oblique/.test(lower)
      });
    });
    return runs;
  }

  /* Cluster runs into visual lines using a y-tolerance proportional to font
     size (fixes superscripts/subscripts splitting a line apart). */
  function clusterLines(runs) {
    const sorted = runs.slice().sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    sorted.forEach(run => {
      const tol = Math.max(2, run.size * 0.45);
      const line = lines.find(l => Math.abs(l.y - run.y) <= tol);
      if (line) {
        line.runs.push(run);
        line.y = (line.y * (line.runs.length - 1) + run.y) / line.runs.length;
      } else {
        lines.push({ y: run.y, runs: [run] });
      }
    });
    lines.forEach(l => l.runs.sort((a, b) => a.x - b.x));
    return lines;
  }

  /* Merge a line's runs into styled text segments, inserting spaces from
     glyph geometry (gap between items) so words don't fuse. */
  function lineToSegments(line) {
    const segs = [];
    let prev = null;
    line.runs.forEach(run => {
      let text = run.str;
      if (prev) {
        const gap = run.x - (prev.x + prev.width);
        const needSpace = gap > Math.max(1.2, prev.size * 0.18);
        if (needSpace && !/\s$/.test(prev.str) && !/^\s/.test(text)) text = ' ' + text;
      }
      const last = segs[segs.length - 1];
      if (last && last.bold === run.bold && last.italic === run.italic && Math.abs(last.size - run.size) < 0.6) {
        last.text += text;
      } else {
        segs.push({ text: text, bold: run.bold, italic: run.italic, size: run.size });
      }
      prev = run;
    });
    return segs.filter(s => s.text.length);
  }

  function lineMeta(line, pageWidth) {
    const first = line.runs[0];
    const last = line.runs[line.runs.length - 1];
    const xStart = first.x;
    const xEnd = last.x + last.width;
    const maxSize = Math.max.apply(null, line.runs.map(r => r.size));
    const allBold = line.runs.every(r => r.bold);
    const center = (xStart + xEnd) / 2;
    const width = xEnd - xStart;
    const centered = pageWidth > 0 &&
      Math.abs(center - pageWidth / 2) < pageWidth * 0.06 &&
      width < pageWidth * 0.75 &&
      xStart > pageWidth * 0.12;
    return { xStart, xEnd, maxSize, allBold, centered, width };
  }

  /* Turn one page's lines into paragraph objects:
     { segments, heading: 0|1|2, align: 'left'|'center' } */
  function buildParagraphs(lines, pageWidth, bodySize, opts) {
    const paras = [];
    let current = null;
    let prevLine = null;

    lines.forEach(line => {
      const meta = lineMeta(line, pageWidth);
      const segs = lineToSegments(line);
      if (!segs.length) return;
      const text = segs.map(s => s.text).join('');
      if (!text.trim()) return;

      let heading = 0;
      if (meta.maxSize >= bodySize * 1.7) heading = 1;
      else if (meta.maxSize >= bodySize * 1.25) heading = 2;
      else if (meta.allBold && meta.centered && text.trim().length < 80) heading = 2;

      const align = meta.centered ? 'center' : 'left';

      /* Decide whether this line continues the previous paragraph */
      let startNew = true;
      if (opts.flow && current && !heading && current.heading === 0 &&
          align === current.align && prevLine) {
        const gap = prevLine.y - line.y;
        const lineH = Math.max(prevLine.maxSize, meta.maxSize) || 12;
        const looksList = /^\s*([-•▪◦*·]|\(?[0-9ivxIVX]+[.)]|\(?[a-zA-Z][.)])\s/.test(text);
        const prevEndsSentence = /[.!?:;]\s*$/.test(current.plain);
        if (gap > 0 && gap < lineH * 1.65 && !looksList && !(prevEndsSentence && /^[A-Z0-9(]/.test(text.trim()) && gap > lineH * 1.35)) {
          startNew = false;
        }
      }

      if (startNew) {
        current = { segments: segs, heading: heading, align: align, plain: text };
        paras.push(current);
      } else {
        /* De-hyphenate: "conver-" + "sion" -> "conversion" */
        const lastSeg = current.segments[current.segments.length - 1];
        if (opts.dehyphen && /[a-z]-$/.test(lastSeg.text) && /^[a-z]/.test(text.trim())) {
          lastSeg.text = lastSeg.text.replace(/-$/, '');
        } else if (!/\s$/.test(lastSeg.text)) {
          lastSeg.text += ' ';
        }
        segs.forEach(s => current.segments.push(s));
        current.plain += ' ' + text;
      }
      prevLine = { y: line.y, maxSize: meta.maxSize };
    });

    return paras;
  }

  /* Median body font size across sampled runs of the whole document */
  function medianBodySize(allRuns) {
    if (!allRuns.length) return 11;
    const sizes = allRuns.map(r => r.size).sort((a, b) => a - b);
    return sizes[Math.floor(sizes.length / 2)];
  }

  /* ---------- .docx generation ---------- */

  function runXml(seg, halfPointSize) {
    let rPr = '';
    if (seg.bold) rPr += '<w:b/>';
    if (seg.italic) rPr += '<w:i/>';
    if (halfPointSize) rPr += `<w:sz w:val="${halfPointSize}"/><w:szCs w:val="${halfPointSize}"/>`;
    const props = rPr ? `<w:rPr>${rPr}</w:rPr>` : '';
    return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(seg.text)}</w:t></w:r>`;
  }

  function paraXml(para) {
    let pPr = '';
    if (para.heading === 1) pPr += '<w:pStyle w:val="Heading1"/>';
    else if (para.heading === 2) pPr += '<w:pStyle w:val="Heading2"/>';
    if (para.align === 'center') pPr += '<w:jc w:val="center"/>';
    const props = pPr ? `<w:pPr>${pPr}</w:pPr>` : '';
    /* Headings get their size from the style; body runs keep detected size differences subtle */
    const runs = para.segments.map(s => runXml(s, para.heading ? 0 : 0)).join('');
    return `<w:p>${props}${runs}</w:p>`;
  }

  async function buildDocx(pages, opts) {
    let bodyXml = '';
    pages.forEach((paras, pageIndex) => {
      if (pageIndex > 0 && opts.pageBreaks) {
        bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }
      if (!paras.length) { bodyXml += '<w:p/>'; return; }
      paras.forEach(p => { bodyXml += paraXml(p); });
    });

    const font = opts.font || 'Calibri';

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    const word = zip.folder('word');
    word.file('document.xml', documentXml);
    word.file('styles.xml', stylesXml);
    word.folder('_rels').file('document.xml.rels', docRelsXml);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  /* Plain mode (Magic Layer off): the old line-by-line behaviour */
  function plainParagraphs(lines) {
    return lines.map(line => {
      const segs = lineToSegments(line).map(s => ({ text: s.text, bold: false, italic: false }));
      return { segments: segs, heading: 0, align: 'left', plain: segs.map(s => s.text).join('') };
    }).filter(p => p.plain.trim());
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.className = 'status';
    statusMsg.textContent = 'Reading your PDF...';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const magic = magicToggle ? magicToggle.checked : true;
      const opts = {
        flow: magic && (!layoutModeSel || layoutModeSel.value === 'flow'),
        dehyphen: magic && (!dehyphenToggle || dehyphenToggle.checked),
        pageBreaks: pageBreaksToggle ? pageBreaksToggle.checked : true,
        font: fontSel ? fontSel.value : 'Calibri'
      };

      adGate.run(numPages, async () => {
        try {
          statusMsg.textContent = magic ? '✨ Magic Layer: analyzing layout & typography...' : 'Extracting text...';

          const pageData = [];
          const allRuns = [];
          let blankPages = 0;
          for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 1 });
            const runs = await extractRuns(page);
            let pageChars = 0;
            runs.forEach(r => { if (r.str.trim()) { allRuns.push(r); pageChars += r.str.trim().length; } });
            if (pageChars < 5) blankPages++;
            pageData.push({ runs, width: viewport.width });
            progressBar.style.width = ((p / numPages) * 60) + '%';
          }

          /* A scanned (raster) PDF is a photo of a page — pdf.js finds no
             real text layer on it, so almost every page comes back near-empty. */
          if (numPages > 0 && (blankPages / numPages) > 0.6) {
            statusMsg.innerHTML = '⚠️ This looks like a scanned (image-based) PDF — ' + blankPages + ' of ' + numPages +
              ' page(s) had no real text. Magic Layer needs a text layer to work with; try the <a href="../pdf-tools/ocr-pdf.html">OCR PDF tool</a> first, or convert its output text file with this tool.';
            statusMsg.className = 'status';
            resultBox.classList.remove('show');
            convertBtn.disabled = false;
            progressWrap.classList.remove('show');
            return;
          }

          const bodySize = medianBodySize(allRuns);
          const pages = pageData.map((pd, i) => {
            const lines = clusterLines(pd.runs);
            progressBar.style.width = (60 + ((i + 1) / pageData.length) * 25) + '%';
            return magic ? buildParagraphs(lines, pd.width, bodySize, opts) : plainParagraphs(lines);
          });

          statusMsg.textContent = 'Building your Word document...';
          const blob = await buildDocx(pages, opts);
          progressBar.style.width = '100%';

          if (downloadLink.href && downloadLink.href.startsWith('blob:')) URL.revokeObjectURL(downloadLink.href);
          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.docx';

          resultBox.classList.add('show');
          const headings = pages.flat().filter(p => p.heading).length;
          statusMsg.textContent = magic
            ? `Done! ✨ Magic Layer rebuilt ${pages.flat().length} paragraphs (${headings} headings detected) with fonts & styling.`
            : 'Done! Text extracted into an editable Word document.';
          statusMsg.className = 'status success';
        } catch (err) {
          statusMsg.textContent = 'Something went wrong building the Word document.';
          console.error(err);
        } finally {
          convertBtn.disabled = false;
          progressWrap.classList.remove('show');
        }
      }, statusMsg, `This ${numPages}-page PDF`);
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF. It may be corrupted or password-protected.';
      console.error(err);
      convertBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  });
})();
