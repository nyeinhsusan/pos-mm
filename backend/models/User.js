const { pool } = require('../config/database');

class User {
  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} userId
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT user_id, email, full_name, role, created_at FROM users WHERE user_id = ?',
        [userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new user
   * @param {Object} userData - {email, password_hash, full_name, role}
   * @returns {Promise<number>} Inserted user_id
   */
  static async create(userData) {
    try {
      const { email, password_hash, full_name, role } = userData;
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [email, password_hash, full_name, role || 'cashier']
      );
      return result.insertId;
    } catch (error) {
      // Handle duplicate email error
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicateError = new Error('Email already exists');
        duplicateError.code = 'DUPLICATE_EMAIL';
        throw duplicateError;
      }
      throw error;
    }
  }

  /**
   * Get all users
   * @returns {Promise<Array>} Array of users (without password_hash)
   */
  static async findAll() {
    try {
      const [rows] = await pool.query(
        'SELECT user_id, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
