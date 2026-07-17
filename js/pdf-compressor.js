/* PDF Compressor Engine
   Renders each PDF page to an image, compresses those images down toward a target
   total file size, then rebuilds a new PDF from the compressed pages.
   Runs fully in the browser via pdf.js (read) + jsPDF (write) -- nothing uploaded.
*/

(function () {
  const dropzone = document.getElementById('dropzonePdf');
  const fileInput = document.getElementById('fileInputPdf');
  const targetSizeInput = document.getElementById('targetSizePdf');
  const targetUnitGroup = document.getElementById('targetUnitPdf');
  let targetUnitValue = 'KB';
  const compressBtn = document.getElementById('compressBtnPdf');
  const statusMsg = document.getElementById('statusMsgPdf');
  const resultBox = document.getElementById('resultBoxPdf');
  const originalSizeEl = document.getElementById('originalSizePdf');
  const compressedSizeEl = document.getElementById('compressedSizePdf');
  const downloadLink = document.getElementById('downloadLinkPdf');
  const progressWrap = document.getElementById('progressWrapPdf');
  const progressBar = document.getElementById('progressBarPdf');

  if (!dropzone) return;

  let selectedFile = null;

  if (targetUnitGroup) {
    targetUnitGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        targetUnitGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetUnitValue = btn.dataset.value;
      });
    });
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
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
    showFontInfo(file);
  }

  // =========================================================================
  // Font & embedding info — this compressor rasterizes every page to an
  // image, which destroys selectable text and any embedded fonts in the
  // process. This reads the source PDF's font table via pdf-lib so the user
  // knows what they're trading away *before* compressing, not after.
  // =========================================================================
  const fontInfoBox = document.getElementById('pdfFontInfo');

  async function analyzeFonts(file) {
    const { PDFDocument, PDFName, PDFDict, PDFArray } = PDFLib;
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const ctx = doc.context;
    const seen = new Set();
    const fonts = [];

    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFDict)) continue;
      const typeName = obj.get(PDFName.of('Type'));
      if (!typeName || typeName.toString() !== '/Font') continue;
      const key = ref.toString();
      if (seen.has(key)) continue;
      seen.add(key);

      let descriptor = obj.get(PDFName.of('FontDescriptor'));
      if (!descriptor) {
        // Composite (Type0) fonts keep their descriptor under DescendantFonts[0]
        const descendantsRef = obj.get(PDFName.of('DescendantFonts'));
        if (descendantsRef) {
          const arr = ctx.lookup(descendantsRef);
          if (arr instanceof PDFArray && arr.size() > 0) {
            const df = ctx.lookup(arr.get(0));
            if (df instanceof PDFDict) descriptor = df.get(PDFName.of('FontDescriptor'));
          }
        }
      }

      let embedded = false;
      if (descriptor) {
        const fd = ctx.lookup(descriptor);
        if (fd instanceof PDFDict) {
          embedded = !!(fd.get(PDFName.of('FontFile')) || fd.get(PDFName.of('FontFile2')) || fd.get(PDFName.of('FontFile3')));
        }
      }

      const baseFontObj = obj.get(PDFName.of('BaseFont'));
      const baseFont = baseFontObj ? baseFontObj.toString().replace(/^\//, '') : 'Unknown';
      const isSubset = /^[A-Z]{6}\+/.test(baseFont);
      fonts.push({ name: isSubset ? baseFont.slice(7) : baseFont, embedded, subset: isSubset });
    }
    return fonts;
  }

  async function showFontInfo(file) {
    if (!fontInfoBox || typeof PDFLib === 'undefined') return;
    fontInfoBox.style.display = 'none';
    try {
      const fonts = await analyzeFonts(file);
      if (fonts.length === 0) {
        fontInfoBox.textContent = 'No font table found — this PDF may be entirely image-based already.';
        fontInfoBox.style.display = 'block';
        return;
      }
      const embeddedSubset = fonts.filter(f => f.embedded && f.subset).length;
      const embeddedFull = fonts.filter(f => f.embedded && !f.subset).length;
      const notEmbedded = fonts.filter(f => !f.embedded).length;
      const parts = [];
      if (embeddedSubset) parts.push(embeddedSubset + ' embedded (subset)');
      if (embeddedFull) parts.push(embeddedFull + ' embedded (fully)');
      if (notEmbedded) parts.push(notEmbedded + ' not embedded');
      fontInfoBox.innerHTML = '<b>' + fonts.length + ' font' + (fonts.length === 1 ? '' : 's') + ' found:</b> ' + parts.join(', ') +
        '. ⚠️ Compressing rasterizes every page to an image — all text (and these fonts) will no longer be selectable in the output, regardless of this. If you need to keep selectable text, skip compression or try a smaller target size on a text-light PDF instead.';
      fontInfoBox.style.display = 'block';
    } catch (e) {
      console.warn('Could not analyze fonts', e);
    }
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function renderPageToCanvas(page, scale) {
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return canvas;
  }

  async function buildPdfFromPages(pageDataUrls, pageSizes) {
    const jsPDF = window.jspdf.jsPDF;
    let doc = null;
    for (let i = 0; i < pageDataUrls.length; i++) {
      const width = pageSizes[i].width;
      const height = pageSizes[i].height;
      const orientation = width > height ? 'l' : 'p';
      if (i === 0) {
        doc = new jsPDF({ orientation: orientation, unit: 'pt', format: [width, height] });
      } else {
        doc.addPage([width, height], orientation);
      }
      doc.addImage(pageDataUrls[i], 'JPEG', 0, 0, width, height);
    }
    return doc.output('blob');
  }

  async function compressPdfToTarget(pdf, targetKB, onProgress) {
    const numPages = pdf.numPages;

    let scale = 1.5;
    let quality = 0.75;
    let outputBlob = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const pageDataUrls = [];
      const pageSizes = [];

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const canvas = await renderPageToCanvas(page, scale);
        const blob = await canvasToBlob(canvas, quality);
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        pageDataUrls.push(dataUrl);
        pageSizes.push({ width: canvas.width * (72 / 96), height: canvas.height * (72 / 96) });
        onProgress(((p / numPages) * 70) + (attempt * 5));
      }

      outputBlob = await buildPdfFromPages(pageDataUrls, pageSizes);
      onProgress(85);

      if (outputBlob.size / 1024 <= targetKB || (scale <= 0.5 && quality <= 0.2)) {
        break;
      }

      quality = Math.max(0.2, quality - 0.15);
      if (attempt >= 2) scale = Math.max(0.5, scale - 0.3);
    }

    onProgress(100);
    return outputBlob;
  }

  compressBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a PDF first.';
      return;
    }
    const rawTarget = parseFloat(targetSizeInput.value);
    if (!rawTarget || rawTarget <= 0) {
      statusMsg.textContent = 'Please enter a valid target size.';
      return;
    }
    const unit = targetUnitValue;
    const targetKB = unit === 'MB' ? rawTarget * 1024 : rawTarget;

    compressBtn.disabled = true;
    statusMsg.textContent = 'Reading your PDF...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      adGate.run(numPages, async () => {
        await runCompression(pdf, targetKB);
      }, statusMsg, 'This ' + numPages + '-page PDF');
    } catch (err) {
      statusMsg.textContent = 'Something went wrong reading the PDF. Please try a different file.';
      console.error(err);
      compressBtn.disabled = false;
    }
  });

  async function runCompression(pdf, targetKB) {
    statusMsg.textContent = 'Compressing... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';

    try {
      const blob = await compressPdfToTarget(pdf, targetKB, (pct) => {
        progressBar.style.width = Math.min(100, pct) + '%';
      });

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-compressed.pdf';

      originalSizeEl.textContent = (selectedFile.size / 1024).toFixed(1) + ' KB';
      compressedSizeEl.textContent = (blob.size / 1024).toFixed(1) + ' KB';

      resultBox.classList.add('show');
      const achieved = blob.size / 1024;
      if (achieved <= targetKB * 1.1) {
        statusMsg.textContent = 'Done! Your PDF is ready to download.';
        statusMsg.className = 'status success';
      } else {
        statusMsg.textContent = 'Compressed as much as possible while keeping it readable -- could not fully reach the target.';
        statusMsg.className = 'status';
      }
    } catch (err) {
      statusMsg.textContent = 'Something went wrong. Please try a different PDF.';
      console.error(err);
    } finally {
      compressBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
