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
                console.log('Test not found:', { testId, userId: req.session.userId });
                return res.status(404).json({ message: 'Test not found' });
            }
            console.log('Test fetched successfully:', { testId });
            res.json(test);
        }
    );
});

// Create a new test
router.post('/', requireAuth, (req, res) => {
    const { name, instructions, time_limit, tests_code } = req.body;
    console.log('Creating test:', { name, userId: req.session.userId });
    if (!name || !instructions || !time_limit || !tests_code) {
        console.log('Create test failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
    }
    db.run(
        'INSERT INTO tests (user_id, name, instructions, time_limit, tests_code) VALUES (?, ?, ?, ?, ?)',
        [req.session.userId, name, instructions, time_limit, tests_code],
        function (err) {
            if (err) {
                console.error('DB error on test creation:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            console.log('Test created successfully:', { testId: this.lastID });
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Update a test
router.put('/:id', requireAuth, (req, res) => {
    const testId = req.params.id;
    const { name, instructions, time_limit, tests_code } = req.body;
    console.log('Updating test:', { testId, userId: req.session.userId });
    if (!name || !instructions || !time_limit || !tests_code) {
        console.log('Update test failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
    }
    db.run(
        'UPDATE tests SET name = ?, instructions = ?, time_limit = ?, tests_code = ? WHERE id = ? AND user_id = ?',
        [name, instructions, time_limit, tests_code, testId, req.session.userId],
        function (err) {
            if (err) {
                console.error('DB error on test update:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            if (this.changes === 0) {
                console.log('Test not found for update:', { testId, userId: req.session.userId });
                return res.status(404).json({ message: 'Test not found' });
            }
            console.log('Test updated successfully:', { testId });
            res.json({ message: 'Test updated' });
        }
    );
});

// Delete a test
router.delete('/:id', requireAuth, (req, res) => {
    const testId = req.params.id;
    console.log('Deleting test:', { testId, userId: req.session.userId });
    db.run('DELETE FROM tests WHERE id = ? AND user_id = ?', [testId, req.session.userId], function (err) {
        if (err) {
            console.error('DB error on test deletion:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        if (this.changes === 0) {
            console.log('Test not found for deletion:', { testId, userId: req.session.userId });
            return res.status(404).json({ message: 'Test not found' });
        }
        console.log('Test deleted successfully:', { testId });
        res.json({ message: 'Test deleted' });
    });
});

module.exports = router; 