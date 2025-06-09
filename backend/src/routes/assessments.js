const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Middleware to ensure user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get assessment details for grading
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const assessmentId = req.params.id;
        const userId = req.session.userId;
        console.log('Fetching assessment for grading:', { assessmentId, userId });

        // Get assessment details with candidate and test info
        const assessment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT a.*, c.name as candidate_name, c.email as candidate_email, t.name as test_name
                FROM assessments a
                JOIN candidates c ON a.candidate_id = c.id
                JOIN tests t ON a.test_id = t.id
                WHERE a.id = ? AND t.user_id = ?
            `, [assessmentId, userId], (err, row) => {
                if (err) {
                    console.error('DB error on assessment fetch:', err, { assessmentId, userId });
                    reject(err);
                } else {
                    if (!row) {
                        console.warn('Assessment not found or not authorized:', { assessmentId, userId });
                    }
                    resolve(row);
                }
            });
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Get MC questions with options and responses
        const mcQuestions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT q.*, GROUP_CONCAT(
                    json_object(
                        'id', o.id,
                        'option_text', o.option_text,
                        'is_correct', o.is_correct
                    )
                ) as options
                FROM mc_questions q
                LEFT JOIN mc_options o ON q.id = o.mc_question_id
                WHERE q.test_id = ?
                GROUP BY q.id
            `, [assessment.test_id], (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse options JSON
                    rows.forEach(row => {
                        row.options = JSON.parse('[' + row.options + ']');
                    });
                    resolve(rows);
                }
            });
        });

        // Get MC responses
        const mcResponses = await new Promise((resolve, reject) => {
            db.all(`
                SELECT *
                FROM mc_responses
                WHERE assessment_id = ?
            `, [assessmentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get freeform questions and responses
        const freeformQuestions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT *
                FROM freeform_questions
                WHERE test_id = ?
            `, [assessment.test_id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const freeformResponses = await new Promise((resolve, reject) => {
            db.all(`
                SELECT *
                FROM freeform_responses
                WHERE assessment_id = ?
            `, [assessmentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            ...assessment,
            mc_questions: mcQuestions,
            mc_responses: mcResponses,
            freeform_questions: freeformQuestions,
            freeform_responses: freeformResponses
        });
    } catch (error) {
        console.error('Error fetching assessment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Grade assessment
router.post('/:id/grade', requireAuth, async (req, res) => {
    try {
        const assessmentId = req.params.id;
        // Verify assessment exists and belongs to user
        const assessment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT a.*, t.user_id
                FROM assessments a
                JOIN tests t ON a.test_id = t.id
                WHERE a.id = ?
            `, [assessmentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        if (assessment.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized to grade this assessment' });
        }

        // Calculate total score (MC only)
        const mcScore = await new Promise((resolve, reject) => {
            db.get(`
                SELECT SUM(q.points) as total_score
                FROM mc_responses r
                JOIN mc_questions q ON r.mc_question_id = q.id
                JOIN mc_options o ON r.mc_option_id = o.id
                WHERE r.assessment_id = ? AND o.is_correct = 1
            `, [assessmentId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_score || 0);
            });
        });

        const totalPoints = await new Promise((resolve, reject) => {
            db.get(`
                SELECT SUM(points) as total_points FROM mc_questions WHERE test_id = ?
            `, [assessment.test_id], (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_points || 0);
            });
        });

        const totalScore = totalPoints > 0 ? Math.round((mcScore / totalPoints) * 100) : 0;

        // Update assessment with final score
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessments
                SET score = ?, status = 'COMPLETED'
                WHERE id = ?
            `, [totalScore, assessmentId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ total_score: totalScore });
    } catch (error) {
        console.error('Error grading assessment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 