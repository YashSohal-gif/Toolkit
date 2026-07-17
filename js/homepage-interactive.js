(function () {
  const searchInput = document.getElementById('toolSearch');
  const clearBtn = document.getElementById('clearSearch');
  const chips = document.querySelectorAll('.chip');
  const appScreens = document.querySelectorAll('.app-screen[data-category]');
  const noResultsMsg = document.getElementById('noResultsMsg');
  const recentlyUsedSection = document.getElementById('recentlyUsedSection');
  const recentlyUsedGrid = document.getElementById('recentlyUsedGrid');

  let activeCategory = 'all';

  function applyFilters() {
    const query = (searchInput.value || '').trim().toLowerCase();
    clearBtn.style.display = query ? 'block' : 'none';

    let anyVisible = false;

    appScreens.forEach(screen => {
      const category = screen.dataset.category;
      const categoryMatches = activeCategory === 'all' || activeCategory === category;
      const tiles = screen.querySelectorAll('.app-tile');
      let screenHasVisible = false;

      tiles.forEach(tile => {
        const label = tile.querySelector('.app-label').textContent.toLowerCase();
        const desc = (tile.dataset.desc || '').toLowerCase();
        const textMatches = !query || label.includes(query) || desc.includes(query);
        const visible = categoryMatches && textMatches;
        tile.classList.toggle('hidden-search', !visible);
        if (visible) screenHasVisible = true;
      });

      screen.classList.toggle('hidden-category', !screenHasVisible);
      if (screenHasVisible) anyVisible = true;
    });

    noResultsMsg.style.display = anyVisible ? 'none' : 'block';
  }

  searchInput.addEventListener('input', applyFilters);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.filter;
      applyFilters();
    });
  });

  // Recently used tracking
  const STORAGE_KEY = 'kbresize_recently_used';
  const MAX_RECENT = 6;

  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveRecent(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function trackClick(tile) {
    const href = tile.getAttribute('href');
    const label = tile.querySelector('.app-label').textContent;
    const iconHtml = tile.querySelector('.app-icon').outerHTML;
    const desc = tile.dataset.desc || '';

    let recent = getRecent().filter(item => item.href !== href);
    recent.unshift({ href, label, iconHtml, desc });
    recent = recent.slice(0, MAX_RECENT);
    saveRecent(recent);
  }

  document.querySelectorAll('.app-tile[href]').forEach(tile => {
    tile.addEventListener('click', () => trackClick(tile));
  });

  function renderRecent() {
    const recent = getRecent();
    if (!recent.length) {
      recentlyUsedSection.style.display = 'none';
      return;
    }
    recentlyUsedGrid.innerHTML = recent.map(item => `
      <a class="app-tile" href="${item.href}" data-desc="${item.desc}">
        ${item.iconHtml}
        <div class="app-label">${item.label}</div>
      </a>
    `).join('');
    recentlyUsedSection.style.display = '';
    recentlyUsedGrid.querySelectorAll('.app-tile').forEach(tile => {
      tile.addEventListener('click', () => trackClick(tile));
    });
  }

  renderRecent();

  // Staggered fade-in delay for tiles on initial load
  document.querySelectorAll('.app-tile').forEach((tile, i) => {
    tile.style.animationDelay = Math.min(i * 0.02, 0.4) + 's';
  });
})();
