const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

const dbPath = process.env.DB_FILE || path.join(os.tmpdir(), 'database.sqlite');

console.log('Initializing database at:', dbPath);

if (fs.existsSync(dbPath)) {
    console.log('Deleting existing database...');
    fs.unlinkSync(dbPath);
}

// Create new database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error creating database:', err);
        process.exit(1);
    }
    console.log('Created new database at', dbPath);
    initializeDatabase();
});

function initializeDatabase() {
    db.serialize(() => {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                company_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, logResult('users'));

        // Create candidates table
        db.run(`
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, logResult('candidates'));

        // Create tests table
        db.run(`
            CREATE TABLE IF NOT EXISTS tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                instructions TEXT NOT NULL,
                time_limit INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, logResult('tests'));

        // Create assessments table
        db.run(`
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                candidate_id INTEGER NOT NULL,
                status TEXT DEFAULT 'NOT TAKEN',
                start_time DATETIME,
                end_time DATETIME,
                score INTEGER,
                token TEXT UNIQUE NOT NULL,
                FOREIGN KEY (test_id) REFERENCES tests(id),
                FOREIGN KEY (candidate_id) REFERENCES candidates(id)
            )
        `, logResult('assessments'));

        // Create mc_questions table
        db.run(`
            CREATE TABLE IF NOT EXISTS mc_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                points INTEGER DEFAULT 1,
                FOREIGN KEY (test_id) REFERENCES tests(id)
            )
        `, logResult('mc_questions'));

        // Create mc_options table
        db.run(`
            CREATE TABLE IF NOT EXISTS mc_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                is_correct BOOLEAN NOT NULL,
                mc_question_id INTEGER NOT NULL,
                option_text TEXT NOT NULL,
                FOREIGN KEY (mc_question_id) REFERENCES mc_questions(id)
            )
        `, logResult('mc_options'));

        // Create freeform_questions table
        db.run(`
            CREATE TABLE IF NOT EXISTS freeform_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                FOREIGN KEY (test_id) REFERENCES tests(id)
            )
        `, logResult('freeform_questions'));

        // Create freeform_responses table
        db.run(`
            CREATE TABLE IF NOT EXISTS freeform_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                freeform_question_id INTEGER NOT NULL,
                response_text TEXT NOT NULL,
                assessment_id INTEGER NOT NULL,
                FOREIGN KEY (freeform_question_id) REFERENCES freeform_questions(id),
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )
        `, logResult('freeform_responses'));

        // Create mc_responses table
        db.run(`
            CREATE TABLE IF NOT EXISTS mc_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mc_option_id INTEGER NOT NULL,
                assessment_id INTEGER NOT NULL,
                FOREIGN KEY (mc_option_id) REFERENCES mc_options(id),
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )
        `, logResult('mc_responses'));

        // Close the database after all tables are created
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                process.exit(1);
            }
            console.log('Database initialized successfully');
            process.exit(0);
        });
    });
}

function logResult(tableName) {
    return function (err) {
        if (err) {
            console.error(`Error creating table ${tableName}:`, err.message);
        } else {
            console.log(`Table '${tableName}' created successfully.`);
        }
    };
}
