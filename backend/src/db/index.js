const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_FILE || path.join(os.tmpdir(), 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const schemaPath = path.join(__dirname, 'schema.sql');
        try {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            console.log('Schema file loaded successfully');

            db.serialize(() => {
                db.exec(schema, (err) => {
                    if (err) {
                        console.error('Error initializing database:', {
                            error: err.message,
                            code: err.code,
                            stack: err.stack,
                            timestamp: new Date().toISOString()
                        });
                        reject(err);
                        return;
                    }
                    console.log('Database initialized successfully at:', new Date().toISOString());
                    resolve();
                });
            });
        } catch (error) {
            console.error('Error reading schema file:', {
                error: error.message,
                path: schemaPath,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            reject(error);
        }
    });
}

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        console.log('Executing query:', {
            sql,
            params,
            timestamp: new Date().toISOString()
        });

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Query execution error:', {
                    error: err.message,
                    code: err.code,
                    sql,
                    params,
                    stack: err.stack,
                    timestamp: new Date().toISOString()
                });
                reject(err);
                return;
            }
            console.log('Query executed successfully:', {
                rowCount: rows.length,
                timestamp: new Date().toISOString()
            });
            resolve(rows);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        console.log('Executing run query:', {
            sql,
            params,
            timestamp: new Date().toISOString()
        });

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Run query execution error:', {
                    error: err.message,
                    code: err.code,
                    sql,
                    params,
                    stack: err.stack,
                    timestamp: new Date().toISOString()
                });
                reject(err);
                return;
            }
            console.log('Run query executed successfully:', {
                lastID: this.lastID,
                changes: this.changes,
                timestamp: new Date().toISOString()
            });
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

initializeDatabase().catch(error => {
    console.error('Database initialization failed:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
});

module.exports = {
    db,
    query,
    run,
    initializeDatabase
}; 