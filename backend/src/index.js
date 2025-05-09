// src/index.js
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const cors = require('cors');

const inviteRouter = require('./routes/invite');
const authRouter = require('./routes/auth');
const quizRouter = require('./routes/quizzes');
const testsRouter = require('./routes/tests');
const candidatesRouter = require('./routes/candidates');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './db'
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/quizzes', quizRouter);
app.use('/api/tests', testsRouter);
app.use('/api/candidates', candidatesRouter);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// 3) Authentication routes (signup, login, logout, status)
app.use('/auth', authRouter);

// 4) Smart homepage: if logged in → dashboard, else → login
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/tests.html');
  }
  return res.redirect('/login.html');
});

// 5) Protect-only-for-employers middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
}

// 6) Protected invite endpoint (only employers)
app.use('/invite', requireAuth, inviteRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// 9) Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
