/* Reusable before/after comparison slider. Call setupBeforeAfterSlider()
   once per page after the slider's markup exists in the DOM; it wires up
   drag-to-compare via Pointer Events (works for mouse, touch, and pen). */
window.setupBeforeAfterSlider = function (sliderEl) {
  if (!sliderEl || sliderEl.dataset.baWired) return;
  sliderEl.dataset.baWired = '1';

  function setPos(clientX) {
    const rect = sliderEl.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    sliderEl.style.setProperty('--ba-pos', pct + '%');
  }

  sliderEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setPos(e.clientX);
    function onMove(ev) { setPos(ev.clientX); }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
};
