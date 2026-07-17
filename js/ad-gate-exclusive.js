/* Exclusive Tools ad-gate — stricter than the regular ad-gate. Clicking a
   locked tile first shows an intro popup explaining the deal with a
   "Start" button; only after Start does it play exactly 5 ads back-to-back
   with NO skip and NO close button (the "Continue" action only appears
   after each ad's timer fully finishes). Once all 5 are watched, unlock
   state is written to localStorage with a 3-day expiry, so tools stay
   unlocked for 3 days before the person needs to watch again. */

window.adGateExclusive = (function () {
  const REQUIRED_ADS = 5;
  const AD_WATCH_SECONDS = 15;
  const STORAGE_KEY = 'kbresize_exclusive_unlock_expires';
  const UNLOCK_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  function isUnlocked() {
    try {
      const expires = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return !!expires && Date.now() < expires;
    } catch (e) {
      return false;
    }
  }

  function getRemainingMs() {
    try {
      const expires = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      if (!expires) return 0;
      return Math.max(0, expires - Date.now());
    } catch (e) {
      return 0;
    }
  }

  function formatRemaining(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    if (days > 0) return days + (days === 1 ? ' day' : ' days') + (hours > 0 ? ' ' + hours + 'h' : '');
    const minutes = totalMinutes % 60;
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + (minutes === 1 ? ' minute' : ' minutes');
  }

  function markUnlocked() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + UNLOCK_DURATION_MS));
    } catch (e) { /* ignore storage errors (private mode etc.) */ }
  }

  function buildIntroModal() {
    const overlay = document.createElement('div');
    overlay.className = 'adgate-overlay';
    overlay.innerHTML = `
      <div class="adgate-modal">
        <h3 class="adgate-title">Unlock Exclusive Tools</h3>
        <p class="adgate-sub">These tools are free — you just need to watch ${REQUIRED_ADS} short ads back-to-back, without skipping. Once done, every exclusive tool unlocks for 3 days on this device.</p>
        <button type="button" class="btn adgate-btn adgate-start-btn">Start</button>
        <button type="button" class="adgate-cancel-btn" style="display:block;margin:10px auto 0;background:none;border:none;color:var(--muted,#888);text-decoration:underline;cursor:pointer;">Not now</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('adgate-open');
    return overlay;
  }

  function closeOverlay(overlay) {
    overlay.remove();
    if (!document.querySelector('.adgate-overlay')) document.body.classList.remove('adgate-open');
  }

  function showIntro() {
    return new Promise((resolve) => {
      const overlay = buildIntroModal();
      const startBtn = overlay.querySelector('.adgate-start-btn');
      const cancelBtn = overlay.querySelector('.adgate-cancel-btn');
      startBtn.addEventListener('click', () => {
        closeOverlay(overlay);
        resolve(true);
      });
      cancelBtn.addEventListener('click', () => {
        closeOverlay(overlay);
        resolve(false);
      });
    });
  }

  function buildModal(index, total) {
    const overlay = document.createElement('div');
    overlay.className = 'adgate-overlay';
    overlay.innerHTML = `
      <div class="adgate-modal">
        <h3 class="adgate-title">Unlocking Exclusive Tools — Ad ${index} of ${total}</h3>
        <p class="adgate-sub">Watch all ${total} ads without skipping to unlock every exclusive tool for 3 days on this device.</p>
        <div class="adgate-adslot">
          <div class="adgate-adslot-placeholder">Ad space<br><small>(swap in your AdSense / rewarded ad unit here — no skip button by design)</small></div>
        </div>
        <p class="adgate-progress">Playing ad ${index} of ${total}... ${AD_WATCH_SECONDS}s</p>
        <button type="button" class="btn adgate-btn" disabled>Please watch...</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('adgate-open');
    return overlay;
  }

  function watchOneAd(index, total) {
    return new Promise((resolve) => {
      const overlay = buildModal(index, total);
      const progress = overlay.querySelector('.adgate-progress');
      const btn = overlay.querySelector('.adgate-btn');

      let remaining = AD_WATCH_SECONDS;
      const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(timer);
          progress.textContent = 'Ad ' + index + ' of ' + total + ' complete.';
          btn.disabled = false;
          btn.textContent = index < total ? 'Continue to next ad' : 'Unlock Exclusive Tools';
        } else {
          progress.textContent = 'Playing ad ' + index + ' of ' + total + '... ' + remaining + 's';
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
   * Show the intro popup, then (if the person presses Start) run the
   * strict 5-ad unlock flow, then call onUnlocked(). If already unlocked
   * (from a previous visit, within the 3-day window), calls onUnlocked()
   * immediately without showing anything.
   */
  async function unlock(onUnlocked) {
    if (isUnlocked()) {
      onUnlocked();
      return;
    }
    const started = await showIntro();
    if (!started) return;
    for (let i = 1; i <= REQUIRED_ADS; i++) {
      await watchOneAd(i, REQUIRED_ADS);
    }
    markUnlocked();
    onUnlocked();
  }

  return { unlock, isUnlocked, getRemainingMs, formatRemaining };
})();
