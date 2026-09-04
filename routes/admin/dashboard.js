const express=require('express');
const {requireLogin}=require('../../middleware/auth');
const controller=require('../../controllers/admin/dashboardController');
const router=express.Router();
router.get('/',requireLogin,controller.index);
module.exports=router;
