/* Rotates the highlighted word in the homepage hero pill, e.g.
   "Where your files get [Compressed / Converted / Created ...] in seconds."
   Pure CSS fade-slide handles the animation; this just swaps the text. */
(function () {
  var words = ['Compressed', 'Converted', 'Created', 'Merged', 'Resized', 'Organized'];
  var el = document.getElementById('heroRotatorWord');
  if (!el) return;

  var i = 0;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  setInterval(function () {
    i = (i + 1) % words.length;
    el.textContent = words[i];
    if (!reduceMotion) {
      el.classList.remove('rotator-word');
      void el.offsetWidth; /* restart the CSS animation */
      el.classList.add('rotator-word');
    }
  }, 2000);
})();
