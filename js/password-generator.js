const passwordOutput = document.getElementById('passwordOutput');
const copyBtn = document.getElementById('copyBtn');
const regenBtn = document.getElementById('regenBtn');
const lengthSlider = document.getElementById('lengthSlider');
const lengthValue = document.getElementById('lengthValue');
const optUpper = document.getElementById('optUpper');
const optLower = document.getElementById('optLower');
const optNumbers = document.getElementById('optNumbers');
const optSymbols = document.getElementById('optSymbols');
const optNoAmbiguous = document.getElementById('optNoAmbiguous');
const optRequireAll = document.getElementById('optRequireAll');
const optNoRepeat = document.getElementById('optNoRepeat');
const strengthFill = document.getElementById('strengthFill');
const strengthLabel = document.getElementById('strengthLabel');

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};
const AMBIGUOUS = /[Il1O0o]/g;

/* Unbiased secure random integer in [0, max) — plain modulo skews the
   distribution toward the start of the character set. */
function randomInt(max) {
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  const buf = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

function activeSets() {
  const sets = [];
  if (optUpper.checked) sets.push(SETS.upper);
  if (optLower.checked) sets.push(SETS.lower);
  if (optNumbers.checked) sets.push(SETS.numbers);
  if (optSymbols.checked) sets.push(SETS.symbols);
  if (!sets.length) {
    optLower.checked = true;
    sets.push(SETS.lower);
  }
  if (optNoAmbiguous && optNoAmbiguous.checked) {
    return sets.map(s => s.replace(AMBIGUOUS, '')).filter(s => s.length);
  }
  return sets;
}

function generatePassword() {
  const sets = activeSets();
  const charset = sets.join('');
  const noRepeat = optNoRepeat && optNoRepeat.checked;
  let length = parseInt(lengthSlider.value, 10);
  if (noRepeat && length > charset.length) length = charset.length;

  const chars = [];
  const used = new Set();

  /* Guarantee one char from each enabled set first */
  if (optRequireAll && optRequireAll.checked && length >= sets.length) {
    sets.forEach(set => {
      let c;
      let guard = 0;
      do { c = set[randomInt(set.length)]; } while (noRepeat && used.has(c) && ++guard < 100);
      chars.push(c);
      used.add(c);
    });
  }

  while (chars.length < length) {
    const c = charset[randomInt(charset.length)];
    if (noRepeat && used.has(c)) continue;
    chars.push(c);
    used.add(c);
  }

  /* Fisher–Yates shuffle so the guaranteed characters aren't always first */
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const password = chars.join('');
  passwordOutput.value = password;
  updateStrength(password, charset.length);
}

function updateStrength(password, poolSize) {
  const entropy = password.length * Math.log2(poolSize);
  let pct, color, label;
  if (entropy < 40) { pct = 25; color = '#dc2626'; label = 'Weak'; }
  else if (entropy < 60) { pct = 50; color = '#ea580c'; label = 'Fair'; }
  else if (entropy < 90) { pct = 75; color = '#16a34a'; label = 'Strong'; }
  else { pct = 100; color = '#0d9488'; label = 'Very strong'; }

  strengthFill.style.width = pct + '%';
  strengthFill.style.background = color;
  strengthLabel.textContent = `${label} (~${Math.round(entropy)} bits of entropy)`;
}

lengthSlider.addEventListener('input', () => {
  lengthValue.textContent = lengthSlider.value;
  generatePassword();
});
[optUpper, optLower, optNumbers, optSymbols, optNoAmbiguous, optRequireAll, optNoRepeat]
  .filter(Boolean)
  .forEach(el => el.addEventListener('change', generatePassword));
regenBtn.addEventListener('click', generatePassword);

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(passwordOutput.value).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
  });
});

generatePassword();
