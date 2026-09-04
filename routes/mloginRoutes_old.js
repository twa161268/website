// routes/karyawanRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mloginController');
const c = require('../controllers/mloginController');
const { isAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authMiddleware');

router.use(isAuth);
router.use(requireRole('admin'));

router.get('/load', c.loadDatak);

router.post('/create', c.create);
router.post('/update', c.update);
router.post('/delete', c.remove);
router.get('/', c.getAll);
router.get('/load/:idk', c.loadDatabyidk);
//router.get("/:idk", ctrl.getByIdk);

module.exports = router;
