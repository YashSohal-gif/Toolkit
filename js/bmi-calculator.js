const unitSystemGroup = document.getElementById('unitSystemGroup');
let unitSystemValue = 'metric';
const weight = document.getElementById('weight');
const height = document.getElementById('height');
const weightLabel = document.getElementById('weightLabel');
const heightLabel = document.getElementById('heightLabel');
const bmiValue = document.getElementById('bmiValue');
const bmiCategory = document.getElementById('bmiCategory');

function calculate() {
  const w = parseFloat(weight.value) || 0;
  const h = parseFloat(height.value) || 0;
  if (w <= 0 || h <= 0) {
    bmiValue.textContent = '-';
    bmiCategory.textContent = '-';
    return;
  }

  let bmi;
  if (unitSystemValue === 'metric') {
    const heightM = h / 100;
    bmi = w / (heightM * heightM);
  } else {
    bmi = (w / (h * h)) * 703;
  }

  let category;
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal weight';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';

  bmiValue.textContent = bmi.toFixed(1);
  bmiCategory.textContent = category;
}

if (unitSystemGroup) {
  unitSystemGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      unitSystemGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      unitSystemValue = btn.dataset.value;
      if (unitSystemValue === 'metric') {
        weightLabel.textContent = 'Weight (kg)';
        heightLabel.textContent = 'Height (cm)';
      } else {
        weightLabel.textContent = 'Weight (lb)';
        heightLabel.textContent = 'Height (in)';
      }
      calculate();
    });
  });
}

weight.addEventListener('input', calculate);
height.addEventListener('input', calculate);
calculate();
