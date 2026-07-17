/* Theme controller — day/night mode + accent color picker.
   Applies saved preferences immediately (before paint) to avoid a flash,
   and wires up the toggle buttons once the DOM is ready. */
(function () {
  var ACCENTS = {
    blue: ['#2563eb', '#1d4ed8'],
    purple: ['#7c3aed', '#6d28d9'],
    green: ['#16a34a', '#15803d'],
    red: ['#dc2626', '#b91c1c'],
    orange: ['#ea580c', '#c2410c'],
    teal: ['#0d9488', '#0f766e'],
    pink: ['#db2777', '#be185d']
  };

  /* Inline SVGs (stroke="currentColor") instead of the ☀/🌙 Unicode glyphs
     that used to sit here — U+2600 "BLACK SUN WITH RAYS" defaults to
     text/monochrome presentation in most fonts and does not reliably
     inherit CSS color, so it rendered as a flat black disc on dark theme
     instead of the light icon color the rest of the site's icons use. */
  var SUN_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function themeToggleIcon(theme) {
    return theme === 'dark' ? SUN_SVG : MOON_SVG;
  }

  /* Resolve the site root from this very script's own <script src> tag,
     e.g. ".../image-tools/../js/theme.js" -> ".../". This lets one script
     add PWA manifest/SW/icon links and the Blog nav link to every page,
     regardless of how many folders deep that page lives, without having
     to hand-edit all ~75 HTML files. */
  var scriptEl = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/\/js\/theme\.js(\?.*)?$/.test(scripts[i].src)) return scripts[i];
    }
    return null;
  })();
  var siteRoot = scriptEl ? scriptEl.src.replace(/js\/theme\.js(\?.*)?$/, '') : './';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('kbresize-theme', theme); } catch (e) {}
    var btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = themeToggleIcon(theme);
  }

  function applyAccent(name) {
    var colors = ACCENTS[name] || ACCENTS.blue;
    document.documentElement.style.setProperty('--primary', colors[0]);
    document.documentElement.style.setProperty('--primary-dark', colors[1]);
    try { localStorage.setItem('kbresize-accent', name); } catch (e) {}
    var swatches = document.querySelectorAll('.accent-swatch');
    for (var i = 0; i < swatches.length; i++) {
      var el = swatches[i];
      if (el.getAttribute('data-accent') === name) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }

  var savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('kbresize-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (e) {}
  applyTheme(savedTheme);

  var savedAccent = 'blue';
  try { savedAccent = localStorage.getItem('kbresize-accent') || 'blue'; } catch (e) {}
  applyAccent(savedAccent);

  // ===========================================================================
  // PWA: manifest + icons + service worker, injected site-wide from this one
  // script rather than edited into every page's <head>.
  // ===========================================================================
  (function setupPwa() {
    var manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = siteRoot + 'manifest.json';
    document.head.appendChild(manifestLink);

    var appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = siteRoot + 'logo/apple-touch-icon.png';
    document.head.appendChild(appleIcon);

    var themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    themeColorMeta.content = '#2563eb';
    document.head.appendChild(themeColorMeta);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(siteRoot + 'service-worker.js', { scope: siteRoot }).catch(function (e) {
          console.warn('Service worker registration failed', e);
        });
      });
    }
  })();

  document.addEventListener('DOMContentLoaded', function () {
    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = themeToggleIcon(document.documentElement.getAttribute('data-theme'));
      themeToggle.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }

    var accentToggle = document.getElementById('accentToggle');
    var accentMenu = document.getElementById('accentMenu');
    if (accentToggle && accentMenu) {
      accentToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        accentMenu.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        accentMenu.classList.remove('open');
      });
      accentMenu.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      var swatches = accentMenu.querySelectorAll('.accent-swatch');
      for (var i = 0; i < swatches.length; i++) {
        (function (el) {
          if (el.getAttribute('data-accent') === savedAccent) el.classList.add('active');
          el.addEventListener('click', function () {
            applyAccent(el.getAttribute('data-accent'));
          });
        })(swatches[i]);
      }
    }

    /* Blog nav link — injected here instead of hand-edited into every page
       so adding the blog section didn't require touching ~75 HTML files. */
    var nav = document.querySelector('header.site-header nav');
    if (nav && !nav.querySelector('a[data-nav="blog"]')) {
      var blogLink = document.createElement('a');
      blogLink.href = siteRoot + 'blog/index.html';
      blogLink.setAttribute('data-nav', 'blog');
      blogLink.textContent = 'Blog';
      nav.appendChild(blogLink);
    }

    /* FAQ schema (JSON-LD) — every tool page already has a hand-written
       "How it works" card of h3/p question-answer pairs (class="faq"); this
       reads that existing content and emits the matching FAQPage structured
       data automatically, instead of hand-adding a <script type="ld+json">
       block to every page. Lets tool pages show FAQ rich results in Google. */
    (function injectFaqSchema() {
      var faqCard = document.querySelector('.card.faq, .faq');
      if (!faqCard) return;
      var questions = faqCard.querySelectorAll('h3');
      if (!questions.length) return;
      var mainEntity = [];
      questions.forEach(function (h3) {
        var answerParts = [];
        var node = h3.nextElementSibling;
        while (node && node.tagName === 'P') {
          answerParts.push(node.textContent.trim());
          node = node.nextElementSibling;
        }
        if (!answerParts.length) return;
        mainEntity.push({
          '@type': 'Question',
          name: h3.textContent.trim(),
          acceptedAnswer: { '@type': 'Answer', text: answerParts.join(' ') }
        });
      });
      if (!mainEntity.length) return;
      var schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: mainEntity };
      var scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.textContent = JSON.stringify(schema);
      document.head.appendChild(scriptTag);
    })();

    /* Locked navbar: header stays fixed and fully visible at all times.
       We still measure its real height so page content never overlaps it,
       no matter how the nav wraps at different screen widths. */
    var header = document.querySelector('header.site-header');
    function updateHeaderOffset() {
      if (!header) return;
      var height = header.offsetHeight;
      var topGap = 16;
      var extra = window.innerWidth <= 640 ? 24 : 20;
      document.documentElement.style.setProperty('--header-offset', (height + topGap + extra) + 'px');
    }
    if (header) {
      updateHeaderOffset();
      window.addEventListener('resize', updateHeaderOffset);
      window.addEventListener('load', updateHeaderOffset);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updateHeaderOffset);
      }
    }

    /* Back-to-top floating button, injected site-wide */
    var backToTop = document.createElement('button');
    backToTop.id = 'backToTopBtn';
    backToTop.className = 'back-to-top';
    backToTop.title = 'Back to top';
    backToTop.setAttribute('aria-label', 'Back to top');
    backToTop.textContent = String.fromCodePoint(8593);
    document.body.appendChild(backToTop);
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    /* Subtle ambient 3D-depth background: layered floating gradient orbs.
       Farther orbs (orb1/orb2) barely move on parallax; the nearest orb (orb4)
       moves the most, which is what sells the illusion of depth. */
    var scene = document.createElement('div');
    scene.className = 'bg-3d-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML =
      '<div class="bg-orb orb1"></div>' +
      '<div class="bg-orb orb2"></div>' +
      '<div class="bg-orb orb3"></div>' +
      '<div class="bg-orb orb4"></div>';
    document.body.insertBefore(scene, document.body.firstChild);

    var orbs = scene.querySelectorAll('.bg-orb');
    var depths = [4, 7, 12, 22];
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      document.addEventListener('mousemove', function (e) {
        var xPct = (e.clientX / window.innerWidth) - 0.5;
        var yPct = (e.clientY / window.innerHeight) - 0.5;
        for (var j = 0; j < orbs.length; j++) {
          var depth = depths[j] || (j + 1) * 6;
          orbs[j].style.transform = 'translate(' + (xPct * depth) + 'px, ' + (yPct * depth) + 'px)';
        }
      }, { passive: true });
    }
  });
})();
