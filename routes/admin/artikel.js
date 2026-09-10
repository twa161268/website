const express = require('express');
const multer = require('multer');

const { requireLogin } = require('../../middleware/auth');
const c = require('../../controllers/admin/artikelController');

const router = express.Router();

const storage = multer.memoryStorage();

const allowed = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'video/mp4',
  'video/webm',
  'video/ogg',
];

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) =>
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(
          new Error(
            'File tidak didukung. Hanya JPG, JPEG, PNG, MP4, WEBM, dan OGG.'
          )
        ),
});

router.get('/', requireLogin, c.index);
router.get('/tambah', requireLogin, c.showCreate);


router.post('/', requireLogin, upload.array('content_media', 50), c.create);

router.get('/detail/:id', requireLogin, c.detail);
router.get('/edit/:id', requireLogin, c.showEdit);


router.post('/edit/:id', requireLogin, upload.any(), c.update);


router.post('/delete/:id', requireLogin, c.remove);

router.delete('/delete/:id', requireLogin, c.remove);

module.exports = router;
