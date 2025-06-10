// src/index.js
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const os = require('os');
const path = require('path');
const cors = require('cors');

// Routers
const inviteRouter = require('./routes/invite');
const authRouter = require('./routes/auth');
const quizRouter = require('./routes/quizzes');
const testsRouter = require('./routes/tests');
const candidatesRouter = require('./routes/candidates');
const questionsRouter = require('./routes/questions');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

//── CORS ───────────────────────────────────────────────────────────────
// Allow your frontend origin and include credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

//── STATIC FRONTEND ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));

//── SESSION ───────────────────────────────────────────────────────────
const sessionPath = path.join(os.tmpdir(), 'sessions.sqlite');
console.log('Session DB path:', sessionPath);

app.use(session({
  store: new SQLiteStore({
    db: path.basename(sessionPath),
    dir: path.dirname(sessionPath)
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,                         // Set to false for debugging on Render
    httpOnly: true,
    sameSite: 'lax',                       // Use 'lax' for same-origin requests
    maxAge: 1000 * 60 * 60 * 24            // 24 hours
  }
}));

//── ROUTES ────────────────────────────────────────────────────────────
// Auth
app.use('/api/auth', authRouter);

// API
app.use('/api/quizzes', quizRouter);
app.use('/api/tests', testsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/invite', inviteRouter);

//── FRONTEND FALLBACKS ─────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, '../../frontend/index.html'))
);

//── PROTECTED ENDPOINT EXAMPLE ─────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
}

// Example protected route
app.use('/invite', requireAuth, inviteRouter);

//── ERROR HANDLER ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

//── SERVER START ──────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
