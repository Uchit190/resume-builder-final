const mysql = require('mysql2/promise');

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];

requiredEnvVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  namedPlaceholders: true,
  timezone: 'Z',
});

async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function pingDatabase() {
  await query('SELECT 1 AS ok');
}

module.exports = {
  pingDatabase,
  pool,
  query,
};
