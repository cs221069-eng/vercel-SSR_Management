const express = require('express');
const router = express.Router();
const LoginRouter = require('../controller/login_controller');

router.use((req, res, next) => {
    console.log('[AUTH ROUTE]', req.method, req.originalUrl);
    next();
});


router.post('/login/9165',LoginRouter.Login);
router.post('/logout/9165', LoginRouter.Logout);
router.get('/ping', (req, res) => {
    return res.status(200).json({ ok: true, message: 'auth route alive' });
});



module.exports = router;
