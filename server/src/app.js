require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const AdminRouter = require('./router/admin_routes');
const loginRouter  =require('./router/auth_routes');
const userRouter = require('./router/user_routes');

app.use(cors({
    origin: '*'
}));
app.options('*', cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health/9165', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'API is running',
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'local'
    });
});

app.use('/api/admin',AdminRouter);
app.use('/api/auth',AdminRouter);
app.use('/api/auth',loginRouter);
app.use('/api/user',userRouter);

module.exports = app;
