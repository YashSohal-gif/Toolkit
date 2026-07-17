/* Ad Gate Module — reusable "watch N ads to unlock" flow.

   Rule: more pages = more ads before the result unlocks.
     <= 20 pages   -> free, no ad
     21-50 pages   -> 1 ad
     51-100 pages  -> 2 ads
     100+ pages    -> 3 ads

   IMPORTANT: This ships with placeholder ad slots (plain divs) and a timed
   "watch" step to simulate a rewarded ad. Once your AdSense/ad-network account
   is approved, swap the contents of .adgate-adslot-placeholder for a real
   <ins class="adsbygoogle">...</ins> unit or a rewarded-ad SDK call — the
   unlock timer can then be tied to the ad network's own "ad completed" event
   instead of a plain countdown.
*/

window.adGate = (function () {
  const AD_WATCH_SECONDS = 15;

  function countForQuantity(n) {
    if (n <= 20) return 0;
    if (n <= 50) return 1;
    if (n <= 100) return 2;
    return 3;
  }

  function buildModal(index, total, label) {
    const overlay = document.createElement('div');
    overlay.className = 'adgate-overlay';
    overlay.innerHTML = `
      <div class="adgate-modal">
        <h3 class="adgate-title">Ad ${index} of ${total}</h3>
        <p class="adgate-sub">${label} needs ${total} ad view${total > 1 ? 's' : ''} to unlock — this keeps the tool free for everyone.</p>
        <div class="adgate-adslot">
          <div class="adgate-adslot-placeholder">Ad space<br><small>(swap in your AdSense / rewarded ad unit here)</small></div>
        </div>
        <p class="adgate-progress">Unlocking in ${AD_WATCH_SECONDS}s...</p>
        <button type="button" class="btn adgate-btn" disabled>Please wait...</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('adgate-open');
    return overlay;
  }

  function closeOverlay(overlay) {
    overlay.remove();
    if (!document.querySelector('.adgate-overlay')) document.body.classList.remove('adgate-open');
  }

  function watchOneAd(index, total, label) {
    return new Promise((resolve) => {
      const overlay = buildModal(index, total, label);
      const progress = overlay.querySelector('.adgate-progress');
      const btn = overlay.querySelector('.adgate-btn');

      let remaining = AD_WATCH_SECONDS;
      const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(timer);
          progress.textContent = 'Ready!';
          btn.disabled = false;
          btn.textContent = index < total ? 'Continue to next ad' : 'Continue';
        } else {
          progress.textContent = `Unlocking in ${remaining}s...`;
        }
      }, 1000);

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        clearInterval(timer);
        closeOverlay(overlay);
        resolve();
      });
    });
  }

  /**
   * Run the ad gate, then call onUnlocked().
   * @param {number} quantity - page count (or item count) driving the tier.
   * @param {function} onUnlocked - called once all required ads are "watched".
   * @param {HTMLElement} [statusEl] - optional element to show a status message in.
   * @param {string} [label] - what to call the quantity in the modal, e.g. "This 62-page PDF".
   */
  async function run(quantity, onUnlocked, statusEl, label) {
    const adCount = countForQuantity(quantity);
    const niceLabel = label || `This file (${quantity} page${quantity === 1 ? '' : 's'})`;

    if (adCount === 0) {
      if (statusEl) statusEl.textContent = '';
      onUnlocked();
      return;
    }

    if (statusEl) {
      statusEl.textContent = `${niceLabel} requires ${adCount} ad view${adCount > 1 ? 's' : ''} to unlock. Please watch below.`;
    }

    for (let i = 1; i <= adCount; i++) {
      await watchOneAd(i, adCount, niceLabel);
    }
    onUnlocked();
  }

  return { run, countForQuantity };
})();
