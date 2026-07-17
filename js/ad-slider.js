/* Reusable sliding ad carousel.
   Drop an .ad-slider element (with .ad-slider-track > .ad-slide children
   and an empty .ad-slider-dots container) anywhere on a page and this
   will auto-rotate through the slides with a smooth slide animation. */
(function () {
  function initSlider(slider) {
    var track = slider.querySelector('.ad-slider-track');
    var dotsWrap = slider.querySelector('.ad-slider-dots');
    if (!track) return;
    var slides = track.querySelectorAll('.ad-slide');
    if (slides.length <= 1) return;

    var index = 0;
    var intervalMs = 5000;
    var timer = null;

    for (var i = 0; i < slides.length; i++) {
      (function (i) {
        var dot = document.createElement('button');
        dot.className = 'ad-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Show ad ' + (i + 1));
        dot.addEventListener('click', function () {
          goTo(i);
          restart();
        });
        if (dotsWrap) dotsWrap.appendChild(dot);
      })(i);
    }
    var dots = dotsWrap ? dotsWrap.querySelectorAll('.ad-dot') : [];

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('active', d === index);
      }
    }

    function next() {
      goTo(index + 1);
    }

    function start() {
      timer = setInterval(next, intervalMs);
    }

    function restart() {
      if (timer) clearInterval(timer);
      start();
    }

    start();

    slider.addEventListener('mouseenter', function () {
      if (timer) clearInterval(timer);
    });
    slider.addEventListener('mouseleave', start);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sliders = document.querySelectorAll('.ad-slider');
    for (var i = 0; i < sliders.length; i++) initSlider(sliders[i]);
  });
})();
