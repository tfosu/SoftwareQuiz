const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create a new database connection
const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create users table (employers)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            company_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create candidates table
    db.run(`
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create tests table (new structure)
    db.run(`
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            instructions TEXT NOT NULL,
            time_limit INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating tests table:', err);
        } else {
            console.log('Table tests created or already exists.');
        }
    });

    // Create assessments table
    db.run(`
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            candidate_id INTEGER NOT NULL,
            status TEXT DEFAULT 'NOT TAKEN', -- 'PASS', 'FAIL', 'NOT TAKEN'
            start_time DATETIME,
            end_time DATETIME,
            score INTEGER,
            token TEXT UNIQUE NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests(id),
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        )
    `);

    // Create mc_questions table
    db.run(`
        CREATE TABLE IF NOT EXISTS mc_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            points INTEGER DEFAULT 1,
            FOREIGN KEY (test_id) REFERENCES tests(id)
        )
    `);

    // Create mc_options table
    db.run(`
        CREATE TABLE IF NOT EXISTS mc_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            is_correct BOOLEAN NOT NULL,
            mc_question_id INTEGER NOT NULL,
            FOREIGN KEY (mc_question_id) REFERENCES mc_questions(id)
        )
    `);

    // Create freeform_questions table
    db.run(`
        CREATE TABLE IF NOT EXISTS freeform_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            points INTEGER DEFAULT 1,
            FOREIGN KEY (test_id) REFERENCES tests(id)
        )
    `);

    // Create freeform_responses table
    db.run(`
        CREATE TABLE IF NOT EXISTS freeform_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            freeform_question_id INTEGER NOT NULL,
            assessment_id INTEGER NOT NULL,
            FOREIGN KEY (freeform_question_id) REFERENCES freeform_questions(id),
            FOREIGN KEY (assessment_id) REFERENCES assessments(id)
        )
    `);

    // Create mc_responses table
    db.run(`
        CREATE TABLE IF NOT EXISTS mc_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mc_option_id INTEGER NOT NULL,
            assessment_id INTEGER NOT NULL,
            FOREIGN KEY (mc_option_id) REFERENCES mc_options(id),
            FOREIGN KEY (assessment_id) REFERENCES assessments(id)
        )
    `);
}

module.exports = db;
