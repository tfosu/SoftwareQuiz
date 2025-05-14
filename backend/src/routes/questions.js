const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all questions for a test
router.get('/test/:testId', authenticateToken, (req, res) => {
    const { testId } = req.params;
    
    db.all(`
        SELECT q.*, 
               GROUP_CONCAT(mco.id || ':' || mco.option_text || ':' || mco.is_correct || ':' || mco.order_index) as options
        FROM questions q
        LEFT JOIN multiple_choice_options mco ON q.id = mco.question_id
        WHERE q.test_id = ?
        GROUP BY q.id
        ORDER BY q.order_index
    `, [testId], (err, questions) => {
        if (err) {
            console.error('Error fetching questions:', err);
            return res.status(500).json({ error: 'Failed to fetch questions' });
        }

        // Parse the options string into an array of objects
        const formattedQuestions = questions.map(q => ({
            ...q,
            options: q.options ? q.options.split(',').map(opt => {
                const [id, text, isCorrect, orderIndex] = opt.split(':');
                return {
                    id: parseInt(id),
                    option_text: text,
                    is_correct: isCorrect === '1',
                    order_index: parseInt(orderIndex)
                };
            }) : []
        }));

        res.json(formattedQuestions);
    });
});

// Create a new question
router.post('/', authenticateToken, (req, res) => {
    const { test_id, question_text, question_type, points, order_index, options } = req.body;

    db.run(`
        INSERT INTO questions (test_id, question_text, question_type, points, order_index)
        VALUES (?, ?, ?, ?, ?)
    `, [test_id, question_text, question_type, points, order_index], function(err) {
        if (err) {
            console.error('Error creating question:', err);
            return res.status(500).json({ error: 'Failed to create question' });
        }

        const questionId = this.lastID;

        // If it's a multiple choice question, insert the options
        if (question_type === 'multiple_choice' && options && options.length > 0) {
            const optionValues = options.map((opt, index) => 
                `(${questionId}, '${opt.option_text}', ${opt.is_correct ? 1 : 0}, ${index})`
            ).join(',');

            db.run(`
                INSERT INTO multiple_choice_options (question_id, option_text, is_correct, order_index)
                VALUES ${optionValues}
            `, (err) => {
                if (err) {
                    console.error('Error creating options:', err);
                    return res.status(500).json({ error: 'Failed to create question options' });
                }
                res.json({ id: questionId, message: 'Question created successfully' });
            });
        } else {
            res.json({ id: questionId, message: 'Question created successfully' });
        }
    });
});

// Update a question
router.put('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { question_text, points, options } = req.body;

    db.run(`
        UPDATE questions 
        SET question_text = ?, points = ?
        WHERE id = ?
    `, [question_text, points, id], (err) => {
        if (err) {
            console.error('Error updating question:', err);
            return res.status(500).json({ error: 'Failed to update question' });
        }

        // If it's a multiple choice question, update the options
        if (options && options.length > 0) {
            // First delete existing options
            db.run('DELETE FROM multiple_choice_options WHERE question_id = ?', [id], (err) => {
                if (err) {
                    console.error('Error deleting old options:', err);
                    return res.status(500).json({ error: 'Failed to update question options' });
                }

                // Then insert new options
                const optionValues = options.map((opt, index) => 
                    `(${id}, '${opt.option_text}', ${opt.is_correct ? 1 : 0}, ${index})`
                ).join(',');

                db.run(`
                    INSERT INTO multiple_choice_options (question_id, option_text, is_correct, order_index)
                    VALUES ${optionValues}
                `, (err) => {
                    if (err) {
                        console.error('Error creating new options:', err);
                        return res.status(500).json({ error: 'Failed to update question options' });
                    }
                    res.json({ message: 'Question updated successfully' });
                });
            });
        } else {
            res.json({ message: 'Question updated successfully' });
        }
    });
});

// Delete a question
router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM questions WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting question:', err);
            return res.status(500).json({ error: 'Failed to delete question' });
        }
        res.json({ message: 'Question deleted successfully' });
    });
});

// Reorder questions
router.post('/reorder', authenticateToken, (req, res) => {
    const { questions } = req.body; // Array of {id, order_index}

    const updates = questions.map(q => 
        db.run('UPDATE questions SET order_index = ? WHERE id = ?', [q.order_index, q.id])
    );

    Promise.all(updates)
        .then(() => res.json({ message: 'Questions reordered successfully' }))
        .catch(err => {
            console.error('Error reordering questions:', err);
            res.status(500).json({ error: 'Failed to reorder questions' });
        });
});

// Get all questions for the logged-in user (with test name and options)
router.get('/all', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    db.all(`
        SELECT q.*, t.name as test_name
        FROM questions q
        JOIN tests t ON q.test_id = t.id
        WHERE t.user_id = ?
        ORDER BY q.created_at DESC
    `, [req.session.userId], async (err, questions) => {
        if (err) {
            console.error('Error fetching all questions:', err);
            return res.status(500).json({ error: 'Failed to fetch questions' });
        }
        // For each question, get options if multiple_choice
        const withOptions = await Promise.all(questions.map(q => {
            return new Promise((resolve) => {
                if (q.question_type === 'multiple_choice') {
                    db.all('SELECT id, option_text, is_correct FROM multiple_choice_options WHERE question_id = ? ORDER BY order_index', [q.id], (err, options) => {
                        q.options = options || [];
                        resolve(q);
                    });
                } else {
                    q.options = [];
                    resolve(q);
                }
            });
        }));
        res.json(withOptions);
    });
});

module.exports = router; 