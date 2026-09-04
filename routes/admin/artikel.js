const express=require('express');const multer=require('multer');const path=require('path');const crypto=require('crypto');
const {requireLogin}=require('../../middleware/auth');const c=require('../../controllers/admin/artikelController');
const router=express.Router();
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,path.resolve(__dirname,'../../public/uploads/artikel')),filename:(req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)});
const allowed=['image/jpeg','image/png','image/jpg','application/pdf'];
const upload=multer({storage,limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>allowed.includes(file.mimetype)?cb(null,true):cb(new Error('File tidak didukung. Hanya JPG, JPEG, PNG, dan PDF.'))});
router.get('/',requireLogin,c.index);router.get('/tambah',requireLogin,c.showCreate);router.post('/',requireLogin,upload.array('gambar',50),c.create);router.get('/detail/:id',requireLogin,c.detail);router.get('/edit/:id',requireLogin,c.showEdit);router.post('/edit/:id',requireLogin,upload.array('gambar_baru',50),c.update);router.post('/gambar/delete/:id',requireLogin,c.deleteImage);router.delete('/gambar/delete/:id',requireLogin,c.deleteImage);router.post('/delete/:id',requireLogin,c.remove);router.delete('/delete/:id',requireLogin,c.remove);
module.exports=router;
