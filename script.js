const API = 'http://localhost:5500';

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(div => div.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    document.querySelectorAll('.tab-btn')[['add','search','all','average'].indexOf(tab)].classList.add('active');
}

// Add Student
document.getElementById('addForm').onsubmit = async function(e) {
    e.preventDefault();
    const student = {
        student_name: document.getElementById('student_name').value,
        roll_number: parseInt(document.getElementById('roll_number').value, 10),
        SWE210_mark: parseInt(document.getElementById('SWE210_mark').value, 10),
        MAE101_mark: parseInt(document.getElementById('MAE101_mark').value, 10),
        SWE200_mark: parseInt(document.getElementById('SWE200_mark').value, 10)
    };
    const res = await fetch(`${API}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
    });
    const data = await res.json();
    document.getElementById('addMsg').textContent = data.message;
    this.reset();
};

// Search Student by Roll Number
window.searchStudent = async function() {
    const roll = document.getElementById('search_roll').value;
    if (!roll) return;
    const res = await fetch(`${API}/students/${roll}`);
    const div = document.getElementById('searchResult');
    if (res.ok) {
        const s = await res.json();
        div.innerHTML = `
            <div class="student-card">
                <b>Name:</b> ${s.student_name}<br>
                <b>Roll Number:</b> ${s.roll_number}<br>
                <b>SWE210:</b> ${s.SWE210_mark}<br>
                <b>MAE101:</b> ${s.MAE101_mark}<br>
                <b>SWE200:</b> ${s.SWE200_mark}
            </div>`;
    } else {
        div.textContent = "Student not found.";
    }
};

// Load All Students
window.loadAllStudents = async function() {
    const res = await fetch(`${API}/students`);
    const students = await res.json();
    const div = document.getElementById('allStudents');
    if (!students || students.length === 0) {
        div.textContent = "No students found.";
        return;
    }
    div.innerHTML = students.map(s => `
        <div class="student-card">
            <b>Name:</b> ${s.student_name}<br>
            <b>Roll Number:</b> ${s.roll_number}<br>
            <b>SWE210:</b> ${s.SWE210_mark}<br>
            <b>MAE101:</b> ${s.MAE101_mark}<br>
            <b>SWE200:</b> ${s.SWE200_mark}
        </div>
    `).join('');
};

// Get Average for a Student
window.getAverage = async function() {
    const roll = document.getElementById('avg_roll').value;
    if (!roll) return;
    const res = await fetch(`${API}/students/${roll}/average`);
    const div = document.getElementById('avgResult');
    if (res.ok) {
        const data = await res.json();
        div.textContent = `Average mark : ${data.average.toFixed(2)}`;
    } else {
        div.textContent = "Student not found.";
    }
};