/* Word (DOCX) to PDF — best-effort conversion. mammoth.js turns the DOCX
   into HTML (text, headings, lists, basic formatting), then jsPDF renders
   that HTML into a PDF. Complex layouts, tables, and images may not be
   pixel-perfect -- this is a best-effort conversion, not a full Word engine. */

(function () {
  const dropzone = document.getElementById('dropzoneW2P');
  const fileInput = document.getElementById('fileInputW2P');
  const convertBtn = document.getElementById('w2pBtn');
  const statusMsg = document.getElementById('statusMsgW2P');
  const resultBox = document.getElementById('resultBoxW2P');
  const downloadLink = document.getElementById('downloadLinkW2P');
  const renderHost = document.getElementById('w2pRenderHost');

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
    const isDocx = /\.docx$/i.test(file.name);
    if (!isDocx) {
      statusMsg.textContent = 'Please choose a .docx file (older .doc files are not supported).';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a .docx file first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your document...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });

      renderHost.innerHTML = result.value;
      statusMsg.textContent = 'Rendering to PDF...';

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
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.pdf';

          resultBox.classList.add('show');
          statusMsg.textContent = 'Done! Note: this is a best-effort conversion — complex formatting, tables, or images may look different from the original.';
          statusMsg.className = 'status success';
          convertBtn.disabled = false;
        }
      });
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this document. Please try a different file.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });
})();
