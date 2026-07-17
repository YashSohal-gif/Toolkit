const textInput = document.getElementById('textInput');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const charNoSpaceCount = document.getElementById('charNoSpaceCount');
const sentenceCount = document.getElementById('sentenceCount');
const paragraphCount = document.getElementById('paragraphCount');
const readingTime = document.getElementById('readingTime');
const speakingTime = document.getElementById('speakingTime');
const avgWordLen = document.getElementById('avgWordLen');
const longestWordEl = document.getElementById('longestWord');
const keywordCard = document.getElementById('keywordCard');
const keywordChips = document.getElementById('keywordChips');

const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','was','with','that','this','have','from','they','she','him','her','his','has','had','were','been','their','said','each','which','will','would','there','what','when','your','how','out','its','our','who','get','into','than','them','then','also','just','about','more','some','very']);

function updateStats() {
  const text = textInput.value;

  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences = text.trim().length ? (text.match(/[.!?]+(?:\s|$)/g) || []).length : 0;
  const paragraphs = text.trim().length ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0;
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  const speakMinutes = Math.max(1, Math.ceil(words.length / 130)); // ~130 wpm speech

  wordCount.textContent = words.length;
  charCount.textContent = chars;
  charNoSpaceCount.textContent = charsNoSpace;
  sentenceCount.textContent = sentences;
  paragraphCount.textContent = paragraphs;
  readingTime.textContent = words.length ? `${minutes} min` : '0 min';
  if (speakingTime) speakingTime.textContent = words.length ? `${speakMinutes} min` : '0 min';

  if (avgWordLen) {
    avgWordLen.textContent = words.length ? (charsNoSpace / words.length).toFixed(1) : '0';
  }
  if (longestWordEl) {
    const cleaned = words.map(w => w.replace(/[^a-zA-Z0-9''-]/g, ''));
    const longest = cleaned.reduce((a, b) => (b.length > a.length ? b : a), '');
    longestWordEl.textContent = longest || '—';
  }

  if (keywordCard && keywordChips) {
    const freq = new Map();
    words.forEach(w => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length < 3 || STOP_WORDS.has(clean)) return;
      freq.set(clean, (freq.get(clean) || 0) + 1);
    });
    const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).filter(e => e[1] > 1);
    keywordChips.innerHTML = '';
    top.forEach(([word, count]) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.cursor = 'default';
      chip.textContent = `${word} × ${count}`; // textContent — input is user text
      keywordChips.appendChild(chip);
    });
    keywordCard.style.display = top.length ? 'block' : 'none';
  }
}

textInput.addEventListener('input', updateStats);
updateStats();
