const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// --- MULTIPLE CHOICE QUESTIONS ---
// Create MC question
router.post('/mc', authenticateToken, (req, res) => {
    const { test_id, question_text, points, options } = req.body;
    if (!test_id || !question_text || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: 'Missing required fields for MC question' });
    }
    db.run(
        'INSERT INTO mc_questions (test_id, question_text, points) VALUES (?, ?, ?)',
        [test_id, question_text, points || 1],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to create MC question' });
            const mc_question_id = this.lastID;
            // Insert options
            const stmt = db.prepare('INSERT INTO mc_options (is_correct, mc_question_id, option_text) VALUES (?, ?, ?)');
            for (const opt of options) {
                stmt.run(opt.is_correct ? 1 : 0, mc_question_id, opt.option_text);
            }
            stmt.finalize((err) => {
                if (err) return res.status(500).json({ error: 'Failed to create MC options' });
                res.json({ id: mc_question_id, message: 'MC question created' });
            });
        }
    );
});
// Get all MC questions for a test
router.get('/mc/:testId', authenticateToken, (req, res) => {
    db.all('SELECT * FROM mc_questions WHERE test_id = ?', [req.params.testId], (err, questions) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch MC questions' });
        // For each question, get options
        const promises = questions.map(q => new Promise((resolve) => {
            db.all('SELECT * FROM mc_options WHERE mc_question_id = ?', [q.id], (err, options) => {
                q.options = options || [];
                resolve(q);
            });
        }));
        Promise.all(promises).then(results => res.json(results));
    });
});
// Update MC question
router.put('/mc/:id', authenticateToken, (req, res) => {
    const { question_text, points, options } = req.body;
    db.run('UPDATE mc_questions SET question_text = ?, points = ? WHERE id = ?', [question_text, points, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update MC question' });
        if (options) {
            db.run('DELETE FROM mc_options WHERE mc_question_id = ?', [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to update MC options' });
                const stmt = db.prepare('INSERT INTO mc_options (is_correct, mc_question_id, option_text) VALUES (?, ?, ?)');
                for (const opt of options) {
                    stmt.run(opt.is_correct ? 1 : 0, req.params.id, opt.option_text);
                }
                stmt.finalize((err) => {
                    if (err) return res.status(500).json({ error: 'Failed to update MC options' });
                    res.json({ message: 'MC question updated' });
                });
            });
        } else {
            res.json({ message: 'MC question updated' });
        }
    });
});
// Delete MC question
router.delete('/mc/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM mc_questions WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete MC question' });
        db.run('DELETE FROM mc_options WHERE mc_question_id = ?', [req.params.id], () => {
            res.json({ message: 'MC question and options deleted' });
        });
    });
});

// --- FREEFORM QUESTIONS ---
// Create freeform question
router.post('/freeform', authenticateToken, (req, res) => {
    const { test_id, question_text, points } = req.body;
    if (!test_id || !question_text) {
        return res.status(400).json({ error: 'Missing required fields for freeform question' });
    }
    db.run('INSERT INTO freeform_questions (test_id, question_text, points) VALUES (?, ?, ?)', [test_id, question_text, points || 1], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create freeform question' });
        res.json({ id: this.lastID, message: 'Freeform question created' });
    });
});
// Get all freeform questions for a test
router.get('/freeform/:testId', authenticateToken, (req, res) => {
    db.all('SELECT * FROM freeform_questions WHERE test_id = ?', [req.params.testId], (err, questions) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch freeform questions' });
        res.json(questions);
    });
});
// Update freeform question
router.put('/freeform/:id', authenticateToken, (req, res) => {
    const { question_text, points } = req.body;
    db.run('UPDATE freeform_questions SET question_text = ?, points = ? WHERE id = ?', [question_text, points, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update freeform question' });
        res.json({ message: 'Freeform question updated' });
    });
});
// Delete freeform question
router.delete('/freeform/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM freeform_questions WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete freeform question' });
        res.json({ message: 'Freeform question deleted' });
    });
});

// --- FETCH ALL QUESTIONS FOR A TEST (grouped by type) ---
router.get('/all/:testId', authenticateToken, async (req, res) => {
    const testId = req.params.testId;
    try {
        const mcQuestions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM mc_questions WHERE test_id = ?', [testId], (err, questions) => {
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
        const freeformQuestions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM freeform_questions WHERE test_id = ?', [testId], (err, questions) => {
                if (err) return reject(err);
                resolve(questions);
            });
        });
        res.json({ mc_questions: mcQuestions, freeform_questions: freeformQuestions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

module.exports = router; 