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
    console.log('Fetching all candidates for userId:', req.session.userId);
    db.all(`
        SELECT c.*, a.id as assessment_id, a.status, a.test_id, a.start_time, a.end_time, a.score
        FROM candidates c
        LEFT JOIN assessments a ON c.id = a.candidate_id
        LEFT JOIN tests t ON a.test_id = t.id
        WHERE t.user_id = ?
        ORDER BY c.created_at DESC
    `, [req.session.userId], (err, rows) => {
        if (err) {
            console.error('DB error on candidate list:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        console.log('Candidates fetched successfully:', { count: rows.length });
        res.json(rows);
    });
});

// Invite a candidate (create candidate if not exists, create assessment, send email)
router.post('/invite', requireAuth, async (req, res) => {
    const { name, email, test_id } = req.body;
    console.log('Inviting candidate:', { name, email, test_id, userId: req.session.userId });
    if (!name || !email || !test_id) {
        console.log('Invite candidate failed: Missing required fields', req.body);
        return res.status(400).json({ message: 'Missing required fields', body: req.body });
    }
    let candidate;
    let candidateId;
    let token;
    try {
        // Check if candidate exists
        candidate = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM candidates WHERE email = ?', [email], (err, row) => {
                if (err) {
                    console.error('DB error on candidate check:', err, { email });
                    return reject({ step: 'candidate_check', error: err.message, email });
                }
                resolve(row);
            });
        });
    } catch (error) {
        console.error('Error during candidate lookup:', error);
        return res.status(500).json({ message: 'Database error during candidate lookup', error });
    }
    try {
        if (!candidate) {
            console.log('Creating new candidate:', { email });
            candidateId = await new Promise((resolve, reject) => {
                db.run('INSERT INTO candidates (name, email) VALUES (?, ?)', [name, email], function(err) {
                    if (err) {
                        console.error('DB error on candidate creation:', err, { name, email });
                        return reject({ step: 'candidate_creation', error: err.message, name, email });
                    }
                    resolve(this.lastID);
                });
            });
        } else {
            candidateId = candidate.id;
            console.log('Candidate already exists:', { candidateId });
        }
    } catch (error) {
        console.error('Error during candidate creation:', error);
        return res.status(500).json({ message: 'Database error during candidate creation', error });
    }
    try {
        // Create assessment
        token = uuidv4();
        console.log('Creating assessment for candidate:', { candidateId, test_id, token });
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO assessments (test_id, candidate_id, token) VALUES (?, ?, ?)', [test_id, candidateId, token], function(err) {
                if (err) {
                    console.error('DB error on assessment creation:', err, { candidateId, test_id, token });
                    return reject({ step: 'assessment_creation', error: err.message, candidateId, test_id, token });
                }
                resolve();
            });
        });
    } catch (error) {
        console.error('Error during assessment creation:', error);
        return res.status(500).json({ message: 'Database error during assessment creation', error });
    }
    // Send invitation email
    try {
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
        const mailOptions = {
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'You have been invited to take a coding assessment',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;border-radius:8px;">
                    <h2 style="color:#2c3e50;">SoftwareQuiz Assessment Invitation</h2>
                    <p>Hello <b>${name}</b>,</p>
                    <p>You have been invited to take a coding assessment. Click the button below to begin:</p>
                    <p style="text-align:center;margin:30px 0;">
                        <a href="${testUrl}" style="background:#3498db;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">Start Assessment</a>
                    </p>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break:break-all;"><a href="${testUrl}">${testUrl}</a></p>
                    <hr style="margin:30px 0;">
                    <p style="font-size:0.9em;color:#888;">If you did not expect this email, you can ignore it.</p>
                </div>
            `
        };
        console.log('Sending invitation email to:', { email, testUrl });
        await transporter.sendMail(mailOptions);
        console.log('Invitation sent successfully');
        res.json({ message: 'Invitation sent', email, testUrl });
    } catch (error) {
        console.error('Error sending invitation email:', error, { email, token });
        return res.status(500).json({ message: 'Failed to send invitation email', error: error.message, email, token });
    }
});

// List all assessments for the logged-in user (with candidate and test info)
router.get('/assessments', requireAuth, (req, res) => {
    console.log('Fetching all assessments for userId:', req.session.userId);
    db.all(`
        SELECT a.*, c.name as candidate_name, c.email as candidate_email, t.name as test_name
        FROM assessments a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN tests t ON a.test_id = t.id
        WHERE t.user_id = ?
        ORDER BY a.start_time DESC
    `, [req.session.userId], (err, rows) => {
        if (err) {
            console.error('DB error on assessment list:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        console.log('Assessments fetched successfully:', { count: rows.length });
        res.json(rows);
    });
});

// Candidate: Get assessment by token (for test-taking)
router.get('/take/:token', async (req, res) => {
    const { token } = req.params;
    console.log('Fetching assessment by token:', { token });
    try {
        const assessment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT a.*, t.name as test_name, t.instructions, t.time_limit
                FROM assessments a
                JOIN tests t ON a.test_id = t.id
                WHERE a.token = ?
            `, [token], (err, row) => {
                if (err) {
                    console.error('DB error on assessment fetch:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
        if (!assessment) {
            console.log('Assessment not found for token:', { token });
            return res.status(404).json({ message: 'Invalid or expired link' });
        }
        // Get MC questions and options
        const mcQuestions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM mc_questions WHERE test_id = ?', [assessment.test_id], (err, questions) => {
                if (err) return reject(err);
                const promises = questions.map(q => new Promise((resolve2) => {
                    db.all('SELECT * FROM mc_options WHERE mc_question_id = ?', [q.id], (err, options) => {
                        q.options = options || [];
                        resolve2(q);
                    });
                }));
                Promise.all(promises).then(resolve);
            });
        });
        // Get freeform questions
        const freeformQuestions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM freeform_questions WHERE test_id = ?', [assessment.test_id], (err, questions) => {
                if (err) return reject(err);
                resolve(questions);
            });
        });
        assessment.mc_questions = mcQuestions;
        assessment.freeform_questions = freeformQuestions;
        res.json(assessment);
    } catch (error) {
        console.error('Assessment fetch error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Candidate: Submit assessment result (status, score, end_time, answers)
router.post('/submit/:token', async (req, res) => {
    const { token } = req.params;
    const { status, score, mc_answers, freeform_answers } = req.body;
    console.log('Submitting assessment:', { token, status, score });
    try {
        // Get assessment id
        const assessment = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM assessments WHERE token = ?', [token], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        const assessmentId = assessment.id;
        // Store MC answers
        if (Array.isArray(mc_answers)) {
            for (const ans of mc_answers) {
                // ans: { mc_option_id }
                await new Promise((resolve, reject) => {
                    db.run('INSERT INTO mc_responses (mc_option_id, assessment_id) VALUES (?, ?)', [ans.mc_option_id, assessmentId], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }
        }
        // Store freeform answers
        if (Array.isArray(freeform_answers)) {
            for (const ans of freeform_answers) {
                // ans: { freeform_question_id, response_text }
                await new Promise((resolve, reject) => {
                    db.run('INSERT INTO freeform_responses (freeform_question_id, assessment_id) VALUES (?, ?)', [ans.freeform_question_id, assessmentId], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }
        }
        // Update assessment status/score
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE assessments SET status = ?, score = ?, end_time = CURRENT_TIMESTAMP WHERE token = ?',
                [status, score, token],
                function(err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        console.log('Assessment submitted successfully');
        res.json({ message: 'Assessment submitted' });
    } catch (error) {
        console.error('Assessment submit error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 