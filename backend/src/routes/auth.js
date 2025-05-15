// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();

// Signup route
router.post('/signup', async (req, res) => {
    const { companyName, email, password } = req.body;
    console.log('Signup attempt:', { companyName, email });
    try {
        // Check if email already exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error('Database error during signup:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            if (row) {
                console.log('Signup failed: Email already registered:', email);
                return res.status(400).json({ message: 'Email already registered' });
            }
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            // Insert new user
            db.run(
                'INSERT INTO users (company_name, email, password) VALUES (?, ?, ?)',
                [companyName, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Database error during user insertion:', err);
                        return res.status(500).json({ message: 'Internal server error' });
                    }
                    console.log('User created successfully:', { userId: this.lastID, email });
                    // Create session
                    req.session.userId = this.lastID;
                    req.session.companyName = companyName;
                    res.status(201).json({
                        message: 'Account created successfully',
                        userId: this.lastID
                    });
                }
            );
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (!user) {
            console.log('Login failed: Invalid credentials for email:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Login failed: Invalid password for email:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        console.log('User logged in successfully:', { userId: user.id, email });
        // Create session
        req.session.userId = user.id;
        req.session.companyName = user.company_name;
        res.json({
            message: 'Logged in successfully',
            userId: user.id,
            companyName: user.company_name
        });
    });
});

// Logout route
router.post('/logout', (req, res) => {
    console.log('Logout attempt for session:', req.session.id);
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Error logging out' });
        }
        console.log('User logged out successfully');
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        console.log('Get current user failed: Not authenticated');
        return res.status(401).json({ message: 'Not authenticated' });
    }
    console.log('Get current user attempt for userId:', req.session.userId);
    db.get('SELECT id, email, company_name FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error during get current user:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (!user) {
            console.log('Get current user failed: User not found for userId:', req.session.userId);
            return res.status(404).json({ message: 'User not found' });
        }
        console.log('Current user retrieved successfully:', { userId: user.id, email: user.email });
        res.json(user);
    });
});

module.exports = router;
