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
        description TEXT,
        time_limit INTEGER NOT NULL, -- in minutes
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, logResult('tests'));

    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL, -- 'multiple_choice' or 'freeform'
        points INTEGER NOT NULL DEFAULT 1,
        order_index INTEGER NOT NULL, -- to maintain question order
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
      )
    `, logResult('questions'));

    db.run(`
      CREATE TABLE IF NOT EXISTS multiple_choice_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        option_text TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL, -- to maintain option order
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    `, logResult('multiple_choice_options'));

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
      CREATE TABLE IF NOT EXISTS candidate_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        answer_text TEXT,
        selected_option_id INTEGER,
        is_correct BOOLEAN,
        points_earned INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id),
        FOREIGN KEY (selected_option_id) REFERENCES multiple_choice_options(id)
      )
    `, logResult('candidate_answers'));

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
