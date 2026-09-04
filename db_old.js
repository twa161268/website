
// mulai dari sini
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL2,

  ssl: {
    rejectUnauthorized: false,
  },

  // Batasi koneksi agar tidak menghabiskan
  // connection pool Supabase
  max: 5,

  // Jangan terlalu lama menunggu koneksi idle
  idleTimeoutMillis: 30000,

  // Batasi waktu menunggu koneksi
  connectionTimeoutMillis: 10000,
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = {
  query,
  pool,
};
