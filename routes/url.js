const express=require('express');

const {GenerateNewShortURL,handleRedirectURL}=require('../controllers/url');

const router=express.Router();

router.post('/url',GenerateNewShortURL);
router.get('/:shortId',handleRedirectURL);

module.exports=router;