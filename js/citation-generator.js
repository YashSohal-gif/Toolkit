/* Citation Generator — builds a formatted citation string in APA, MLA, or
   Chicago style from form fields, for websites, books, and journal articles.
   Pure client-side string formatting, no external lookups. */
(function () {
  const citeStyleGroup = document.getElementById('citeStyle');
  const sourceTypeGroup = document.getElementById('sourceType');
  const websiteFields = document.getElementById('websiteFields');
  const bookFields = document.getElementById('bookFields');
  const journalFields = document.getElementById('journalFields');
  const generateBtn = document.getElementById('generateCiteBtn');
  const resultBox = document.getElementById('resultBoxCite');
  const citeOutput = document.getElementById('citeOutput');
  const copyBtn = document.getElementById('copyCiteBtn');

  if (!citeStyleGroup) return;

  let style = 'apa';
  let sourceType = 'website';

  citeStyleGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      citeStyleGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      style = btn.dataset.value;
    });
  });

  sourceTypeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      sourceTypeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sourceType = btn.dataset.value;
      websiteFields.style.display = sourceType === 'website' ? '' : 'none';
      bookFields.style.display = sourceType === 'book' ? '' : 'none';
      journalFields.style.display = sourceType === 'journal' ? '' : 'none';
    });
  });

  function parseAuthors() {
    const raw = document.getElementById('citeAuthor').value.trim();
    if (!raw) return [];
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
  }

  function formatAuthorsApa(authors) {
    if (!authors.length) return '';
    const formatted = authors.map(a => {
      const parts = a.split(',').map(p => p.trim());
      if (parts.length < 2) return a;
      const initials = parts[1].split(/\s+/).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
      return `${parts[0]}, ${initials}`;
    });
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return formatted[0] + ', & ' + formatted[1];
    return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
  }

  function formatAuthorsMla(authors) {
    if (!authors.length) return '';
    if (authors.length === 1) return authors[0] + '.';
    const first = authors[0];
    if (authors.length === 2) {
      const parts = authors[1].split(',').map(p => p.trim());
      const reversed = parts.length === 2 ? `${parts[1]} ${parts[0]}` : authors[1];
      return `${first}, and ${reversed}.`;
    }
    return first + ', et al.';
  }

  function formatAuthorsChicago(authors) {
    if (!authors.length) return '';
    if (authors.length === 1) return authors[0] + '.';
    const first = authors[0];
    const rest = authors.slice(1).map(a => {
      const parts = a.split(',').map(p => p.trim());
      return parts.length === 2 ? `${parts[1]} ${parts[0]}` : a;
    });
    return [first, ...rest].join(', ') + '.';
  }

  generateBtn.addEventListener('click', () => {
    const authors = parseAuthors();
    const title = document.getElementById('citeTitle').value.trim() || 'Untitled';
    const year = document.getElementById('citeYear').value.trim() || 'n.d.';

    let citation = '';

    if (sourceType === 'website') {
      const siteName = document.getElementById('citeSiteName').value.trim();
      const url = document.getElementById('citeUrl').value.trim();

      if (style === 'apa') {
        citation = `${formatAuthorsApa(authors)}${authors.length ? ' ' : ''}(${year}). ${title}. ${siteName ? siteName + '. ' : ''}${url}`;
      } else if (style === 'mla') {
        citation = `${formatAuthorsMla(authors)} "${title}." ${siteName ? siteName + ', ' : ''}${year}, ${url}.`;
      } else {
        citation = `${formatAuthorsChicago(authors)} "${title}." ${siteName ? siteName + '. ' : ''}Accessed ${new Date().toLocaleDateString()}. ${url}.`;
      }
    } else if (sourceType === 'book') {
      const publisher = document.getElementById('citePublisher').value.trim();
      const edition = document.getElementById('citeEdition').value.trim();

      if (style === 'apa') {
        citation = `${formatAuthorsApa(authors)}${authors.length ? ' ' : ''}(${year}). ${title}${edition ? ' (' + edition + ' ed.)' : ''}. ${publisher}.`;
      } else if (style === 'mla') {
        citation = `${formatAuthorsMla(authors)} ${title}${edition ? ', ' + edition + ' ed.' : ''}. ${publisher}, ${year}.`;
      } else {
        citation = `${formatAuthorsChicago(authors)} ${title}${edition ? ', ' + edition + ' ed.' : ''}. ${publisher}, ${year}.`;
      }
    } else {
      const journal = document.getElementById('citeJournal').value.trim();
      const volume = document.getElementById('citeVolume').value.trim();
      const pages = document.getElementById('citePages').value.trim();

      if (style === 'apa') {
        citation = `${formatAuthorsApa(authors)}${authors.length ? ' ' : ''}(${year}). ${title}. ${journal}${volume ? ', ' + volume : ''}${pages ? ', ' + pages : ''}.`;
      } else if (style === 'mla') {
        citation = `${formatAuthorsMla(authors)} "${title}." ${journal}${volume ? ', vol. ' + volume : ''}, ${year}${pages ? ', pp. ' + pages : ''}.`;
      } else {
        citation = `${formatAuthorsChicago(authors)} "${title}." ${journal}${volume ? ' ' + volume : ''} (${year})${pages ? ': ' + pages : ''}.`;
      }
    }

    citeOutput.value = citation.replace(/\s+/g, ' ').trim();
    resultBox.classList.add('show');
  });

  copyBtn.addEventListener('click', () => {
    citeOutput.select();
    navigator.clipboard.writeText(citeOutput.value).then(() => {
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy Citation'; }, 1500);
    });
  });
})();
