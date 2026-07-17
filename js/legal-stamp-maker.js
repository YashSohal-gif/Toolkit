/* Legal Stamp Maker — a small Canva-style editor. Layers (text, border/shape,
   image, signature) live as absolutely-positioned DOM elements on a stage;
   the same geometry is redrawn onto an offscreen canvas at export time. */

(function () {
  const stage = document.getElementById('stampStage');
  if (!stage) return;

  const presetSelect = document.getElementById('stampPreset');
  const customWField = document.getElementById('stampCustomW');
  const customHField = document.getElementById('stampCustomH');
  const customWInput = document.getElementById('stampCustomWidth');
  const customHInput = document.getElementById('stampCustomHeight');

  const propsEmpty = document.getElementById('stampPropsEmpty');
  const propsBody = document.getElementById('stampPropsBody');
  const layersList = document.getElementById('stampLayersList');

  const imageInput = document.getElementById('stampImageInput');
  const statusMsg = document.getElementById('statusMsgStamp');
  const resultBox = document.getElementById('resultBoxStamp');
  const downloadLink = document.getElementById('downloadLinkStamp');

  let layers = [];
  let nextId = 1;
  let selectedId = null;
  let stageW = 600, stageH = 300;
  const imageCache = new Map(); // layer.id -> HTMLImageElement

  function uid() { return 'layer-' + (nextId++); }

  function setStageSize(w, h) {
    stageW = w; stageH = h;
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
  }

  function applyPreset() {
    const v = presetSelect.value;
    customWField.style.display = v === 'custom' ? 'flex' : 'none';
    customHField.style.display = v === 'custom' ? 'flex' : 'none';
    if (v === 'circle-500') setStageSize(500, 500);
    else if (v === 'square-500') setStageSize(500, 500);
    else if (v === 'rect-600x300') setStageSize(600, 300);
    else setStageSize(parseInt(customWInput.value, 10) || 600, parseInt(customHInput.value, 10) || 300);
  }
  presetSelect.addEventListener('change', applyPreset);
  customWInput.addEventListener('input', () => { if (presetSelect.value === 'custom') applyPreset(); });
  customHInput.addEventListener('input', () => { if (presetSelect.value === 'custom') applyPreset(); });
  applyPreset();

  /* ---------- shared shape geometry (used for live preview + export) ---------- */

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawShape(ctx, w, h, layer) {
    ctx.clearRect(0, 0, w, h);
    const sw = layer.strokeWidth;
    ctx.lineWidth = sw;
    ctx.strokeStyle = layer.strokeColor;
    const hasFill = layer.fill && layer.fill !== 'none';
    if (hasFill) ctx.fillStyle = layer.fill;

    if (layer.shapeType === 'circle-single' || layer.shapeType === 'circle-double') {
      const rx1 = w / 2 - sw / 2, ry1 = h / 2 - sw / 2;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.max(rx1, 1), Math.max(ry1, 1), 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      ctx.stroke();
      if (layer.shapeType === 'circle-double') {
        const gap = Math.min(w, h) * 0.08;
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, Math.max(rx1 - gap, 1), Math.max(ry1 - gap, 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (layer.shapeType === 'rect' || layer.shapeType === 'rect-double') {
      const x = sw / 2, y = sw / 2, rw = w - sw, rh = h - sw;
      ctx.beginPath();
      ctx.rect(x, y, rw, rh);
      if (hasFill) ctx.fill();
      ctx.stroke();
      if (layer.shapeType === 'rect-double') {
        const gap = Math.min(w, h) * 0.08;
        ctx.beginPath();
        ctx.rect(x + gap, y + gap, rw - 2 * gap, rh - 2 * gap);
        ctx.stroke();
      }
    } else if (layer.shapeType === 'rect-rounded') {
      const x = sw / 2, y = sw / 2, rw = w - sw, rh = h - sw;
      roundRectPath(ctx, x, y, rw, rh, Math.min(rw, rh) * 0.14);
      if (hasFill) ctx.fill();
      ctx.stroke();
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const out = [];
    text.split('\n').forEach((paragraph) => {
      const words = paragraph.split(' ');
      let line = '';
      words.forEach((word) => {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      out.push(line);
    });
    return out;
  }

  function drawText(ctx, w, h, layer) {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${layer.bold ? 'bold ' : ''}${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, layer.text || '', w);
    const lineHeight = layer.fontSize * 1.15;
    const totalH = lineHeight * lines.length;
    let startY = h / 2 - totalH / 2 + lineHeight / 2;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineHeight));
  }

  /* ---------- background removal (chroma-key on white) ---------- */

  function removeWhiteBackground(imgEl, threshold = 235, softness = 45) {
    const c = document.createElement('canvas');
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const cx = c.getContext('2d');
    cx.drawImage(imgEl, 0, 0);
    const data = cx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (lum > threshold) {
        px[i + 3] = 0;
      } else if (lum > threshold - softness) {
        const t = (threshold - lum) / softness;
        px[i + 3] = Math.round(px[i + 3] * t);
      }
    }
    cx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
  }

  /* ---------- layer factory ---------- */

  function makeLayer(type, extra) {
    const base = {
      id: uid(),
      type,
      x: stageW * 0.2,
      y: stageH * 0.2,
      w: stageW * 0.6,
      h: stageH * 0.6,
      rot: 0,
    };
    return Object.assign(base, extra);
  }

  function addTextLayer() {
    const layer = makeLayer('text', {
      w: stageW * 0.7, h: Math.min(stageH * 0.4, 90),
      text: 'COMPANY NAME',
      fontFamily: 'Arial, sans-serif',
      fontSize: 28,
      color: '#0f172a',
      bold: true,
    });
    layer.x = (stageW - layer.w) / 2;
    layer.y = (stageH - layer.h) / 2;
    layers.push(layer);
    selectLayer(layer.id);
    renderAll();
  }

  function addShapeLayer() {
    const round = presetSelect.value.indexOf('circle') === 0 || presetSelect.value.indexOf('square') === 0;
    const layer = makeLayer('shape', {
      w: stageW * 0.85, h: stageH * 0.85,
      shapeType: round ? 'circle-double' : 'rect-double',
      strokeColor: '#1d4ed8',
      strokeWidth: 4,
      fill: 'none',
    });
    layer.x = (stageW - layer.w) / 2;
    layer.y = (stageH - layer.h) / 2;
    layers.unshift(layer); // shapes default to the back
    selectLayer(layer.id);
    renderAll();
  }

  function addImageLayerFromDataUrl(dataUrl, removeBg) {
    const img = new Image();
    img.onload = () => {
      const maxDim = Math.min(stageW, stageH) * 0.5;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      const layer = makeLayer('image', {
        w, h,
        originalSrc: dataUrl,
        src: dataUrl,
        removeBg: !!removeBg,
      });
      layer.x = (stageW - w) / 2;
      layer.y = (stageH - h) / 2;
      if (removeBg) layer.src = removeWhiteBackground(img);
      layers.push(layer);
      const cacheImg = new Image();
      cacheImg.onload = () => { imageCache.set(layer.id, cacheImg); renderAll(); };
      cacheImg.src = layer.src;
      selectLayer(layer.id);
      renderAll();
    };
    img.src = dataUrl;
  }

  document.getElementById('stampAddText').addEventListener('click', addTextLayer);
  document.getElementById('stampAddShape').addEventListener('click', addShapeLayer);
  document.getElementById('stampAddImage').addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addImageLayerFromDataUrl(ev.target.result, false);
    reader.readAsDataURL(file);
    imageInput.value = '';
  });

  document.getElementById('stampDuplicate').addEventListener('click', () => {
    const layer = getSelected();
    if (!layer) return;
    const clone = JSON.parse(JSON.stringify(layer));
    clone.id = uid();
    clone.x += 16; clone.y += 16;
    layers.push(clone);
    if (imageCache.has(layer.id)) imageCache.set(clone.id, imageCache.get(layer.id));
    selectLayer(clone.id);
    renderAll();
  });

  document.getElementById('stampDelete').addEventListener('click', () => deleteLayer(selectedId));

  function deleteLayer(id) {
    if (!id) return;
    layers = layers.filter((l) => l.id !== id);
    imageCache.delete(id);
    if (selectedId === id) selectedId = null;
    renderAll();
  }

  function getSelected() { return layers.find((l) => l.id === selectedId) || null; }

  function selectLayer(id) {
    selectedId = id;
    renderAll();
  }

  /* ---------- DOM rendering ---------- */

  function ensureLayerDom(layer) {
    let el = document.getElementById(layer.id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'stamp-layer';
    el.id = layer.id;

    let content;
    if (layer.type === 'text') {
      content = document.createElement('div');
      content.className = 'stamp-text-el';
    } else if (layer.type === 'shape') {
      content = document.createElement('canvas');
    } else {
      content = document.createElement('img');
      content.draggable = false;
    }
    el.appendChild(content);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'stamp-handle stamp-handle-resize';
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'stamp-handle stamp-handle-rotate';
    const deleteHandle = document.createElement('div');
    deleteHandle.className = 'stamp-handle stamp-handle-delete';
    deleteHandle.textContent = '×';
    el.appendChild(resizeHandle);
    el.appendChild(rotateHandle);
    el.appendChild(deleteHandle);

    el.addEventListener('pointerdown', (e) => startOp(e, layer.id, 'drag'));
    resizeHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startOp(e, layer.id, 'resize'); });
    rotateHandle.addEventListener('pointerdown', (e) => { e.stopPropagation(); startOp(e, layer.id, 'rotate'); });
    deleteHandle.addEventListener('pointerdown', (e) => e.stopPropagation());
    deleteHandle.addEventListener('click', (e) => { e.stopPropagation(); deleteLayer(layer.id); });

    stage.appendChild(el);
    return el;
  }

  function paintLayerDom(layer) {
    const el = ensureLayerDom(layer);
    el.style.left = layer.x + 'px';
    el.style.top = layer.y + 'px';
    el.style.width = layer.w + 'px';
    el.style.height = layer.h + 'px';
    el.style.transform = `rotate(${layer.rot}deg)`;
    el.style.zIndex = String(layers.indexOf(layer) + 1);
    el.classList.toggle('selected', layer.id === selectedId);

    if (layer.type === 'text') {
      const content = el.querySelector('.stamp-text-el');
      content.textContent = layer.text;
      content.style.fontFamily = layer.fontFamily;
      content.style.fontSize = layer.fontSize + 'px';
      content.style.color = layer.color;
      content.style.fontWeight = layer.bold ? '700' : '400';
    } else if (layer.type === 'shape') {
      const canvas = el.querySelector('canvas');
      canvas.width = layer.w;
      canvas.height = layer.h;
      drawShape(canvas.getContext('2d'), layer.w, layer.h, layer);
    } else if (layer.type === 'image') {
      const img = el.querySelector('img');
      if (img.src !== layer.src) img.src = layer.src;
    }
  }

  function renderStage() {
    layers.forEach(paintLayerDom);
    // remove DOM nodes for deleted layers
    Array.from(stage.children).forEach((child) => {
      if (!layers.some((l) => l.id === child.id)) child.remove();
    });
  }

  function renderLayersList() {
    layersList.innerHTML = '';
    if (!layers.length) {
      layersList.innerHTML = '<p class="stamp-panel-empty">No layers yet.</p>';
      return;
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const row = document.createElement('div');
      row.className = 'stamp-layer-item' + (layer.id === selectedId ? ' active' : '');
      const label = layer.type === 'text' ? (layer.text || 'Text').slice(0, 18)
        : layer.type === 'shape' ? 'Shape: ' + layer.shapeType
        : 'Image';
      row.innerHTML = `<span class="name">${label}</span>
        <button data-act="up" title="Move up">▲</button>
        <button data-act="down" title="Move down">▼</button>
        <button data-act="del" title="Delete">🗑</button>`;
      row.addEventListener('click', (e) => {
        if (e.target.dataset.act) return;
        selectLayer(layer.id);
      });
      row.querySelector('[data-act="up"]').addEventListener('click', () => moveLayer(layer.id, 1));
      row.querySelector('[data-act="down"]').addEventListener('click', () => moveLayer(layer.id, -1));
      row.querySelector('[data-act="del"]').addEventListener('click', () => deleteLayer(layer.id));
      layersList.appendChild(row);
    }
  }

  function moveLayer(id, dir) {
    const idx = layers.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= layers.length) return;
    [layers[idx], layers[swapIdx]] = [layers[swapIdx], layers[idx]];
    renderAll();
  }

  /* ---------- properties panel ---------- */

  function renderProps() {
    const layer = getSelected();
    if (!layer) {
      propsEmpty.style.display = 'block';
      propsBody.innerHTML = '';
      return;
    }
    propsEmpty.style.display = 'none';

    let html = `
      <div class="stamp-field-row">
        <label>Width</label>
        <input type="number" id="pWidth" min="10" value="${Math.round(layer.w)}">
      </div>
      <div class="stamp-field-row">
        <label>Height</label>
        <input type="number" id="pHeight" min="10" value="${Math.round(layer.h)}">
      </div>
      <div class="stamp-field-row">
        <label>Rotation (deg)</label>
        <input type="number" id="pRot" value="${Math.round(layer.rot)}">
      </div>`;

    if (layer.type === 'text') {
      html += `
        <div class="stamp-field-row">
          <label>Text</label>
          <textarea id="pText">${escapeHtml(layer.text)}</textarea>
        </div>
        <div class="stamp-field-row">
          <label>Font</label>
          <select id="pFont">
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Segoe Script', cursive">Script</option>
          </select>
        </div>
        <div class="stamp-field-row">
          <label>Font size: <span id="pSizeVal">${layer.fontSize}</span>px</label>
          <input type="range" id="pSize" min="10" max="120" value="${layer.fontSize}">
        </div>
        <div class="stamp-field-row">
          <label><input type="checkbox" id="pBold" ${layer.bold ? 'checked' : ''}> Bold</label>
        </div>
        <div class="stamp-field-row">
          <label>Color</label>
          <input type="color" id="pColor" value="${layer.color}">
        </div>`;
    } else if (layer.type === 'shape') {
      html += `
        <div class="stamp-field-row">
          <label>Shape</label>
          <select id="pShapeType">
            <option value="circle-single">Circle (single line)</option>
            <option value="circle-double">Circle (double line)</option>
            <option value="rect">Rectangle</option>
            <option value="rect-rounded">Rounded rectangle</option>
            <option value="rect-double">Rectangle (double line)</option>
          </select>
        </div>
        <div class="stamp-field-row">
          <label>Line color</label>
          <input type="color" id="pStrokeColor" value="${layer.strokeColor}">
        </div>
        <div class="stamp-field-row">
          <label>Line width: <span id="pStrokeWidthVal">${layer.strokeWidth}</span>px</label>
          <input type="range" id="pStrokeWidth" min="1" max="20" value="${layer.strokeWidth}">
        </div>
        <div class="stamp-field-row">
          <label><input type="checkbox" id="pFillOn" ${layer.fill !== 'none' ? 'checked' : ''}> Filled</label>
        </div>
        <div class="stamp-field-row" id="pFillColorRow" style="${layer.fill !== 'none' ? '' : 'display:none;'}">
          <label>Fill color</label>
          <input type="color" id="pFillColor" value="${layer.fill !== 'none' ? layer.fill : '#ffffff'}">
        </div>`;
    } else if (layer.type === 'image') {
      html += `
        <div class="stamp-field-row">
          <label><input type="checkbox" id="pRemoveBg" ${layer.removeBg ? 'checked' : ''}> Remove white background</label>
        </div>`;
    }

    propsBody.innerHTML = html;
    wireProps(layer);
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function wireProps(layer) {
    const byId = (id) => document.getElementById(id);

    byId('pWidth').addEventListener('input', (e) => { layer.w = Math.max(10, parseFloat(e.target.value) || layer.w); paintLayerDom(layer); });
    byId('pHeight').addEventListener('input', (e) => { layer.h = Math.max(10, parseFloat(e.target.value) || layer.h); paintLayerDom(layer); });
    byId('pRot').addEventListener('input', (e) => { layer.rot = parseFloat(e.target.value) || 0; paintLayerDom(layer); });

    if (layer.type === 'text') {
      const fontSel = byId('pFont');
      fontSel.value = layer.fontFamily;
      byId('pText').addEventListener('input', (e) => { layer.text = e.target.value; paintLayerDom(layer); renderLayersList(); });
      fontSel.addEventListener('change', (e) => { layer.fontFamily = e.target.value; paintLayerDom(layer); });
      byId('pSize').addEventListener('input', (e) => { layer.fontSize = parseInt(e.target.value, 10); byId('pSizeVal').textContent = layer.fontSize; paintLayerDom(layer); });
      byId('pBold').addEventListener('change', (e) => { layer.bold = e.target.checked; paintLayerDom(layer); });
      byId('pColor').addEventListener('input', (e) => { layer.color = e.target.value; paintLayerDom(layer); });
    } else if (layer.type === 'shape') {
      const shapeSel = byId('pShapeType');
      shapeSel.value = layer.shapeType;
      shapeSel.addEventListener('change', (e) => { layer.shapeType = e.target.value; paintLayerDom(layer); renderLayersList(); });
      byId('pStrokeColor').addEventListener('input', (e) => { layer.strokeColor = e.target.value; paintLayerDom(layer); });
      byId('pStrokeWidth').addEventListener('input', (e) => { layer.strokeWidth = parseInt(e.target.value, 10); byId('pStrokeWidthVal').textContent = layer.strokeWidth; paintLayerDom(layer); });
      byId('pFillOn').addEventListener('change', (e) => {
        const fillColorRow = byId('pFillColorRow');
        if (e.target.checked) {
          layer.fill = byId('pFillColor').value;
          fillColorRow.style.display = '';
        } else {
          layer.fill = 'none';
          fillColorRow.style.display = 'none';
        }
        paintLayerDom(layer);
      });
      const fillColorEl = byId('pFillColor');
      if (fillColorEl) fillColorEl.addEventListener('input', (e) => { layer.fill = e.target.value; paintLayerDom(layer); });
    } else if (layer.type === 'image') {
      byId('pRemoveBg').addEventListener('change', (e) => {
        layer.removeBg = e.target.checked;
        const img = new Image();
        img.onload = () => {
          layer.src = layer.removeBg ? removeWhiteBackground(img) : layer.originalSrc;
          paintLayerDom(layer);
          const cacheImg = new Image();
          cacheImg.onload = () => imageCache.set(layer.id, cacheImg);
          cacheImg.src = layer.src;
        };
        img.src = layer.originalSrc;
      });
    }
  }

  function renderAll() {
    renderStage();
    renderLayersList();
    renderProps();
  }

  /* ---------- drag / resize / rotate ---------- */

  let op = null;

  function startOp(e, id, mode) {
    e.preventDefault();
    selectLayer(id);
    const layer = getSelected();
    if (!layer) return;
    op = {
      mode, layer,
      startClientX: e.clientX, startClientY: e.clientY,
      origX: layer.x, origY: layer.y, origW: layer.w, origH: layer.h, origRot: layer.rot,
    };
    if (mode === 'rotate') {
      const rect = document.getElementById(layer.id).getBoundingClientRect();
      op.centerX = rect.left + rect.width / 2;
      op.centerY = rect.top + rect.height / 2;
    }
    window.addEventListener('pointermove', onOpMove);
    window.addEventListener('pointerup', onOpEnd);
  }

  function onOpMove(e) {
    if (!op) return;
    const dx = e.clientX - op.startClientX;
    const dy = e.clientY - op.startClientY;
    const layer = op.layer;
    if (op.mode === 'drag') {
      layer.x = op.origX + dx;
      layer.y = op.origY + dy;
    } else if (op.mode === 'resize') {
      layer.w = Math.max(14, op.origW + dx);
      layer.h = Math.max(14, op.origH + dy);
    } else if (op.mode === 'rotate') {
      const angle = Math.atan2(e.clientY - op.centerY, e.clientX - op.centerX);
      layer.rot = Math.round((angle * 180 / Math.PI) + 90);
    }
    paintLayerDom(layer);
    if (op.mode === 'resize' && (layer.type === 'text')) { /* live text reflow handled by paintLayerDom */ }
  }

  function onOpEnd() {
    if (op && (op.mode === 'resize' || op.mode === 'rotate')) renderProps();
    op = null;
    window.removeEventListener('pointermove', onOpMove);
    window.removeEventListener('pointerup', onOpEnd);
  }

  /* ---------- signature modal ---------- */

  const sigModal = document.getElementById('stampSigModal');
  const sigModalClose = document.getElementById('stampSigModalClose');
  const sigModeRadios = document.querySelectorAll('input[name="stampSigMode"]');
  const sigDrawPanel = document.getElementById('stampSigDrawPanel');
  const sigTypePanel = document.getElementById('stampSigTypePanel');
  const sigUploadPanel = document.getElementById('stampSigUploadPanel');
  const sigCanvas = document.getElementById('stampSigCanvas');
  const sigCtx = sigCanvas.getContext('2d');
  const sigClearBtn = document.getElementById('stampSigClearBtn');
  const sigTypeInput = document.getElementById('stampSigTypeInput');
  const sigFont = document.getElementById('stampSigFont');
  const sigTypePreview = document.getElementById('stampSigTypePreview');
  const sigDropzone = document.getElementById('stampSigDropzone');
  const sigUploadInput = document.getElementById('stampSigUploadInput');
  const sigRemoveBg = document.getElementById('stampSigRemoveBg');
  const sigUploadPreviewWrap = document.getElementById('stampSigUploadPreviewWrap');
  const sigUploadPreview = document.getElementById('stampSigUploadPreview');
  const sigAddBtn = document.getElementById('stampSigAddBtn');

  let sigDrawing = false, sigHasDrawn = false, sigLastX = 0, sigLastY = 0;
  let sigUploadedImg = null;

  document.getElementById('stampAddSignature').addEventListener('click', () => {
    sigModal.classList.add('show');
    resizeSigCanvas();
  });
  sigModalClose.addEventListener('click', () => sigModal.classList.remove('show'));
  sigModal.addEventListener('click', (e) => { if (e.target === sigModal) sigModal.classList.remove('show'); });

  function resizeSigCanvas() {
    const rect = sigCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    sigCanvas.width = rect.width * dpr;
    sigCanvas.height = rect.height * dpr;
    sigCtx.scale(dpr, dpr);
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0f172a';
  }

  function sigPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }
  function sigStart(e) { sigDrawing = true; sigHasDrawn = true; const p = sigPos(e); sigLastX = p.x; sigLastY = p.y; }
  function sigMove(e) {
    if (!sigDrawing) return;
    e.preventDefault();
    const p = sigPos(e);
    sigCtx.beginPath(); sigCtx.moveTo(sigLastX, sigLastY); sigCtx.lineTo(p.x, p.y); sigCtx.stroke();
    sigLastX = p.x; sigLastY = p.y;
  }
  function sigEnd() { sigDrawing = false; }
  sigCanvas.addEventListener('mousedown', sigStart);
  sigCanvas.addEventListener('mousemove', sigMove);
  window.addEventListener('mouseup', sigEnd);
  sigCanvas.addEventListener('touchstart', sigStart, { passive: true });
  sigCanvas.addEventListener('touchmove', sigMove, { passive: false });
  sigCanvas.addEventListener('touchend', sigEnd);
  sigClearBtn.addEventListener('click', () => { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sigHasDrawn = false; });

  sigModeRadios.forEach((r) => r.addEventListener('change', () => {
    const mode = document.querySelector('input[name="stampSigMode"]:checked').value;
    sigDrawPanel.style.display = mode === 'draw' ? 'block' : 'none';
    sigTypePanel.style.display = mode === 'type' ? 'block' : 'none';
    sigUploadPanel.style.display = mode === 'upload' ? 'block' : 'none';
  }));

  function updateSigTypePreview() {
    sigTypePreview.textContent = sigTypeInput.value || 'Your Signature';
    sigTypePreview.style.fontFamily = sigFont.value;
  }
  sigTypeInput.addEventListener('input', updateSigTypePreview);
  sigFont.addEventListener('change', updateSigTypePreview);
  updateSigTypePreview();

  sigDropzone.addEventListener('click', () => sigUploadInput.click());
  sigDropzone.addEventListener('dragover', (e) => { e.preventDefault(); sigDropzone.classList.add('dragover'); });
  sigDropzone.addEventListener('dragleave', () => sigDropzone.classList.remove('dragover'));
  sigDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    sigDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleSigUpload(e.dataTransfer.files[0]);
  });
  sigUploadInput.addEventListener('change', (e) => { if (e.target.files.length) handleSigUpload(e.target.files[0]); });
  sigRemoveBg.addEventListener('change', renderSigUploadPreview);

  function handleSigUpload(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { sigUploadedImg = img; renderSigUploadPreview(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderSigUploadPreview() {
    if (!sigUploadedImg) return;
    sigUploadPreviewWrap.style.display = 'block';
    const dataUrl = sigRemoveBg.checked ? removeWhiteBackground(sigUploadedImg) : sigUploadedImg.src;
    const img = new Image();
    img.onload = () => {
      sigUploadPreview.width = img.naturalWidth;
      sigUploadPreview.height = img.naturalHeight;
      sigUploadPreview.getContext('2d').drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  sigAddBtn.addEventListener('click', () => {
    const mode = document.querySelector('input[name="stampSigMode"]:checked').value;
    if (mode === 'draw') {
      if (!sigHasDrawn) return;
      sigCanvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => { addImageLayerFromDataUrl(reader.result, false); sigModal.classList.remove('show'); };
        reader.readAsDataURL(blob);
      });
    } else if (mode === 'type') {
      const text = sigTypeInput.value.trim() || 'Signature';
      const outCanvas = document.createElement('canvas');
      outCanvas.width = 700; outCanvas.height = 220;
      const octx = outCanvas.getContext('2d');
      octx.font = '80px ' + sigFont.value;
      octx.fillStyle = '#0f172a';
      octx.textBaseline = 'middle'; octx.textAlign = 'center';
      octx.fillText(text, outCanvas.width / 2, outCanvas.height / 2);
      addImageLayerFromDataUrl(outCanvas.toDataURL('image/png'), false);
      sigModal.classList.remove('show');
    } else if (mode === 'upload') {
      if (!sigUploadedImg) return;
      addImageLayerFromDataUrl(sigUploadedImg.src, sigRemoveBg.checked);
      sigModal.classList.remove('show');
    }
  });

  /* ---------- export ---------- */

  document.getElementById('stampDownloadBtn').addEventListener('click', () => {
    if (!layers.length) {
      statusMsg.textContent = 'Add at least one layer to your stamp first.';
      return;
    }
    const format = document.getElementById('stampExportFormat').value;
    const scale = parseFloat(document.getElementById('stampExportScale').value);
    const out = document.createElement('canvas');
    out.width = stageW * scale;
    out.height = stageH * scale;
    const ctx = out.getContext('2d');
    ctx.scale(scale, scale);

    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, stageW, stageH);
    }

    layers.forEach((layer) => {
      ctx.save();
      ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2);
      ctx.rotate(layer.rot * Math.PI / 180);
      ctx.translate(-layer.w / 2, -layer.h / 2);
      if (layer.type === 'shape') {
        drawShape(ctx, layer.w, layer.h, layer);
      } else if (layer.type === 'text') {
        drawText(ctx, layer.w, layer.h, layer);
      } else if (layer.type === 'image') {
        const cached = imageCache.get(layer.id);
        if (cached) ctx.drawImage(cached, 0, 0, layer.w, layer.h);
      }
      ctx.restore();
    });

    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    out.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = 'legal-stamp.' + (format === 'jpg' ? 'jpg' : 'png');
      resultBox.classList.add('show');
      statusMsg.textContent = 'Done! Your stamp is ready to download.';
      statusMsg.className = 'status success';
    }, mime, 0.95);
  });

  renderAll();
})();
