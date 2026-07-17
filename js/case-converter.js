const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const copyBtn = document.getElementById('copyBtn');
const buttons = document.querySelectorAll('[data-case]');

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
}
function toSentenceCase(str) {
  return str.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
}
function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}
function toSnakeCase(str) {
  return str
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}
function toKebabCase(str) {
  return str
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const text = inputText.value;
    let result = text;
    switch (btn.dataset.case) {
      case 'upper': result = text.toUpperCase(); break;
      case 'lower': result = text.toLowerCase(); break;
      case 'title': result = toTitleCase(text); break;
      case 'sentence': result = toSentenceCase(text); break;
      case 'camel': result = toCamelCase(text); break;
      case 'snake': result = toSnakeCase(text); break;
      case 'kebab': result = toKebabCase(text); break;
      case 'pascal': {
        const camel = toCamelCase(text);
        result = camel.charAt(0).toUpperCase() + camel.slice(1);
        break;
      }
      case 'constant': result = toSnakeCase(text).toUpperCase(); break;
      case 'alternating': {
        let upper = false;
        result = text.split('').map(c => {
          if (!/[a-zA-Z]/.test(c)) return c;
          upper = !upper;
          return upper ? c.toUpperCase() : c.toLowerCase();
        }).join('');
        break;
      }
      case 'inverse':
        result = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
        break;
      case 'capitalize-words': result = text.replace(/\b\w/g, c => c.toUpperCase()); break;
    }
    outputText.value = result;
  });
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputText.value).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Result'; }, 1500);
  });
});
