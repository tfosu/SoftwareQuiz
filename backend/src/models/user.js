const { query, run } = require('../db');

class User {
    static async create({ email, password, company_name }) {
        try {
            console.log('Creating new user:', {
                email,
                company_name,
                timestamp: new Date().toISOString()
            });

            const result = await run(
                'INSERT INTO users (email, password, company_name) VALUES (?, ?, ?)',
                [email, password, company_name]
            );

            console.log('User created successfully:', {
                userId: result.id,
                timestamp: new Date().toISOString()
            });

            return result.id;
        } catch (error) {
            console.error('Error creating user:', {
                error: error.message,
                email,
                company_name,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            console.log('Finding user by email:', {
                email,
                timestamp: new Date().toISOString()
            });

            const users = await query('SELECT * FROM users WHERE email = ?', [email]);
            
            console.log('User lookup result:', {
                found: !!users[0],
                timestamp: new Date().toISOString()
            });

            return users[0];
        } catch (error) {
            console.error('Error finding user by email:', {
                error: error.message,
                email,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async findById(id) {
        try {
            console.log('Finding user by ID:', {
                userId: id,
                timestamp: new Date().toISOString()
            });

            const users = await query('SELECT * FROM users WHERE id = ?', [id]);
            
            console.log('User lookup result:', {
                found: !!users[0],
                timestamp: new Date().toISOString()
            });

            return users[0];
        } catch (error) {
            console.error('Error finding user by ID:', {
                error: error.message,
                userId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async update(id, { email, password, company_name }) {
        try {
            console.log('Updating user:', {
                userId: id,
                updates: { email, company_name },
                timestamp: new Date().toISOString()
            });

            const updates = [];
            const params = [];

            if (email !== undefined) {
                updates.push('email = ?');
                params.push(email);
            }
            if (password !== undefined) {
                updates.push('password = ?');
                params.push(password);
            }
            if (company_name !== undefined) {
                updates.push('company_name = ?');
                params.push(company_name);
            }

            if (updates.length === 0) {
                console.log('No updates provided for user:', {
                    userId: id,
                    timestamp: new Date().toISOString()
                });
                return null;
            }

            params.push(id);
            await run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            console.log('User updated successfully:', {
                userId: id,
                timestamp: new Date().toISOString()
            });

            return this.findById(id);
        } catch (error) {
            console.error('Error updating user:', {
                error: error.message,
                userId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    static async delete(id) {
        try {
            console.log('Deleting user:', {
                userId: id,
                timestamp: new Date().toISOString()
            });

            const result = await run('DELETE FROM users WHERE id = ?', [id]);

            console.log('User deleted successfully:', {
                userId: id,
                changes: result.changes,
                timestamp: new Date().toISOString()
            });

            return result;
        } catch (error) {
            console.error('Error deleting user:', {
                error: error.message,
                userId: id,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}

module.exports = User;
