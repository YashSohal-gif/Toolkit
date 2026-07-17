/* Video Ad Carousel — coverflow-style featured video ad slot. Center
   card is shown sharp and full-size; neighbors are scaled down, blurred,
   and dimmed. Arrows advance/retreat one card; clicking a side card also
   jumps to it. Cards are placeholder ad slots — swap the .video-ad-thumb
   background-image (or add a real <video>/<iframe>) once real video ad
   creative is available. */

(function () {
  function initCarousel(section) {
    const carousel = section.querySelector('.video-ad-carousel');
    const track = section.querySelector('.video-ad-track');
    const cards = Array.from(section.querySelectorAll('.video-ad-card'));
    const prevBtn = section.querySelector('.video-ad-nav.prev');
    const nextBtn = section.querySelector('.video-ad-nav.next');
    const watchMoreBtn = section.querySelector('.video-ad-watchmore');
    if (!track || cards.length === 0) return;

    let activeIndex = Math.floor(cards.length / 2);
    let currentX = 0;

    function render() {
      cards.forEach((card, i) => {
        const diff = i - activeIndex;
        card.classList.remove('is-active', 'is-adjacent');
        if (diff === 0) card.classList.add('is-active');
        else if (Math.abs(diff) === 1) card.classList.add('is-adjacent');
      });
      centerActive();
    }

    function centerActive() {
      const containerRect = carousel.getBoundingClientRect();
      const cardRect = cards[activeIndex].getBoundingClientRect();
      const deltaToCenter = (containerRect.left + containerRect.width / 2) - (cardRect.left + cardRect.width / 2);
      currentX += deltaToCenter;
      track.style.transform = 'translateX(' + currentX + 'px)';
    }

    function goTo(i) {
      activeIndex = Math.max(0, Math.min(cards.length - 1, i));
      render();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(activeIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(activeIndex + 1));
    if (watchMoreBtn) watchMoreBtn.addEventListener('click', () => goTo((activeIndex + 1) % cards.length));

    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (i !== activeIndex) {
          goTo(i);
        } else {
          // Placeholder: no real ad video wired up yet.
          // Once you have a real video (YouTube/Vimeo embed or an MP4 file),
          // replace this click handler with opening that video (e.g. a modal
          // <iframe> or a direct link), the same way ad-slider.js's placeholder
          // slots are meant to be swapped for a real AdSense unit.
          console.log('Video ad slot clicked — plug in a real video embed here.');
        }
      });
    });

    window.addEventListener('resize', centerActive);
    // Render once layout has settled.
    requestAnimationFrame(render);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.video-ad-section').forEach(initCarousel);
  });
})();
