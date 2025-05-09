const express = require('express');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    next();
}

// List all candidates for the logged-in user (with their assessments)
router.get('/', requireAuth, (req, res) => {
    db.all(`
        SELECT c.*, a.id as assessment_id, a.status, a.test_id, a.start_time, a.end_time, a.score
        FROM candidates c
        LEFT JOIN assessments a ON c.id = a.candidate_id
        LEFT JOIN tests t ON a.test_id = t.id
        WHERE t.user_id = ?
        ORDER BY c.created_at DESC
    `, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(rows);
    });
});

// Invite a candidate (create candidate if not exists, create assessment, send email)
router.post('/invite', requireAuth, async (req, res) => {
    const { name, email, test_id } = req.body;
    if (!name || !email || !test_id) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        // Check if candidate exists
        let candidate = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM candidates WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        let candidateId;
        if (!candidate) {
            // Create candidate
            candidateId = await new Promise((resolve, reject) => {
                db.run('INSERT INTO candidates (name, email) VALUES (?, ?)', [name, email], function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                });
            });
        } else {
            candidateId = candidate.id;
        }
        // Create assessment
        const token = uuidv4();
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO assessments (test_id, candidate_id, token) VALUES (?, ?, ?)', [test_id, candidateId, token], function(err) {
                if (err) reject(err);
                resolve();
            });
        });
        // Send invitation email
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        const testUrl = `${process.env.FRONTEND_URL}/candidate-test.html?token=${token}`;
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'You have been invited to take a coding assessment',
            html: `<p>Hello ${name},</p><p>You have been invited to take a coding assessment. Click the link below to begin:</p><a href="${testUrl}">${testUrl}</a>`
        });
        res.json({ message: 'Invitation sent' });
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ message: 'Failed to invite candidate' });
    }
});

// List all assessments for the logged-in user (with candidate and test info)
router.get('/assessments', requireAuth, (req, res) => {
    db.all(`
        SELECT a.*, c.name as candidate_name, c.email as candidate_email, t.name as test_name
        FROM assessments a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN tests t ON a.test_id = t.id
        WHERE t.user_id = ?
        ORDER BY a.start_time DESC
    `, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(rows);
    });
});

// Candidate: Get assessment by token (for test-taking)
router.get('/take/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const assessment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT a.*, t.name as test_name, t.description, t.arg_names, t.time_limit
                FROM assessments a
                JOIN tests t ON a.test_id = t.id
                WHERE a.token = ?
            `, [token], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        if (!assessment) return res.status(404).json({ message: 'Invalid or expired link' });
        // Get test cases
        const testCases = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM test_cases WHERE test_id = ?', [assessment.test_id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        assessment.test_cases = testCases;
        res.json(assessment);
    } catch (error) {
        console.error('Assessment fetch error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Candidate: Submit assessment result (status, score, end_time)
router.post('/submit/:token', async (req, res) => {
    const { token } = req.params;
    const { status, score } = req.body;
    try {
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE assessments SET status = ?, score = ?, end_time = CURRENT_TIMESTAMP WHERE token = ?',
                [status, score, token],
                function(err) {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: 'Assessment submitted' });
    } catch (error) {
        console.error('Assessment submit error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 