/* Exclusive Tools controller — checks unlock state on load, wires up
   locked tiles (and the unlock banner button) to the strict 5-ad
   unlock flow from ad-gate-exclusive.js, then reveals real links. */

(function () {
  const section = document.querySelector('.exclusive-section');
  if (!section) return;

  const banner = section.querySelector('.exclusive-unlock-banner');
  const unlockBtn = section.querySelector('.exclusive-unlock-btn');
  const bannerText = section.querySelector('.exclusive-unlock-text');
  const tiles = Array.from(section.querySelectorAll('.exclusive-tile'));

  function reveal() {
    tiles.forEach((tile) => {
      tile.classList.remove('is-locked');
      tile.classList.add('is-unlocked');
      const realHref = tile.getAttribute('data-href');
      if (realHref) tile.setAttribute('href', realHref);
    });
    if (banner) {
      banner.classList.add('is-unlocked');
      if (bannerText) {
        const remaining = window.adGateExclusive.getRemainingMs();
        const remainingText = window.adGateExclusive.formatRemaining(remaining);
        bannerText.innerHTML = '<b>Unlocked!</b> All exclusive tools are available on this device for the next ' + remainingText + '.';
      }
      if (unlockBtn) unlockBtn.style.display = 'none';
    }
  }

  function lockTileClick(e) {
    e.preventDefault();
    window.adGateExclusive.unlock(reveal);
  }

  if (window.adGateExclusive && window.adGateExclusive.isUnlocked()) {
    reveal();
  } else {
    tiles.forEach((tile) => tile.addEventListener('click', lockTileClick));
    if (unlockBtn) unlockBtn.addEventListener('click', () => window.adGateExclusive.unlock(reveal));
  }
})();
