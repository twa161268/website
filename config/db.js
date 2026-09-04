/*
const { Pool } = require('pg');

const sslEnabled =
  String(process.env.DB_SSL || 'true').toLowerCase() === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('PostgreSQL pool error:', err));

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

module.exports = { pool, query };
*/

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

module.exports = { pool, query };
