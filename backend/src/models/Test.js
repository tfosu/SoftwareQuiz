const { query, run } = require('../db');

class Test {
    static async create({ user_id, name, instructions, time_limit }) {
        try {
            console.log('Creating new test:', {
                userId: user_id,
                name,
                timeLimit: time_limit,
                timestamp: new Date().toISOString()
            });

            const result = await run(
                'INSERT INTO tests (user_id, name, instructions, time_limit) VALUES (?, ?, ?, ?)',
                [user_id, name, instructions, time_limit]
            );

            console.log('Test created successfully:', {
                testId: result.id,
                timestamp: new Date().toISOString()
            });

            return result.id;
        } catch (error) {
            console.error('Error creating test:', {
                error: error.message,
                userId: user_id,
                name,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findById(id) {
        try {
            console.log('Finding test by ID:', {
                testId: id,
                timestamp: new Date().toISOString()
            });

            const tests = await query('SELECT * FROM tests WHERE id = ?', [id]);
            
            console.log('Test lookup result:', {
                found: !!tests[0],
                timestamp: new Date().toISOString()
            });

            return tests[0];
        } catch (error) {
            console.error('Error finding test by ID:', {
                error: error.message,
                testId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findByUserId(user_id) {
        try {
            console.log('Finding tests by user ID:', {
                userId: user_id,
                timestamp: new Date().toISOString()
            });

            const tests = await query('SELECT * FROM tests WHERE user_id = ?', [user_id]);
            
            console.log('Tests lookup result:', {
                count: tests.length,
                timestamp: new Date().toISOString()
            });

            return tests;
        } catch (error) {
            console.error('Error finding tests by user ID:', {
                error: error.message,
                userId: user_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async update(id, { name, instructions, time_limit }) {
        try {
            console.log('Updating test:', {
                testId: id,
                updates: { name, time_limit },
                timestamp: new Date().toISOString()
            });

            const updates = [];
            const params = [];

            if (name !== undefined) {
                updates.push('name = ?');
                params.push(name);
            }
            if (instructions !== undefined) {
                updates.push('instructions = ?');
                params.push(instructions);
            }
            if (time_limit !== undefined) {
                updates.push('time_limit = ?');
                params.push(time_limit);
            }

            if (updates.length === 0) {
                console.log('No updates provided for test:', {
                    testId: id,
                    timestamp: new Date().toISOString()
                });
                return null;
            }

            params.push(id);
            await run(
                `UPDATE tests SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            console.log('Test updated successfully:', {
                testId: id,
                timestamp: new Date().toISOString()
            });

            return this.findById(id);
        } catch (error) {
            console.error('Error updating test:', {
                error: error.message,
                testId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async delete(id) {
        try {
            console.log('Deleting test:', {
                testId: id,
                timestamp: new Date().toISOString()
            });

            const result = await run('DELETE FROM tests WHERE id = ?', [id]);

            console.log('Test deleted successfully:', {
                testId: id,
                changes: result.changes,
                timestamp: new Date().toISOString()
            });

            return result;
        } catch (error) {
            console.error('Error deleting test:', {
                error: error.message,
                testId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    // Question management
    static async addMCQuestion(test_id, { question_text, points, options }) {
        try {
            console.log('Adding MC question to test:', {
                testId: test_id,
                points,
                optionsCount: options.length,
                timestamp: new Date().toISOString()
            });

            const result = await run(
                'INSERT INTO mc_questions (test_id, question_text, points) VALUES (?, ?, ?)',
                [test_id, question_text, points]
            );
            const question_id = result.id;

            for (const option of options) {
                await run(
                    'INSERT INTO mc_options (mc_question_id, option_text, is_correct) VALUES (?, ?, ?)',
                    [question_id, option.text, option.is_correct]
                );
            }

            console.log('MC question added successfully:', {
                testId: test_id,
                questionId: question_id,
                timestamp: new Date().toISOString()
            });

            return question_id;
        } catch (error) {
            console.error('Error adding MC question:', {
                error: error.message,
                testId: test_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async addFreeformQuestion(test_id, { question_text, points }) {
        try {
            console.log('Adding freeform question to test:', {
                testId: test_id,
                points,
                timestamp: new Date().toISOString()
            });

            const result = await run(
                'INSERT INTO freeform_questions (test_id, question_text, points) VALUES (?, ?, ?)',
                [test_id, question_text, points]
            );

            console.log('Freeform question added successfully:', {
                testId: test_id,
                questionId: result.id,
                timestamp: new Date().toISOString()
            });

            return result.id;
        } catch (error) {
            console.error('Error adding freeform question:', {
                error: error.message,
                testId: test_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async getQuestions(test_id) {
        try {
            console.log('Getting questions for test:', {
                testId: test_id,
                timestamp: new Date().toISOString()
            });

            const mc_questions = await query(
                `SELECT q.*, GROUP_CONCAT(o.id || ':' || o.option_text || ':' || o.is_correct) as options
                 FROM mc_questions q
                 LEFT JOIN mc_options o ON q.id = o.mc_question_id
                 WHERE q.test_id = ?
                 GROUP BY q.id`,
                [test_id]
            );

            const freeform_questions = await query(
                'SELECT * FROM freeform_questions WHERE test_id = ?',
                [test_id]
            );

            console.log('Questions retrieved successfully:', {
                testId: test_id,
                mcQuestionsCount: mc_questions.length,
                freeformQuestionsCount: freeform_questions.length,
                timestamp: new Date().toISOString()
            });

            return {
                mc_questions: mc_questions.map(q => ({
                    ...q,
                    options: q.options ? q.options.split(',').map(opt => {
                        const [id, text, is_correct] = opt.split(':');
                        return { id, text, is_correct: is_correct === '1' };
                    }) : []
                })),
                freeform_questions
            };
        } catch (error) {
            console.error('Error getting questions:', {
                error: error.message,
                testId: test_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

module.exports = Test; 