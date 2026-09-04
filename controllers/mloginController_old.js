// controllers/karyawanController.js
const db = require('../db');
const bcrypt = require('bcrypt');

exports.getByIdk = async (req, res) => {
  try {
    const { idk } = req.params;

    const sql = `
      SELECT *
      FROM users
      WHERE id = '${idk}';
    `;

    const rows = await db.query(sql);
    res.json(rows.length ? rows[0] : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.loadDatabyidk = async (req, res) => {
  const idk = req.params.idk; //params idk disini maksudnya ini dari route yg ada :idk nya

  const sql = `
    SELECT *
    FROM users
    WHERE user_id = $1
`;

  try {
    const rows = await db.query(sql, [idk]);

    res.json({
      success: true,
      data: rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};

exports.loadDatak = async (req, res) => {
  const sql = `
    SELECT  user_id, username, stkid, password_hash, full_name, role, is_active, created_at,created_by, updated_at, updated_by
    FROM users
    ORDER BY username
    `;
  try {
    //const rows = await db.query(sql);
    const rows = await db.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false });
  }
};

// READ
exports.getAll = async (req, res) => {
  const result = await db.query('SELECT * FROM USERS ORDER BY username');
  res.render('mlogin', { data: result.rows });
};

// CREATE
exports.create = async (req, res) => {
  try {
    const { usernm, userpassword, stkid, namafull, userrole, useractive } =
      req.body;
    console.log(usernm, userpassword, namafull, userrole, useractive);
    const cek = await db.query('SELECT 1 FROM users WHERE username = $1', [
      usernm,
    ]);

    if (cek.length > 0) {
      return res.json({ success: false, msg: 'Username sudah ada!' });
    }

    if (!usernm || !userpassword) {
      return res.json({ success: false, msg: 'Username & password wajib!' });
    }

    const userpass = await bcrypt.hash(userpassword, 10);
    console.log(usernm, userpass, namafull, userrole, useractive);
    await db.query(
      'INSERT INTO users (username, password_hash, full_name, stkid, role,is_active, created_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,now(),$7)',
      [
        usernm,
        userpass,
        namafull,
        stkid,
        userrole,
        useractive,
        req.session.user,
      ]
    );

    //res.sendStatus(200);
    res.json({ success: true, msg: 'Insert berhasil!' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, msg: 'Insert error!' });
  }
};

// UPDATE
exports.update = async (req, res) => {
  try {
    const d = req.body;

    if (!d.userid) {
      return res.json({ success: false, msg: 'ID wajib ada!' });
    }

    // ❗ penting: jangan ikutkan field WHERE ke data update

    const dataUpdate = {
      username: d.usernm,
      full_name: d.namafull,
      stkid: d.stkid,
      role: d.userrole,
      is_active: d.useractive,
    };

    await updateByKeys('users', dataUpdate, { user_id: d.userid }, db);

    res.json({ success: true, msg: 'Update berhasil!' });
  } catch (e) {
    console.error(e);
    res.json({ success: false, msg: 'Server error!' });
  }
};

const updateByKeys = async (table, data, where, db) => {
  // ambil field dari data
  const fields = Object.keys(data); //ambil nama fieldnya aja

  // bikin SET clause
  const setClause = fields.map((f, i) => `${f}=$${i + 1}`).join(', ');

  // bikin WHERE clause
  const whereKeys = Object.keys(where);
  const whereClause = whereKeys
    .map((f, i) => `${f}=$${fields.length + i + 1}`)
    .join(' AND ');

  // gabung jadi SQL
  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
  `;

  console.log(sql);
  // values untuk SET
  const values = fields.map((f) => data[f] ?? null);

  // values untuk WHERE
  const whereValues = whereKeys.map((f) => where[f]);

  const finalValues = [...values, ...whereValues];

  // debug (optional)
  //console.log(sql);
  //console.log(finalValues.length, "params");

  return db.query(sql, finalValues);
};

exports.remove = async (req, res) => {
  try {
    const items = req.body.items;
    if (!items || items.length === 0) {
      return res.json({ success: false, msg: 'Tidak ada data!' });
    }

    let successCount = 0;
    let failCount = 0;

    for (let row of items) {
      console.log('Formatted idk for deletion:', row.user_id); // Debug: pastikan format periode benar

      // di zperiode tidak dikasih tanda kutip
      const sql = `
                DELETE FROM users
                WHERE user_id=$1
            `;

      try {
        await db.query(sql, [row.user_id]);
        successCount++;
      } catch (err) {
        console.log('Delete error:', err);
        failCount++;
      }
    }

    return res.json({
      success: true,
      deleted: successCount,
      failed: failCount,
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, msg: 'Server error!' });
  }
};
