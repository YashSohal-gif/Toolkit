/* PDF Forms — detect AcroForm fields (text, checkbox, radio group,
   dropdown) via pdf-lib, render a matching input for each, then write
   the values back into the fields and flatten/save the PDF. */

(function () {
  const dropzone = document.getElementById('dropzoneForms');
  const fileInput = document.getElementById('fileInputForms');
  const fieldsWrap = document.getElementById('formFieldsWrap');
  const fieldsList = document.getElementById('formFieldsList');
  const saveControls = document.getElementById('formsSaveControls');
  const saveBtn = document.getElementById('formsSaveBtn');
  const statusMsg = document.getElementById('statusMsgForms');
  const resultBox = document.getElementById('resultBoxForms');
  const downloadLink = document.getElementById('downloadLinkForms');
  const progressWrap = document.getElementById('progressWrapForms');
  const progressBar = document.getElementById('progressBarForms');

  if (!dropzone) return;

  let selectedFile = null;
  let detectedFields = []; // { name, type, widget }

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

  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      statusMsg.textContent = 'Please choose a PDF file.';
      return;
    }
    selectedFile = file;
    resultBox.classList.remove('show');
    statusMsg.textContent = 'Scanning for form fields...';
    fieldsList.innerHTML = '';
    fieldsWrap.style.display = 'none';
    saveControls.style.display = 'none';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const form = doc.getForm();
      const fields = form.getFields();

      if (fields.length === 0) {
        statusMsg.textContent = 'No fillable fields were detected in this PDF. Try the Edit PDF tool instead to add text manually.';
        statusMsg.className = 'status error';
        return;
      }

      detectedFields = fields.map((f) => ({ name: f.getName(), type: f.constructor.name }));
      renderFieldInputs();
      fieldsWrap.style.display = '';
      saveControls.style.display = '';
      statusMsg.textContent = 'Found ' + fields.length + ' field(s). Fill them in below, then save.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Could not read this PDF, or it has no readable form. Please try a different file.';
      console.error(err);
    }
  }

  function renderFieldInputs() {
    fieldsList.innerHTML = '';
    detectedFields.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'field';
      row.style.marginBottom = '14px';
      const label = document.createElement('label');
      label.textContent = f.name + ' (' + f.type.replace('PDF', '') + ')';
      row.appendChild(label);

      let input;
      if (f.type === 'PDFCheckBox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'formField' + idx;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.id = 'formField' + idx;
        input.placeholder = 'Enter value...';
      }
      row.appendChild(input);
      fieldsList.appendChild(row);
    });
  }

  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true;
    adGate.run(detectedFields.length || 1, async () => {
      await runSave();
    }, statusMsg, 'This ' + detectedFields.length + '-field form');
  });

  async function runSave() {
    statusMsg.textContent = 'Filling and saving your PDF... this happens in your browser, nothing is uploaded.';
    progressWrap.classList.add('show');
    progressBar.style.width = '10%';

    try {
      const { PDFDocument } = PDFLib;
      const bytes = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const form = doc.getForm();

      detectedFields.forEach((f, idx) => {
        const inputEl = document.getElementById('formField' + idx);
        try {
          const field = form.getField(f.name);
          if (f.type === 'PDFCheckBox') {
            if (inputEl.checked) field.check(); else field.uncheck();
          } else if (f.type === 'PDFTextField') {
            field.setText(inputEl.value || '');
          } else if (f.type === 'PDFDropdown' || f.type === 'PDFOptionList') {
            if (inputEl.value) field.select(inputEl.value);
          } else if (f.type === 'PDFRadioGroup') {
            if (inputEl.value) field.select(inputEl.value);
          }
        } catch (fieldErr) {
          console.warn('Could not set field ' + f.name, fieldErr);
        }
      });

      const flattenToggle = document.getElementById('formsFlatten');
      if (flattenToggle && flattenToggle.checked) {
        form.flatten(); // bakes values into the page content, removes the interactive widgets
      }

      progressBar.style.width = '80%';
      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      progressBar.style.width = '100%';

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
      downloadLink.download = originalName + '-filled.pdf';

      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your filled-out PDF is ready to download.';
      statusMsg.className = 'status success';
    } catch (err) {
      statusMsg.textContent = 'Something went wrong while saving this form. Please try again.';
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      progressWrap.classList.remove('show');
    }
  }
})();
