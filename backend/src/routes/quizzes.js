const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    next();
};

// Get all quizzes for the logged-in employer
router.get('/', requireAuth, (req, res) => {
    db.all(`
        SELECT q.*, 
               COUNT(qq.id) as question_count
        FROM quizzes q
        LEFT JOIN questions qq ON q.id = qq.quiz_id
        WHERE q.employer_id = ?
        GROUP BY q.id
        ORDER BY q.created_at DESC
    `, [req.session.userId], (err, quizzes) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.json(quizzes);
    });
});

// Create a new quiz
router.post('/', requireAuth, (req, res) => {
    const { title, description, timeLimit } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Title is required' });
    }

    db.run(`
        INSERT INTO quizzes (employer_id, title, description, time_limit)
        VALUES (?, ?, ?, ?)
    `, [req.session.userId, title, description, timeLimit], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.status(201).json({
            id: this.lastID,
            title,
            description,
            timeLimit
        });
    });
});

// Get a specific quiz
router.get('/:id', requireAuth, (req, res) => {
    const quizId = req.params.id;

    db.get(`
        SELECT q.*, 
               COUNT(qq.id) as question_count
        FROM quizzes q
        LEFT JOIN questions qq ON q.id = qq.quiz_id
        WHERE q.id = ? AND q.employer_id = ?
        GROUP BY q.id
    `, [quizId, req.session.userId], (err, quiz) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Get questions for this quiz
        db.all('SELECT * FROM questions WHERE quiz_id = ?', [quizId], (err, questions) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }

            quiz.questions = questions;
            res.json(quiz);
        });
    });
});

// Update a quiz
router.put('/:id', requireAuth, (req, res) => {
    const quizId = req.params.id;
    const { title, description, timeLimit } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Title is required' });
    }

    db.run(`
        UPDATE quizzes 
        SET title = ?, description = ?, time_limit = ?
        WHERE id = ? AND employer_id = ?
    `, [title, description, timeLimit, quizId, req.session.userId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        res.json({ message: 'Quiz updated successfully' });
    });
});

// Delete a quiz
router.delete('/:id', requireAuth, (req, res) => {
    const quizId = req.params.id;

    db.run('DELETE FROM quizzes WHERE id = ? AND employer_id = ?', [quizId, req.session.userId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        res.json({ message: 'Quiz deleted successfully' });
    });
});

// Invite a candidate to take a quiz
router.post('/:id/invite', requireAuth, async (req, res) => {
    const quizId = req.params.id;
    const { candidateEmail } = req.body;

    if (!candidateEmail) {
        return res.status(400).json({ message: 'Candidate email is required' });
    }

    try {
        // Check if quiz exists and belongs to employer
        const quiz = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM quizzes WHERE id = ? AND employer_id = ?', [quizId, req.session.userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Generate invitation token
        const invitationToken = uuidv4();

        // Create invitation record
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO quiz_invitations (quiz_id, candidate_email, invitation_token)
                VALUES (?, ?, ?)
            `, [quizId, candidateEmail, invitationToken], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
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

        const quizUrl = `${process.env.FRONTEND_URL}/quiz.html?token=${invitationToken}`;
        
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: candidateEmail,
            subject: `Invitation to take ${quiz.title}`,
            html: `
                <h1>You've been invited to take a quiz</h1>
                <p>You have been invited to take the quiz: ${quiz.title}</p>
                <p>Click the link below to start the quiz:</p>
                <a href="${quizUrl}">Take Quiz</a>
                <p>This invitation will expire in 7 days.</p>
            `
        });

        res.json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Invitation error:', error);
        res.status(500).json({ message: 'Failed to send invitation' });
    }
});

// Get quiz for candidate to take
router.get('/take/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Get invitation
        const invitation = await new Promise((resolve, reject) => {
            db.get(`
                SELECT qi.*, q.*
                FROM quiz_invitations qi
                JOIN quizzes q ON qi.quiz_id = q.id
                WHERE qi.invitation_token = ? AND qi.status = 'pending'
            `, [token], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!invitation) {
            return res.status(404).json({ message: 'Invalid or expired invitation' });
        }

        // Get questions
        const questions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM questions WHERE quiz_id = ?', [invitation.quiz_id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Format questions for the quiz
        const formattedQuestions = questions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: JSON.parse(q.options),
            points: q.points
        }));

        res.json({
            id: invitation.quiz_id,
            title: invitation.title,
            description: invitation.description,
            time_limit: invitation.time_limit,
            questions: formattedQuestions
        });
    } catch (error) {
        console.error('Error getting quiz:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Submit quiz answers
router.post('/submit/:token', async (req, res) => {
    const { token } = req.params;
    const { answers } = req.body;

    try {
        // Get invitation
        const invitation = await new Promise((resolve, reject) => {
            db.get(`
                SELECT qi.*, q.*
                FROM quiz_invitations qi
                JOIN quizzes q ON qi.quiz_id = q.id
                WHERE qi.invitation_token = ? AND qi.status = 'pending'
            `, [token], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!invitation) {
            return res.status(404).json({ message: 'Invalid or expired invitation' });
        }

        // Get questions to check answers
        const questions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM questions WHERE quiz_id = ?', [invitation.quiz_id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Calculate score
        let totalScore = 0;
        let maxScore = 0;

        for (const question of questions) {
            maxScore += question.points;
            if (answers[question.id] === question.correct_answer) {
                totalScore += question.points;
            }
        }

        const score = (totalScore / maxScore) * 100;

        // Save responses
        for (const [questionId, answer] of Object.entries(answers)) {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO candidate_responses 
                    (invitation_id, question_id, answer, is_correct)
                    VALUES (?, ?, ?, ?)
                `, [
                    invitation.id,
                    questionId,
                    answer,
                    answer === questions.find(q => q.id === parseInt(questionId))?.correct_answer
                ], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        // Update invitation status
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE quiz_invitations
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [invitation.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({
            message: 'Quiz submitted successfully',
            score: score.toFixed(2)
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 