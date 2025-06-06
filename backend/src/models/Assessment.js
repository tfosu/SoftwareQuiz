const { query, run } = require('../db');
const crypto = require('crypto');

class Assessment {
    static async create({ test_id, candidate_id }) {
        try {
            console.log('Creating new assessment:', {
                testId: test_id,
                candidateId: candidate_id,
                timestamp: new Date().toISOString()
            });

            const token = crypto.randomBytes(32).toString('hex');
            const result = await run(
                'INSERT INTO assessments (test_id, candidate_id, token) VALUES (?, ?, ?)',
                [test_id, candidate_id, token]
            );

            console.log('Assessment created successfully:', {
                assessmentId: result.id,
                token,
                timestamp: new Date().toISOString()
            });

            return { id: result.id, token };
        } catch (error) {
            console.error('Error creating assessment:', {
                error: error.message,
                testId: test_id,
                candidateId: candidate_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findByToken(token) {
        try {
            console.log('Finding assessment by token:', {
                token,
                timestamp: new Date().toISOString()
            });

            const assessments = await query(
                `SELECT a.*, t.name as test_name, t.instructions, t.time_limit,
                        c.name as candidate_name, c.email as candidate_email
                 FROM assessments a
                 JOIN tests t ON a.test_id = t.id
                 JOIN candidates c ON a.candidate_id = c.id
                 WHERE a.token = ?`,
                [token]
            );

            console.log('Assessment lookup result:', {
                found: !!assessments[0],
                timestamp: new Date().toISOString()
            });

            return assessments[0];
        } catch (error) {
            console.error('Error finding assessment by token:', {
                error: error.message,
                token,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async start(token) {
        try {
            console.log('Starting assessment:', {
                token,
                timestamp: new Date().toISOString()
            });

            const now = new Date().toISOString();
            await run(
                'UPDATE assessments SET status = ?, start_time = ? WHERE token = ?',
                ['IN_PROGRESS', now, token]
            );

            console.log('Assessment started successfully:', {
                token,
                startTime: now,
                timestamp: new Date().toISOString()
            });

            return this.findByToken(token);
        } catch (error) {
            console.error('Error starting assessment:', {
                error: error.message,
                token,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async submit(token, { mc_responses, freeform_responses }) {
        try {
            console.log('Submitting assessment:', {
                token,
                mcResponsesCount: mc_responses.length,
                freeformResponsesCount: freeform_responses.length,
                timestamp: new Date().toISOString()
            });

            const now = new Date().toISOString();
            
            // Start transaction
            await run('BEGIN TRANSACTION');
            
            try {
                // Update assessment status
                await run(
                    'UPDATE assessments SET status = ?, end_time = ? WHERE token = ?',
                    ['COMPLETED', now, token]
                );

                // Get assessment ID
                const assessment = await this.findByToken(token);
                
                // Save MC responses
                for (const response of mc_responses) {
                    await run(
                        'INSERT INTO mc_responses (assessment_id, mc_option_id) VALUES (?, ?)',
                        [assessment.id, response.option_id]
                    );
                }

                // Save freeform responses
                for (const response of freeform_responses) {
                    await run(
                        'INSERT INTO freeform_responses (assessment_id, freeform_question_id, response_text) VALUES (?, ?, ?)',
                        [assessment.id, response.question_id, response.text]
                    );
                }

                // Calculate score
                const score = await this.calculateScore(assessment.id);
                await run(
                    'UPDATE assessments SET score = ? WHERE id = ?',
                    [score, assessment.id]
                );

                await run('COMMIT');

                console.log('Assessment submitted successfully:', {
                    token,
                    assessmentId: assessment.id,
                    score,
                    endTime: now,
                    timestamp: new Date().toISOString()
                });

                return this.findByToken(token);
            } catch (error) {
                await run('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error submitting assessment:', {
                error: error.message,
                token,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async calculateScore(assessment_id) {
        try {
            console.log('Calculating assessment score:', {
                assessmentId: assessment_id,
                timestamp: new Date().toISOString()
            });

            const mc_score = await query(
                `SELECT SUM(q.points) as score
                 FROM mc_responses r
                 JOIN mc_options o ON r.mc_option_id = o.id
                 JOIN mc_questions q ON o.mc_question_id = q.id
                 WHERE r.assessment_id = ? AND o.is_correct = 1`,
                [assessment_id]
            );

            const score = mc_score[0].score || 0;

            console.log('Score calculated successfully:', {
                assessmentId: assessment_id,
                score,
                timestamp: new Date().toISOString()
            });

            return score;
        } catch (error) {
            console.error('Error calculating assessment score:', {
                error: error.message,
                assessmentId: assessment_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async getResponses(assessment_id) {
        try {
            console.log('Getting assessment responses:', {
                assessmentId: assessment_id,
                timestamp: new Date().toISOString()
            });

            const mc_responses = await query(
                `SELECT r.*, o.option_text, o.is_correct, q.question_text, q.points
                 FROM mc_responses r
                 JOIN mc_options o ON r.mc_option_id = o.id
                 JOIN mc_questions q ON o.mc_question_id = q.id
                 WHERE r.assessment_id = ?`,
                [assessment_id]
            );

            const freeform_responses = await query(
                `SELECT r.*, q.question_text, q.points
                 FROM freeform_responses r
                 JOIN freeform_questions q ON r.freeform_question_id = q.id
                 WHERE r.assessment_id = ?`,
                [assessment_id]
            );

            console.log('Responses retrieved successfully:', {
                assessmentId: assessment_id,
                mcResponsesCount: mc_responses.length,
                freeformResponsesCount: freeform_responses.length,
                timestamp: new Date().toISOString()
            });

            return { mc_responses, freeform_responses };
        } catch (error) {
            console.error('Error getting assessment responses:', {
                error: error.message,
                assessmentId: assessment_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

module.exports = Assessment; 