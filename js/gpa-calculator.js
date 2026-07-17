/* GPA Calculator — add/remove course rows (name, credit hours, grade) and
   compute a weighted GPA on a 4.0 or 10-point scale. Pure client-side math. */
(function () {
  const scaleGroup = document.getElementById('gpaScale');
  const courseRows = document.getElementById('courseRows');
  const addRowBtn = document.getElementById('addRowBtn');
  const gpaResult = document.getElementById('gpaResult');
  const totalCreditsResult = document.getElementById('totalCreditsResult');

  if (!scaleGroup) return;

  const GRADE_POINTS = {
    4: { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'F': 0.0 },
    10: { 'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0 }
  };

  let scale = 4;
  let rowCount = 0;

  function gradeOptionsHtml() {
    return Object.keys(GRADE_POINTS[scale]).map(g => `<option value="${g}">${g}</option>`).join('');
  }

  function addRow() {
    rowCount++;
    const row = document.createElement('div');
    row.className = 'controls course-row';
    row.style.cssText = 'margin-top:0;align-items:center;';
    row.innerHTML = `
      <div class="field" style="flex:2;">
        <label>Course name</label>
        <input type="text" class="course-name" placeholder="e.g. Calculus I">
      </div>
      <div class="field">
        <label>Credit hours</label>
        <input type="number" class="course-credits" value="3" min="0" step="0.5">
      </div>
      <div class="field">
        <label>Grade</label>
        <select class="course-grade">${gradeOptionsHtml()}</select>
      </div>
      <button class="btn secondary remove-row-btn" type="button" title="Remove course">✕</button>
    `;
    courseRows.appendChild(row);

    row.querySelector('.remove-row-btn').addEventListener('click', () => {
      row.remove();
      calculate();
    });
    row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', calculate));
    calculate();
  }

  scaleGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      scaleGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scale = parseInt(btn.dataset.value, 10);
      courseRows.querySelectorAll('.course-grade').forEach(sel => {
        sel.innerHTML = gradeOptionsHtml();
      });
      calculate();
    });
  });

  addRowBtn.addEventListener('click', addRow);

  function calculate() {
    const rows = courseRows.querySelectorAll('.course-row');
    let totalPoints = 0;
    let totalCredits = 0;

    rows.forEach(row => {
      const credits = parseFloat(row.querySelector('.course-credits').value) || 0;
      const grade = row.querySelector('.course-grade').value;
      const points = GRADE_POINTS[scale][grade] || 0;
      totalPoints += credits * points;
      totalCredits += credits;
    });

    if (totalCredits === 0) {
      gpaResult.textContent = '-';
      totalCreditsResult.textContent = '-';
      return;
    }

    gpaResult.textContent = (totalPoints / totalCredits).toFixed(2);
    totalCreditsResult.textContent = totalCredits;
  }

  // Start with 3 rows
  addRow();
  addRow();
  addRow();
})();
