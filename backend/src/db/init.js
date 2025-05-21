const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        company_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, logResult('users'));

    db.run(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, logResult('candidates'));

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
    `, logResult('tests'));

    db.run(`
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT TAKEN', -- 'PASS', 'FAIL', 'NOT TAKEN', 'IN_PROGRESS'
        start_time DATETIME,
        end_time DATETIME,
        score INTEGER,
        token TEXT UNIQUE NOT NULL,
        FOREIGN KEY (test_id) REFERENCES tests(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
      )
    `, logResult('assessments'));

    db.run(`
      CREATE TABLE IF NOT EXISTS mc_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        points INTEGER DEFAULT 1,
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )
    `, logResult('mc_questions'));

    db.run(`
      CREATE TABLE IF NOT EXISTS mc_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_correct BOOLEAN NOT NULL,
        mc_question_id INTEGER NOT NULL,
        FOREIGN KEY (mc_question_id) REFERENCES mc_questions(id)
      )
    `, logResult('mc_options'));

    db.run(`
      CREATE TABLE IF NOT EXISTS freeform_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        points INTEGER DEFAULT 1,
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )
    `, logResult('freeform_questions'));

    db.run(`
      CREATE TABLE IF NOT EXISTS freeform_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        freeform_question_id INTEGER NOT NULL,
        assessment_id INTEGER NOT NULL,
        FOREIGN KEY (freeform_question_id) REFERENCES freeform_questions(id),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
      )
    `, logResult('freeform_responses'));

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
      } else {
        console.log('Database initialized and closed successfully');
        process.exit(0);
      }
    });
  });
}

function logResult(tableName) {
  return function (err) {
    if (err) {
      console.error(`Error creating table ${tableName}:`, err.message);
    } else {
      console.log(`Table '${tableName}' created or already exists.`);
    }
  };
}
