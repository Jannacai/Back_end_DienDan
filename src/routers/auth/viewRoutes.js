"use strict";

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const userModel = require('../../models/users.models');

router.get('/', async (req, res) => {
    try {
        const onlineUsers = await userModel.countDocuments({ isOnline: true });
        const guestCount = require('../../websocket').guestCount || 0; // Lấy guestCount từ websocket
        const totalViews = onlineUsers + guestCount;

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ viewCount: totalViews });
    } catch (err) {
        console.error('Error in /xsmb/views/initial:', err.message);
        res.status(500).json({ error: err.message || 'Đã có lỗi khi lấy số lượt xem ban đầu' });
    }
});

module.exports = router;