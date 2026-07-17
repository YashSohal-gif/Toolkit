const UNITS = {
  length: {
    label: 'Length',
    base: 'm',
    units: {
      mm: { label: 'Millimeters', toBase: 0.001 },
      cm: { label: 'Centimeters', toBase: 0.01 },
      m: { label: 'Meters', toBase: 1 },
      km: { label: 'Kilometers', toBase: 1000 },
      in: { label: 'Inches', toBase: 0.0254 },
      ft: { label: 'Feet', toBase: 0.3048 },
      yd: { label: 'Yards', toBase: 0.9144 },
      mi: { label: 'Miles', toBase: 1609.344 }
    }
  },
  weight: {
    label: 'Weight',
    base: 'g',
    units: {
      mg: { label: 'Milligrams', toBase: 0.001 },
      g: { label: 'Grams', toBase: 1 },
      kg: { label: 'Kilograms', toBase: 1000 },
      t: { label: 'Tonnes', toBase: 1000000 },
      oz: { label: 'Ounces', toBase: 28.3495 },
      lb: { label: 'Pounds', toBase: 453.592 }
    }
  },
  temperature: {
    label: 'Temperature',
    units: {
      c: { label: 'Celsius' },
      f: { label: 'Fahrenheit' },
      k: { label: 'Kelvin' }
    }
  },
  area: {
    label: 'Area',
    base: 'm2',
    units: {
      mm2: { label: 'Square millimeters', toBase: 0.000001 },
      cm2: { label: 'Square centimeters', toBase: 0.0001 },
      m2: { label: 'Square meters', toBase: 1 },
      km2: { label: 'Square kilometers', toBase: 1000000 },
      ha: { label: 'Hectares', toBase: 10000 },
      acre: { label: 'Acres', toBase: 4046.86 },
      sqft: { label: 'Square feet', toBase: 0.092903 }
    }
  },
  speed: {
    label: 'Speed',
    base: 'mps',
    units: {
      mps: { label: 'Meters/second', toBase: 1 },
      kmh: { label: 'Kilometers/hour', toBase: 0.277778 },
      mph: { label: 'Miles/hour', toBase: 0.44704 },
      knot: { label: 'Knots', toBase: 0.514444 }
    }
  }
};

const category = document.getElementById('category');
const fromUnit = document.getElementById('fromUnit');
const toUnit = document.getElementById('toUnit');
const fromValue = document.getElementById('fromValue');
const toValue = document.getElementById('toValue');
const swapBtn = document.getElementById('swapBtn');

function populateUnits() {
  const cat = UNITS[category.value];
  const keys = Object.keys(cat.units);
  fromUnit.innerHTML = keys.map(k => `<option value="${k}">${cat.units[k].label}</option>`).join('');
  toUnit.innerHTML = keys.map(k => `<option value="${k}">${cat.units[k].label}</option>`).join('');
  fromUnit.value = keys[0];
  toUnit.value = keys[1] || keys[0];
  convert();
}

function convertTemperature(value, from, to) {
  let celsius;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else celsius = value - 273.15;

  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

function convert() {
  const cat = UNITS[category.value];
  const val = parseFloat(fromValue.value);
  if (isNaN(val)) { toValue.value = ''; return; }

  if (category.value === 'temperature') {
    toValue.value = round(convertTemperature(val, fromUnit.value, toUnit.value));
    return;
  }

  const fromDef = cat.units[fromUnit.value];
  const toDef = cat.units[toUnit.value];
  const baseVal = val * fromDef.toBase;
  const result = baseVal / toDef.toBase;
  toValue.value = round(result);
}

function round(n) {
  if (Math.abs(n) >= 1000) return Math.round(n * 100) / 100;
  return Math.round(n * 1e6) / 1e6;
}

category.addEventListener('change', populateUnits);
fromUnit.addEventListener('change', convert);
toUnit.addEventListener('change', convert);
fromValue.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const tmp = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = tmp;
  convert();
});

populateUnits();
