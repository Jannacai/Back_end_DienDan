"use strict";

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { authenticate } = require('./auth.routes');
const Chat = require('../../models/groupchat.models');
const User = require('../../models/users.models');
const { broadcastComment } = require('../../websocket');

router.get('/', async (req, res) => {
    try {
        console.log('📨 Fetching group chat messages...');
        const messages = await Chat.find({ isPrivate: false })
            .populate('userId', 'username fullname img role titles points level winCount')
            .sort({ createdAt: -1 }) // Changed back to -1: descending order (newest first, oldest last)
            .limit(50)
            .lean();

        console.log(`✅ Fetched ${messages.length} group chat messages`);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ messages });
    } catch (err) {
        console.error('❌ Error in GET /chat:', err.message);
        res.status(500).json({ message: err.message || 'Đã có lỗi khi lấy danh sách tin nhắn' });
    }
});

router.get('/private/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        console.log('📨 Fetching private messages for room:', roomId);

        const [userId1, userId2] = roomId.split('-').map(id => new mongoose.Types.ObjectId(id));
        const messages = await Chat.find({
            isPrivate: true,
            $or: [
                { userId: userId1, receiverId: userId2 },
                { userId: userId2, receiverId: userId1 }
            ]
        })
            .populate('userId', 'username fullname img role titles points level winCount')
            .sort({ createdAt: -1 }) // Changed back to -1: descending order (newest first, oldest last)
            .lean();

        console.log(`✅ Fetched ${messages.length} private messages for room ${roomId}`);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({ messages });
    } catch (err) {
        console.error('❌ Error in GET /chat/private/:roomId:', err.message);
        res.status(500).json({ message: err.message || 'Đã có lỗi khi lấy tin nhắn riêng' });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { content, receiverId } = req.body;
        console.log('📨 Processing new message:', { content: content?.substring(0, 50) + '...', receiverId });

        if (!content || content.trim().length === 0) {
            console.log('❌ Empty message content');
            return res.status(400).json({ message: 'Nội dung tin nhắn là bắt buộc' });
        }

        // Validate content length
        if (content.length > 1000) {
            console.log('❌ Message too long:', content.length);
            return res.status(400).json({ message: 'Tin nhắn không được quá 1000 ký tự' });
        }

        // Nếu có receiverId (tin nhắn riêng)
        if (receiverId) {
            console.log('🔒 Processing private message:', {
                senderId: req.user.userId,
                senderRole: req.user.role,
                receiverId,
            });

            // Kiểm tra vai trò của người gửi
            const isSenderAdmin = req.user.role === 'admin' || req.user.role === 'ADMIN';
            if (!isSenderAdmin) {
                // Người gửi là user, kiểm tra receiverId phải là admin
                const receiver = await User.findById(receiverId);
                if (!receiver) {
                    console.log('❌ Receiver not found:', receiverId);
                    return res.status(404).json({ message: 'Người nhận không tồn tại' });
                }
                console.log('Receiver info:', { receiverId, receiverRole: receiver.role });
                const isReceiverAdmin = receiver.role === 'admin' || receiver.role === 'ADMIN';
                if (!isReceiverAdmin) {
                    console.log('❌ User cannot send private message to non-admin');
                    return res.status(403).json({ message: 'Chỉ được phép gửi tin nhắn riêng tới admin' });
                }
            }
            // Nếu người gửi là admin, cho phép gửi tới bất kỳ ai
        }

        // Tạo tin nhắn mới
        const message = new Chat({
            userId: new mongoose.Types.ObjectId(req.user.userId),
            receiverId: receiverId ? new mongoose.Types.ObjectId(receiverId) : null,
            content: content.trim(),
            createdAt: moment.tz('Asia/Ho_Chi_Minh').toDate(),
            isPrivate: !!receiverId,
        });

        console.log('💾 Saving message to database...');
        await message.save();
        console.log('✅ Message saved with ID:', message._id);

        // Populate message với thông tin user
        const populatedMessage = await Chat.findById(message._id)
            .populate('userId', 'username fullname img role titles points level winCount')
            .lean();

        console.log('📡 Broadcasting message...');

        if (receiverId) {
            // Private message
            const roomId = [req.user.userId, receiverId].sort().join('-');
            console.log('🔒 Broadcasting PRIVATE_MESSAGE to room:', roomId);

            broadcastComment({
                type: 'PRIVATE_MESSAGE',
                data: {
                    ...populatedMessage,
                    roomId,
                    senderId: req.user.userId,
                    receiverId
                },
                room: roomId
            });
        } else {
            // Group message
            console.log('💬 Broadcasting NEW_MESSAGE to chat room');

            broadcastComment({
                type: 'NEW_MESSAGE',
                data: populatedMessage,
                room: 'chat'
            });
        }

        console.log('✅ Message broadcasted successfully');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.status(200).json({
            message: 'Gửi tin nhắn thành công',
            chat: populatedMessage
        });
    } catch (err) {
        console.error('❌ Error in POST /chat:', err.message);
        res.status(500).json({ message: err.message || 'Đã có lỗi khi gửi tin nhắn' });
    }
});

module.exports = router;