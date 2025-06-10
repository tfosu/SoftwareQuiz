const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_FILE || path.join(os.tmpdir(), 'database.sqlite');

// Create a new database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
    }
});

module.exports = db;
