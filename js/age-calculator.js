const birthDate = document.getElementById('birthDate');
const toDate = document.getElementById('toDate');
const calcBtn = document.getElementById('calcBtn');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');

const yearsEl = document.getElementById('years');
const monthsEl = document.getElementById('months');
const daysEl = document.getElementById('days');
const totalDaysEl = document.getElementById('totalDays');
const totalWeeksEl = document.getElementById('totalWeeks');
const nextBirthdayEl = document.getElementById('nextBirthday');

const today = new Date();
toDate.value = today.toISOString().split('T')[0];

calcBtn.addEventListener('click', () => {
  if (!birthDate.value) {
    statusMsg.textContent = 'Please enter a start date.';
    statusMsg.className = 'status error';
    resultBox.classList.remove('show');
    return;
  }
  const start = new Date(birthDate.value + 'T00:00:00');
  const end = new Date((toDate.value || today.toISOString().split('T')[0]) + 'T00:00:00');

  if (start > end) {
    statusMsg.textContent = 'Start date must be before the "as of" date.';
    statusMsg.className = 'status error';
    resultBox.classList.remove('show');
    return;
  }
  statusMsg.textContent = '';
  statusMsg.className = 'status';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.floor(totalDays / 7);

  let nextBday = new Date(end.getFullYear(), start.getMonth(), start.getDate());
  if (nextBday < end) nextBday.setFullYear(end.getFullYear() + 1);
  const daysToNext = Math.round((nextBday - end) / (1000 * 60 * 60 * 24));

  yearsEl.textContent = years;
  monthsEl.textContent = months;
  daysEl.textContent = days;
  totalDaysEl.textContent = totalDays.toLocaleString();
  totalWeeksEl.textContent = totalWeeks.toLocaleString();
  nextBirthdayEl.textContent = daysToNext === 0 ? 'Today!' : `${daysToNext} days`;

  resultBox.classList.add('show');
});
