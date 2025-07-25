"use strict"
const { router: authK } = require('./auth/auth.routes');
const commentRoutes = require('./auth/comment.routes');
const notificationRoutes = require('./auth/notification.routes');
const ViewRoutes = require('./auth/viewRoutes');

const groupchatRoutes = require('./auth/groupchat.routes');
const userRoutes = require('./auth/user.routes');
const lotteryRoutes = require('./lottery/lottery');
const eventRouter = require('./Events/events.routes')
const telegram = require('./telegram/routestelegram');
// const resultsRouterMB = require('./kqxsMB/resultMB.routes');
// const resultsRouterMN = require('./kqxsMN/resultMN.routes');
// const resultsRouterMT = require('./kqxsMT/resultMT.routes');
const postsRouter = require('./post/post.routes');

const Routes = (app) => {
    app.use('/api/users', userRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/posts', postsRouter);
    app.use('/api/comments', commentRoutes);
    app.use('/api/groupchat', groupchatRoutes);
    app.use('/api/auth', authK);
    app.use('/api/views', ViewRoutes);
    app.use('/api/lottery', lotteryRoutes);
    app.use('/api/events', eventRouter);

    // app.use('/api/ketqua', resultsRouterMN);
    // app.use('/api/ketquaxs', resultsRouterMT);
    // app.use('/api/kqxs', resultsRouterMB);
    app.use('/api/kqxs/xsmb/telegram', (req, res, next) => {
        console.log('Yêu cầu đến /api/kqxs/xsmb/telegram:', req.method, req.url, req.body);
        next();
    }, telegram);
};

module.exports = Routes;