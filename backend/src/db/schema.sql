-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    company_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    time_limit INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    test_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    status TEXT DEFAULT 'NOT TAKEN',
    start_time DATETIME,
    end_time DATETIME,
    score INTEGER,
    token TEXT UNIQUE NOT NULL,
    FOREIGN KEY (test_id) REFERENCES tests(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);

-- Multiple Choice Questions table
CREATE TABLE IF NOT EXISTS mc_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    test_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

-- Multiple Choice Options table
CREATE TABLE IF NOT EXISTS mc_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    is_correct BOOLEAN NOT NULL,
    mc_question_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    FOREIGN KEY (mc_question_id) REFERENCES mc_questions(id)
);

-- Freeform Questions table
CREATE TABLE IF NOT EXISTS freeform_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    test_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

-- Freeform Responses table
CREATE TABLE IF NOT EXISTS freeform_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    freeform_question_id INTEGER NOT NULL,
    assessment_id INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    FOREIGN KEY (freeform_question_id) REFERENCES freeform_questions(id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

-- Multiple Choice Responses table
CREATE TABLE IF NOT EXISTS mc_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    mc_option_id INTEGER NOT NULL,
    assessment_id INTEGER NOT NULL,
    FOREIGN KEY (mc_option_id) REFERENCES mc_options(id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
); 