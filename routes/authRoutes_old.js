const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.get('/login', auth.showLogin); // dipanggil saat halaman login diminta (localhost:3000/login)
router.post('/login', auth.login); // saat tombol login diclick (isi usernam, password dan captcha dikirim ke server)
router.get('/logout', auth.logout);

module.exports = router;
