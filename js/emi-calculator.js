const principal = document.getElementById('principal');
const rate = document.getElementById('rate');
const tenure = document.getElementById('tenure');
const tenureUnitGroup = document.getElementById('tenureUnitGroup');
let tenureUnitValue = 'years';
const emiResult = document.getElementById('emiResult');
const totalInterest = document.getElementById('totalInterest');
const totalPayment = document.getElementById('totalPayment');

function formatCurrency(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function calculate() {
  const P = parseFloat(principal.value) || 0;
  const annualRate = parseFloat(rate.value) || 0;
  let N = parseFloat(tenure.value) || 0;
  if (tenureUnitValue === 'years') N *= 12;

  if (P <= 0 || N <= 0) {
    emiResult.textContent = '-';
    totalInterest.textContent = '-';
    totalPayment.textContent = '-';
    return;
  }

  const R = annualRate / 12 / 100;
  let emi;
  if (R === 0) {
    emi = P / N;
  } else {
    emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
  }

  const total = emi * N;
  const interest = total - P;

  emiResult.textContent = formatCurrency(emi);
  totalInterest.textContent = formatCurrency(interest);
  totalPayment.textContent = formatCurrency(total);
}

if (tenureUnitGroup) {
  tenureUnitGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      tenureUnitGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tenureUnitValue = btn.dataset.value;
      calculate();
    });
  });
}

[principal, rate, tenure].forEach(el => el.addEventListener('input', calculate));
calculate();
