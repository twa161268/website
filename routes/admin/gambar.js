const express=require('express');const multer=require('multer');const path=require('path');const crypto=require('crypto');
const {requireLogin}=require('../../middleware/auth');const c=require('../../controllers/admin/gambarController');
const router=express.Router();
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,path.resolve(__dirname,'../../public/uploads/gambar')),filename:(req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)});
const allowed=['image/jpeg','image/png','image/jpg','application/pdf'];
const upload=multer({storage,limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>allowed.includes(file.mimetype)?cb(null,true):cb(new Error('File tidak didukung. Hanya JPG, JPEG, PNG, dan PDF.'))});
router.get('/',requireLogin,c.index);router.get('/tambah',requireLogin,c.showCreate);router.post('/',requireLogin,upload.single('gambar'),c.create);router.get('/edit/:id',requireLogin,c.showEdit);router.post('/edit/:id',requireLogin,upload.single('gambar'),c.update);router.post('/delete/:id',requireLogin,c.remove);router.delete('/delete/:id',requireLogin,c.remove);
module.exports=router;
