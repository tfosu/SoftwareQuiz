const { query, run } = require('../db');

class Candidate {
    static async create({ name, email }) {
        try {
            console.log('Creating new candidate:', {
                name,
                email,
                timestamp: new Date().toISOString()
            });

            const result = await run(
                'INSERT INTO candidates (name, email) VALUES (?, ?)',
                [name, email]
            );

            console.log('Candidate created successfully:', {
                candidateId: result.id,
                timestamp: new Date().toISOString()
            });

            return result.id;
        } catch (error) {
            console.error('Error creating candidate:', {
                error: error.message,
                name,
                email,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findById(id) {
        try {
            console.log('Finding candidate by ID:', {
                candidateId: id,
                timestamp: new Date().toISOString()
            });

            const candidates = await query('SELECT * FROM candidates WHERE id = ?', [id]);
            
            console.log('Candidate lookup result:', {
                found: !!candidates[0],
                timestamp: new Date().toISOString()
            });

            return candidates[0];
        } catch (error) {
            console.error('Error finding candidate by ID:', {
                error: error.message,
                candidateId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            console.log('Finding candidate by email:', {
                email,
                timestamp: new Date().toISOString()
            });

            const candidates = await query('SELECT * FROM candidates WHERE email = ?', [email]);
            
            console.log('Candidate lookup result:', {
                found: !!candidates[0],
                timestamp: new Date().toISOString()
            });

            return candidates[0];
        } catch (error) {
            console.error('Error finding candidate by email:', {
                error: error.message,
                email,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async update(id, { name, email }) {
        try {
            console.log('Updating candidate:', {
                candidateId: id,
                updates: { name, email },
                timestamp: new Date().toISOString()
            });

            const updates = [];
            const params = [];

            if (name !== undefined) {
                updates.push('name = ?');
                params.push(name);
            }
            if (email !== undefined) {
                updates.push('email = ?');
                params.push(email);
            }

            if (updates.length === 0) {
                console.log('No updates provided for candidate:', {
                    candidateId: id,
                    timestamp: new Date().toISOString()
                });
                return null;
            }

            params.push(id);
            await run(
                `UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            console.log('Candidate updated successfully:', {
                candidateId: id,
                timestamp: new Date().toISOString()
            });

            return this.findById(id);
        } catch (error) {
            console.error('Error updating candidate:', {
                error: error.message,
                candidateId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async delete(id) {
        try {
            console.log('Deleting candidate:', {
                candidateId: id,
                timestamp: new Date().toISOString()
            });

            const result = await run('DELETE FROM candidates WHERE id = ?', [id]);

            console.log('Candidate deleted successfully:', {
                candidateId: id,
                changes: result.changes,
                timestamp: new Date().toISOString()
            });

            return result;
        } catch (error) {
            console.error('Error deleting candidate:', {
                error: error.message,
                candidateId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async getAssessments(candidate_id) {
        try {
            console.log('Getting candidate assessments:', {
                candidateId: candidate_id,
                timestamp: new Date().toISOString()
            });

            const assessments = await query(
                `SELECT a.*, t.name as test_name, t.instructions
                 FROM assessments a
                 JOIN tests t ON a.test_id = t.id
                 WHERE a.candidate_id = ?
                 ORDER BY a.created_at DESC`,
                [candidate_id]
            );

            console.log('Assessments retrieved successfully:', {
                candidateId: candidate_id,
                count: assessments.length,
                timestamp: new Date().toISOString()
            });

            return assessments;
        } catch (error) {
            console.error('Error getting candidate assessments:', {
                error: error.message,
                candidateId: candidate_id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

module.exports = Candidate; 