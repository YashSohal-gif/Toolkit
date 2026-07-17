/* Excel (XLSX/XLS/CSV) to PDF — best-effort conversion. SheetJS parses the
   spreadsheet into an HTML table (first sheet), then jsPDF renders that
   table into a PDF. Charts, images, and complex formatting are not
   preserved -- this is a best-effort data-only conversion. */

(function () {
  const dropzone = document.getElementById('dropzoneE2P');
  const fileInput = document.getElementById('fileInputE2P');
  const convertBtn = document.getElementById('e2pBtn');
  const statusMsg = document.getElementById('statusMsgE2P');
  const resultBox = document.getElementById('resultBoxE2P');
  const downloadLink = document.getElementById('downloadLinkE2P');
  const renderHost = document.getElementById('e2pRenderHost');

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
    const ok = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!ok) {
      statusMsg.textContent = 'Please choose an .xlsx, .xls, or .csv file.';
      return;
    }
    selectedFile = file;
    dropzone.querySelector('p').textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    resultBox.classList.remove('show');
    statusMsg.textContent = '';
  }

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      statusMsg.textContent = 'Please choose a spreadsheet first.';
      return;
    }

    convertBtn.disabled = true;
    statusMsg.textContent = 'Reading your spreadsheet...';

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const htmlTable = XLSX.utils.sheet_to_html(sheet);

      renderHost.innerHTML = '<h3 style="font-family:Arial;">' + firstSheetName + '</h3>' + htmlTable;
      const tableEl = renderHost.querySelector('table');
      if (tableEl) {
        tableEl.style.borderCollapse = 'collapse';
        tableEl.querySelectorAll('td, th').forEach((cell) => {
          cell.style.border = '1px solid #999';
          cell.style.padding = '4px 8px';
          cell.style.fontSize = '11px';
        });
      }

      statusMsg.textContent = 'Rendering to PDF...';
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });

      await doc.html(renderHost, {
        margin: [30, 30, 30, 30],
        autoPaging: 'text',
        width: 780,
        windowWidth: 1000,
        callback: function (pdf) {
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          downloadLink.href = url;
          const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
          downloadLink.download = originalName + '.pdf';

          resultBox.classList.add('show');
          statusMsg.textContent = 'Done! Note: this converts the first sheet\'s data only — charts and images are not included.';
          statusMsg.className = 'status success';
          convertBtn.disabled = false;
        }
      });
    } catch (err) {
      statusMsg.textContent = 'Something went wrong converting this file. Please try a different spreadsheet.';
      console.error(err);
      convertBtn.disabled = false;
    }
  });
})();
