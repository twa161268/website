require('dotenv').config();

const { pool } = require('./db');

async function test() {
  try {
    console.log('TEST MASTER PRODUCT...');

    const products = await pool.query(`
      SELECT DISTINCT
        p.prdid,
        p.prdname,
        p.status,
        p.typeprd,
        p.prdgroup
      FROM master_prd p
      JOIN pricetab pt
        ON pt.prdid = p.prdid
      WHERE COALESCE(p.status, TRUE) = TRUE
      ORDER BY p.prdname NULLS LAST, p.prdid
      LIMIT 100
    `);

    console.log('Jumlah produk:', products.rows.length);
    console.table(products.rows);

    console.log('');
    console.log('TEST PRICECODE 2601...');

    const prices = await pool.query(
      `
      SELECT
        pt.prdid,
        pt.pricecode,
        pt.dp,
        pt.bv,
        pt.pin,
        p.prdname
      FROM pricetab pt
      LEFT JOIN master_prd p
        ON p.prdid = pt.prdid
      WHERE pt.pricecode = $1
      LIMIT 20
    `,
      ['2601']
    );

    console.log('Jumlah harga:', prices.rows.length);
    console.table(prices.rows);
  } catch (err) {
    console.error('TEST DATABASE GAGAL');
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
