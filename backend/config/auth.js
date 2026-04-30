require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'default_secret_key_change_in_production',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  bcryptRounds: 10
};
