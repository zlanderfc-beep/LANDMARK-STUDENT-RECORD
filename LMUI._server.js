// Ensure you have installed dependencies: npm install express cors nodemailer

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); // <-- Add this line
const app = express();
const PORT = 5500;
const PROJECT_DIR = __dirname;
const LECTURER_FILE = path.join(PROJECT_DIR, 'Lecturer.json');

// Use CORS and JSON middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(PROJECT_DIR));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true}));

// Increase payload size if needed
app.use(express.json({ limit: '2mb' }));

// File mapping for each level
const STUDENT_FILES = {
    "200": path.join(__dirname, 'students lv 200.json'),
    "300": path.join(__dirname, 'students lv 300.json'),
    "400": path.join(__dirname, 'students lv 400.json')
};

const ROLL_RANGES = {
    "200": { min: 1, max: 199 },
    "300": { min: 200, max: 299 },
    "400": { min: 300, max: 400 }
};

// Helper to get file by level
function getStudentFile(level) {
    return STUDENT_FILES[level] || STUDENT_FILES["200"];
}

// Helper to read students by level
function readStudents(level) {
    const file = getStudentFile(level);
    if (!fs.existsSync(file)) return [];
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
}

// Helper to write students by level (creates file if not exists)
function writeStudents(level, students) {
    const file = getStudentFile(level);
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
    fs.writeFileSync(file, JSON.stringify(students, null, 2));
}

// Add or update student (with roll number range enforcement)
app.post('/students', (req, res) => {
    const { level, roll_number, ...student } = req.body;
    if (!level || !["200", "300", "400"].includes(level)) {
        return res.status(400).json({ error: "Invalid or missing level." });
    }
    const roll = parseInt(roll_number, 10);
    const { min, max } = ROLL_RANGES[level];
    if (isNaN(roll) || roll < min || roll > max) {
        return res.status(400).json({ error: `Roll number for level ${level} must be between ${min} and ${max}.` });
    }
    let students = readStudents(level);
    // Enforce roll_number as primary key
    students = students.filter(s => parseInt(s.roll_number, 10) !== roll);
    students.push({ ...student, roll_number, level });
    writeStudents(level, students);
    res.json({ message: `Student record added/updated for level ${level}.` });
});

// Get all students for a level
app.get('/students', (req, res) => {
    const level = req.query.level;
    if (!level || !["200", "300", "400"].includes(level)) {
        return res.status(400).json({ error: "Invalid or missing level." });
    }
    res.json(readStudents(level));
});

// Get student by roll number and level
app.get('/students/:roll_number', (req, res) => {
    const roll = parseInt(req.params.roll_number, 10);
    const level = req.query.level;
    if (!level || !["200", "300", "400"].includes(level)) {
        return res.status(400).json({ error: "Invalid or missing level." });
    }
    const { min, max } = ROLL_RANGES[level];
    if (isNaN(roll) || roll < min || roll > max) {
        return res.status(400).json({ error: `Roll number for level ${level} must be between ${min} and ${max}.` });
    }
    const students = readStudents(level);
    const student = students.find(s => parseInt(s.roll_number, 10) === roll);
    if (student) res.json(student);
    else res.status(404).json({ error: 'Student not found' });
});

// Calculate average for a student and level
app.get('/students/:roll_number/average', (req, res) => {
    const roll = parseInt(req.params.roll_number, 10);
    const level = req.query.level;
    if (!level || !["200", "300", "400"].includes(level)) {
        return res.status(400).json({ error: "Invalid or missing level." });
    }
    const { min, max } = ROLL_RANGES[level];
    if (isNaN(roll) || roll < min || roll > max) {
        return res.status(400).json({ error: `Roll number for level ${level} must be between ${min} and ${max}.` });
    }
    const students = readStudents(level);
    const student = students.find(s => parseInt(s.roll_number, 10) === roll);
    if (student) {
        // You can adjust the marks fields as needed
        const marks = [
            Number(student.SWE210_mark) || 0,
            Number(student.MAE101_mark) || 0,
            Number(student.SWE200_mark) || 0
        ];
        const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
        res.json({ average: avg });
    } else {
        res.status(404).json({ error: 'Student not found' });
    }
});

// --- Lecturer account creation endpoint ---
function readLecturers() {
    if (!fs.existsSync(LECTURER_FILE)) {
        fs.writeFileSync(LECTURER_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
    const data = fs.readFileSync(LECTURER_FILE, 'utf8');
    try {
        return JSON.parse(data);
    } catch {
        fs.writeFileSync(LECTURER_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
}
function writeLecturers(lecturers) {
    fs.writeFileSync(LECTURER_FILE, JSON.stringify(lecturers, null, 2), 'utf8');
}

const LOAD_LECTURERS_FILE = path.join(PROJECT_DIR, 'load_lecturer.json');

// Helper to update load_lecturer.json with all lecturers
function updateLoadLecturerFile(lecturers) {
    fs.writeFileSync(LOAD_LECTURERS_FILE, JSON.stringify(lecturers, null, 2), 'utf8');
}

// --- Update signup endpoint to also update load_lecturer.json ---
app.post('/api/lecturer/signup', async (req, res) => {
    try {
        const { lec_name, signin_email, signin_password } = req.body;
        if (!lec_name || !signin_email || !signin_password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        let lecturers = readLecturers();
        if (lecturers.some(l => l.signin_email === signin_email)) {
            return res.status(409).json({ error: 'Email already exists.' });
        }
        lecturers.push({ lec_name, signin_email, signin_password });
        writeLecturers(lecturers);
        updateLoadLecturerFile(lecturers);

        // --- Send welcome email using nodemailer with professional navy/white design ---
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'obaseviv@gmail.com',
                pass: 'xpxzxtyzxfldbaww'
            }
        });

        const landingPageUrl = 'http://localhost:5500/LSMS_Landing.html';

        const htmlContent = `
        <div style="max-width:700px;margin:40px auto;background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(10,35,66,0.10);font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;border:1px solid #e0e6ed;">
            <div style="background:#0a2342;padding:40px 0 24px 0;text-align:center;">
                <img src="cid:landmarklogo" alt="Landmark Logo" width="90" height="90" style="border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(10,35,66,0.08);margin-bottom:12px;">
                <h1 style="color:#fff;margin:0;font-weight:700;font-size:2em;letter-spacing:1px;">Landmark Student Management System</h1>
            </div>
            <div style="padding:36px 40px 24px 40px;color:#0a2342;">
                <h2 style="margin-top:0;font-size:1.3em;color:#0a2342;">Welcome, ${lec_name}!</h2>
                <p style="font-size:1.1em;">Your lecturer account has been created successfully.<br>You can now login with the credential below:</p>
                <p>LSMS_Email: landmarkadmin@gmail.com</p>
                <p>LSMS_password: <b>lmuiadmin001,.</b></p>
                </div>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${landingPageUrl}" style="background:#0a2342;color:#fff;text-decoration:none;padding:14px 36px;border-radius:24px;font-weight:600;font-size:1.1em;display:inline-block;box-shadow:0 2px 8px rgba(10,35,66,0.08);">Visit Website</a>
                </div>
                <p style="font-size:1.05em;">Best regards,<br>Landmark Student Record Team</p>
            </div>
            <div style="background:#0a2342;color:#fff;text-align:center;padding:14px 0;font-size:1em;">
                &copy; 2025 Landmark Student Management System
            </div>
        </div>
        `;

        const mailOptions = {
            from: '"Landmark Student Management Team" <obaseviv@gmail.com>',
            to: signin_email,
            subject: 'Welcome to Landmark Student Management System',
            html: htmlContent,
            attachments: [{
                filename: 'landmarklogo2.png',
                path: path.join(__dirname, 'landmarklogo2.png'),
                cid: 'landmarklogo'
            }]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending welcome email:', error);
            } else {
                console.log('Welcome email sent:', info.response);
            }
        });

        res.json({ success: true, message: 'Lecturer registered successfully.' });
    } catch (err) {
        console.error('Lecturer signup error:', err);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// --- Use load_lecturer.json for login checks ---
function readLoadLecturer() {
    if (!fs.existsSync(LOAD_LECTURERS_FILE)) {
        fs.writeFileSync(LOAD_LECTURERS_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(LOAD_LECTURERS_FILE, 'utf8'));
    } catch {
        fs.writeFileSync(LOAD_LECTURERS_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
}

app.post('/api/lecturer/login', (req, res) => {
    try {
        const { signin_email, signin_password } = req.body;
        if (!signin_email || !signin_password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        const lecturers = readLoadLecturer();
        const lecturer = lecturers.find(
            l => l.signin_email === signin_email && l.signin_password === signin_password
        );
        if (lecturer) {
            return res.json({ success: true, lec_name: lecturer.lec_name, message: 'login successful' });
        } else {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
    } catch (err) {
        console.error('Lecturer login error:', err);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// Replace your /api/student-validate endpoint with this:
app.post('/api/student-validate', (req, res) => {
    const { name, roll_number } = req.body;
    if (!name || !roll_number) {
        return res.json({ status: "invalid" });
    }
    const files = [
        { level: "200", file: STUDENT_FILES["200"], label: "students lv 200.json" },
        { level: "300", file: STUDENT_FILES["300"], label: "students lv 300.json" },
        { level: "400", file: STUDENT_FILES["400"], label: "students lv 400.json" }
    ];
    let foundName = false;
    let foundRoll = false;
    let foundBoth = false;
    let foundFile = null;

    for (const { file, label } of files) {
        if (!fs.existsSync(file)) continue;
        let students;
        try {
            students = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            continue;
        }
        for (const student of students) {
            if (
                student.student_name &&
                student.student_name.trim().toLowerCase() === name.trim().toLowerCase()
            ) {
                foundName = true;
                if (
                    student.roll_number &&
                    String(student.roll_number).trim() === String(roll_number).trim()
                ) {
                    foundBoth = true;
                    foundFile = label;
                    break;
                } else {
                    foundRoll = true;
                }
            }
        }
        if (foundBoth) break;
    }

    if (foundBoth && foundFile) {
        return res.json({ status: "success", foundFile });
    } else if (foundName && !foundBoth) {
        return res.json({ status: "roll_mismatch" });
    } else if (!foundName && foundRoll) {
        return res.json({ status: "roll_mismatch" });
    } else if (!foundName && !foundRoll) {
        return res.json({ status: "not_found" });
    } else {
        return res.json({ status: "invalid" });
    }
});

// Add these endpoints to your server:

app.post('/api/student-search-file', (req, res) => {
    const { roll_number, file } = req.body;
    if (!roll_number || !file) return res.status(400).json({ error: "Missing data" });
    if (!fs.existsSync(file)) return res.status(404).json({ error: "File not found" });
    try {
        const students = JSON.parse(fs.readFileSync(file, 'utf8'));
        const student = students.find(s => String(s.roll_number).trim() === String(roll_number).trim());
        if (!student) return res.status(404).json({ error: "Student not found" });
        res.json(student);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/student-average-file', (req, res) => {
    const { roll_number, file } = req.body;
    if (!roll_number || !file) return res.status(400).json({ error: "Missing data" });
    if (!fs.existsSync(file)) return res.status(404).json({ error: "File not found" });
    try {
        const students = JSON.parse(fs.readFileSync(file, 'utf8'));
        const student = students.find(s => String(s.roll_number).trim() === String(roll_number).trim());
        if (!student) return res.status(404).json({ error: "Student not found" });
        const marks = [student.SWE210_mark, student.MAE101_mark, student.SWE200_mark];
        const average = marks.reduce((a, b) => a + b, 0) / marks.length;
        res.json({ average });
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/lecturers', (req, res) => {
    try {
        const lecturers = JSON.parse(fs.readFileSync('Lecturer.json', 'utf8'));
        res.json(lecturers);
    } catch {
        res.json([]);
    }
});

// Endpoint: Return all students (name and roll number) from the specified student file
app.get('/api/class-list', (req, res) => {
    const file = req.query.file;
    if (!file) {
        return res.status(400).json({ error: 'File parameter is required.' });
    }
    try {
        const students = JSON.parse(fs.readFileSync(file, 'utf8'));
        // Only return student_name and roll_number for each student
        const result = students
            .filter(s => s.student_name && s.roll_number)
            .map(s => ({
                student_name: s.student_name,
                roll_number: s.roll_number
            }));
        res.json(result);
    } catch (err) {
        res.status(404).json({ error: 'File not found or invalid JSON.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.post('/api/lecturer/forgot-password', async (req, res) => {
    try {
        const { signin_email } = req.body;
        if (!signin_email) return res.status(400).json({ error: "Email required." });
        let lecturers = readLecturers();
        const lecturer = lecturers.find(l => l.signin_email === signin_email);
        if (!lecturer) return res.status(404).json({ error: "Email not found." });

        // --- Send welcome email (reuse your welcome email code) ---
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'obaseviv@gmail.com',
                pass: 'xpxzxtyzxfldbaww'
            }
        });

        const landingPageUrl = 'http://localhost:5500/LSMS_Landing.html';
        const htmlContent = `
        <div style="max-width:700px;margin:40px auto;background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(10,35,66,0.10);font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;border:1px solid #e0e6ed;">
            <div style="background:#0a2342;padding:40px 0 24px 0;text-align:center;">
                <img src="cid:landmarklogo" alt="Landmark Logo" width="90" height="90" style="border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(10,35,66,0.08);margin-bottom:12px;">
                <h1 style="color:#fff;margin:0;font-weight:700;font-size:2em;letter-spacing:1px;">Landmark Student Management System</h1>
            </div>
            <div style="padding:36px 40px 24px 40px;color:#0a2342;">
                <h2 style="margin-top:0;font-size:1.3em;color:#0a2342;">Welcome, ${lecturer.lec_name || ''}!</h2>
                <p style="font-size:1.1em;">Your lecturer account credentials:</p>
                <div style="background:#f0f4fa;border-radius:10px;margin:28px 0 20px 0;font-size:1.1em;padding:16px 22px;">
                    <b>LSMS_Email:</b> <span style="color:#0a2342;">landmarkadmin@gmail.com</span><br>
                    <b>LSMS_password:</b> <span style="color:#0a2342;">lmuiadmin001,.</span>
                </div>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${landingPageUrl}" style="background:#0a2342;color:#fff;text-decoration:none;padding:14px 36px;border-radius:24px;font-weight:600;font-size:1.1em;display:inline-block;box-shadow:0 2px 8px rgba(10,35,66,0.08);">Visit Website</a>
                </div>
                <p style="font-size:1.05em;">Best regards,<br>Landmark Student Record Team</p>
            </div>
            <div style="background:#0a2342;color:#fff;text-align:center;padding:14px 0;font-size:1em;">
                &copy; 2025 Landmark Student Management System
            </div>
        </div>
        `;

        const mailOptions = {
            from: '"Landmark Student Record" <obaseviv@gmail.com>',
            to: signin_email,
            subject: 'Your LSMS Account Credentials',
            html: htmlContent,
            attachments: [{
                filename: 'landmarklogo2.png',
                path: path.join(__dirname, 'landmarklogo2.png'),
                cid: 'landmarklogo'
            }]
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

// Admin routes
// Check if administrator.json exists
app.get('/api/admin/exists', (req, res) => {
    res.json({ exists: fs.existsSync(path.join(__dirname, 'administrator.json')) });
});

// Copy Lecturer.json to administrator.json if not exists
app.post('/api/admin/copy', (req, res) => {
    const adminPath = path.join(__dirname, 'administrator.json');
    if (!fs.existsSync(adminPath)) {
        const lecturerPath = path.join(__dirname, 'Lecturer.json');
        if (fs.existsSync(lecturerPath)) {
            fs.copyFileSync(lecturerPath, adminPath);
        } else {
            fs.writeFileSync(adminPath, '[]');
        }
    }
    res.json({ exists: true });
});

// Check admin passcode
app.post('/api/admin/check-pass', (req, res) => {
    const { pass } = req.body;
    const adminPath = path.join(__dirname, 'administrator.json');
    if (!fs.existsSync(adminPath)) return res.json({ success: false });
    const admins = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
    const found = admins.some(a => a.signin_password === pass);
    res.json({ success: found });
});

// Lecturer email check endpoint
app.post('/api/lecturer/check-email', (req, res) => {
    const { email } = req.body;
    const lecturerPath = path.join(__dirname, 'Lecturer.json');
    let exists = false;
    if (fs.existsSync(lecturerPath)) {
        try {
            const lecturers = JSON.parse(fs.readFileSync(lecturerPath, 'utf8'));
            exists = lecturers.some(l => l.email && l.email.toLowerCase() === email.toLowerCase());
        } catch (err) {
            exists = false;
        }
    }
    res.json({ exists });
});

// --- KYC Verification Email Endpoint ---
app.post('/api/send-kyc-email', async (req, res) => {
    const { adminEmail, userEmail, image } = req.body;
    try {
        // Setup nodemailer transporter
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'obaseviv@gmail.com', // sender Gmail
                pass: 'xpxzxtyzxfldbaww'    // app password
            }
        });

        // Parse base64 image data
        let matches = image.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ success: false, error: "Invalid image data" });
        }
        let mimeType = matches[1];
        let base64Data = matches[2];

        // Email body
        const mailText = `Greetings sir/madam, I am a lecturer at landmark, and I want your permission to create an account in the LSMS.\n\nMy email address is: ${userEmail}`;

        let mailOptions = {
            from: `"Landmark Lecturer" <obaseviv@gmail.com>`,
            to: adminEmail,
            subject: "LSMS Account Approval Request",
            text: mailText,
            attachments: [
                {
                    filename: 'lecturer_id.' + mimeType.split('/')[1],
                    content: Buffer.from(base64Data, 'base64'),
                    contentType: mimeType
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Helper: Generate secure random 4-digit OTP
function generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send OTP email
async function sendOtpEmail(email, otp) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'obaseviv@gmail.com',
            pass: 'xpxzxtyzxfldbaww'
        }
    });
    const mailOptions = {
        from: '"Landmark Student Record" <obaseviv@gmail.com>',
        to: email,
        subject: 'Your LSMS Login OTP',
        text: `Your LSMS login OTP is: ${otp}\n\nThis code is valid for 1 minute.`,
    };
    await transporter.sendMail(mailOptions);
}

// Send OTP and store in temp file
app.post('/api/lecturer/send-otp', async (req, res) => {
    const { email } = req.body;
    const lecturerPath = path.join(__dirname, 'Lecturer.json');
    const otpTempPath = path.join(__dirname, 'otp_temp.json');
    let exists = false;
    if (fs.existsSync(lecturerPath)) {
        try {
            const lecturers = JSON.parse(fs.readFileSync(lecturerPath, 'utf8'));
            exists = lecturers.some(l => l.email && l.email.toLowerCase() === email.toLowerCase());
        } catch (err) {
            exists = false;
        }
    }
    if (!exists) return res.json({ success: false, error: "Email not found in lecturer records." });

    const otp = generateOtp();
    const expires = Date.now() + 60000; // 1 minute
    // Store OTP in temp file
    let otpData = {};
    if (fs.existsSync(otpTempPath)) {
        try {
            otpData = JSON.parse(fs.readFileSync(otpTempPath, 'utf8'));
        } catch (err) { otpData = {}; }
    }
    otpData[email.toLowerCase()] = { otp, expires };
    fs.writeFileSync(otpTempPath, JSON.stringify(otpData, null, 2));
    try {
        await sendOtpEmail(email, otp);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: "Failed to send OTP email." });
    }
});

// Validate OTP
app.post('/api/lecturer/validate-otp', (req, res) => {
    const { email, otp } = req.body;
    const lecturerPath = path.join(__dirname, 'Lecturer.json');
    const otpTempPath = path.join(__dirname, 'otp_temp.json');
    let exists = false;
    if (fs.existsSync(lecturerPath)) {
        try {
            const lecturers = JSON.parse(fs.readFileSync(lecturerPath, 'utf8'));
            exists = lecturers.some(l => l.email && l.email.toLowerCase() === email.toLowerCase());
        } catch (err) {
            exists = false;
        }
    }
    if (!exists) return res.json({ success: false, error: "Lecturer email not found." });

    let otpData = {};
    if (fs.existsSync(otpTempPath)) {
        try {
            otpData = JSON.parse(fs.readFileSync(otpTempPath, 'utf8'));
        } catch (err) { otpData = {}; }
    }
    const record = otpData[email.toLowerCase()];
    if (!record) return res.json({ success: false, error: "No OTP found. Please request a new code." });
    if (Date.now() > record.expires) return res.json({ success: false, error: "OTP expired. Please request a new code." });
    if (record.otp !== otp) return res.json({ success: false, error: "Incorrect OTP." });

    // Optionally, remove OTP after successful validation
    delete otpData[email.toLowerCase()];
    fs.writeFileSync(otpTempPath, JSON.stringify(otpData, null, 2));
    res.json({ success: true });
});
