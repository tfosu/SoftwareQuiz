const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    next();
}

// Get all tests for the logged-in user
router.get('/', requireAuth, (req, res) => {
    console.log('Fetching all tests for userId:', req.session.userId);
    db.all(
        'SELECT * FROM tests WHERE user_id = ? ORDER BY created_at DESC',
        [req.session.userId],
        (err, tests) => {
            if (err) {
                console.error('DB error on test list:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            console.log('Tests fetched successfully:', { count: tests.length });
            res.json(tests);
        }
    );
});

// Get a single test
router.get('/:id', requireAuth, (req, res) => {
    const testId = req.params.id;
    console.log('Fetching test:', { testId, userId: req.session.userId });
    db.get(
        'SELECT * FROM tests WHERE id = ? AND user_id = ?',
        [testId, req.session.userId],
        (err, test) => {
            if (err) {
                console.error('DB error on test fetch:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            if (!test) {
                console.log('Test not found (404):', { testId, userId: req.session.userId, params: req.params, query: req.query, body: req.body });
                return res.status(404).json({ message: 'Test not found', testId, userId: req.session.userId });
            }
            console.log('Test fetched successfully:', { testId });
            res.json(test);
        }
    );
});

// Create a new test
router.post('/', requireAuth, (req, res) => {
    const { name, instructions, time_limit } = req.body;
    console.log('Creating test:', { name, instructions, time_limit, userId: req.session.userId, body: req.body });
    if (!name || !instructions || !time_limit) {
        console.log('Create test failed: Missing required fields', req.body);
        return res.status(400).json({ message: 'Missing required fields', body: req.body });
    }
    db.run(
        'INSERT INTO tests (user_id, name, instructions, time_limit) VALUES (?, ?, ?, ?)',
        [req.session.userId, name, instructions, time_limit],
        function (err) {
            if (err) {
                console.error('DB error on test creation:', err, 'Request body:', req.body);
                return res.status(500).json({ message: 'Database error on test creation', error: err.message, body: req.body });
            }
            console.log('Test created successfully:', { testId: this.lastID });
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Update a test
router.put('/:id', requireAuth, (req, res) => {
    const testId = req.params.id;
    const { name, instructions, time_limit } = req.body;
    console.log('Updating test:', { testId, name, instructions, time_limit, userId: req.session.userId, body: req.body });
    if (!name || !instructions || !time_limit) {
        console.log('Update test failed: Missing required fields', req.body);
        return res.status(400).json({ message: 'Missing required fields', body: req.body });
    }
    db.run(
        'UPDATE tests SET name = ?, instructions = ?, time_limit = ? WHERE id = ? AND user_id = ?',
        [name, instructions, time_limit, testId, req.session.userId],
        function (err) {
            if (err) {
                console.error('DB error on test update:', err, 'Request body:', req.body);
                return res.status(500).json({ message: 'Database error on test update', error: err.message, body: req.body });
            }
            if (this.changes === 0) {
                console.log('Test not found for update (404):', { testId, userId: req.session.userId, params: req.params, query: req.query, body: req.body });
                return res.status(404).json({ message: 'Test not found', testId, userId: req.session.userId });
            }
            console.log('Test updated successfully:', { testId });
            res.json({ message: 'Test updated' });
        }
    );
});

// Delete a test
router.delete('/:id', requireAuth, async (req, res) => {
    const testId = req.params.id;
    console.log('Deleting test:', { testId, userId: req.session.userId });
    
    try {
        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Delete in order of dependencies:
            // 1. Delete MC responses (through assessments)
            db.run(`
                DELETE FROM mc_responses 
                WHERE assessment_id IN (
                    SELECT id FROM assessments WHERE test_id = ?
                )
            `, [testId]);
            
            // 2. Delete freeform responses (through assessments)
            db.run(`
                DELETE FROM freeform_responses 
                WHERE assessment_id IN (
                    SELECT id FROM assessments WHERE test_id = ?
                )
            `, [testId]);
            
            // 3. Delete assessments
            db.run('DELETE FROM assessments WHERE test_id = ?', [testId]);
            
            // 4. Delete MC options (through questions)
            db.run(`
                DELETE FROM mc_options 
                WHERE mc_question_id IN (
                    SELECT id FROM mc_questions WHERE test_id = ?
                )
            `, [testId]);
            
            // 5. Delete MC questions
            db.run('DELETE FROM mc_questions WHERE test_id = ?', [testId]);
            
            // 6. Delete freeform questions
            db.run('DELETE FROM freeform_questions WHERE test_id = ?', [testId]);
            
            // 7. Finally, delete the test
            db.run('DELETE FROM tests WHERE id = ? AND user_id = ?', [testId, req.session.userId], function(err) {
                if (err) {
                    console.error('DB error on test deletion:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Database error' });
                }
                if (this.changes === 0) {
                    console.log('Test not found for deletion:', { testId, userId: req.session.userId });
                    db.run('ROLLBACK');
                    return res.status(404).json({ message: 'Test not found' });
                }
                db.run('COMMIT');
                console.log('Test and all related data deleted successfully:', { testId });
                res.json({ message: 'Test and all related data deleted successfully' });
            });
        });
    } catch (error) {
        console.error('Error in test deletion:', error);
        db.run('ROLLBACK');
        res.status(500).json({ message: 'Database error' });
    }
});

module.exports = router; 