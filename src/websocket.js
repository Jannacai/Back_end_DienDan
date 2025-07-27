"use strict";

const { Server } = require("socket.io");
const mongoose = require('mongoose');
const userModel = require("./models/users.models");
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');

let io = null;
let guestCount = 0; // Biến đếm số khách online

// Hàm phát số lượt xem tới tất cả client trong viewCountRoom
async function broadcastViewCount() {
    try {
        const onlineUsers = await userModel.countDocuments({ isOnline: true });
        const totalViews = onlineUsers + guestCount;
        io.to('viewCountRoom').emit('VIEW_COUNT_UPDATED', { viewCount: totalViews });
        console.log(`Broadcasted view count: ${totalViews}`);
    } catch (err) {
        console.error('Error broadcasting view count:', err.message);
    }
}

function initializeWebSocket(server) {
    if (io) {
        console.warn("Socket.IO server already initialized");
        return;
    }
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", async (socket) => {
        // Không yêu cầu xác thực token, coi tất cả client là khách
        guestCount++;
        io.to('userStatus').emit('GUEST_COUNT_UPDATED', { guestCount });
        console.log(`Guest connected, total guests: ${guestCount}`);
        // Phát viewCount khi client kết nối
        broadcastViewCount();

        socket.join("public");
        console.log(`Socket.IO client connected: Client ID: ${socket.id}`);

        // Thêm sự kiện joinViewCount
        socket.on("joinViewCount", () => {
            socket.join("viewCountRoom");
            console.log(`Client ${socket.id} joined viewCountRoom`);
            // Gửi viewCount cho client mới tham gia
            broadcastViewCount();
        });

        // Kênh userStatus cho UserList
        socket.on("joinUserStatus", () => {
            socket.join("userStatus");
            console.log(`Client ${socket.id} joined userStatus room`);
            // Gửi số lượng khách online cho client mới
            socket.emit('GUEST_COUNT_UPDATED', { guestCount });
        });

        socket.on("joinChat", () => {
            socket.join("chat");
            console.log(`Client ${socket.id} joined chat room`);
        });

        socket.on("joinPost", (postId) => {
            socket.join(`post:${postId}`);
            console.log(`Client ${socket.id} joined room post:${postId}`);
        });

        socket.on("joinLotteryFeed", () => {
            socket.join("lotteryFeed");
            console.log(`Client ${socket.id} joined lotteryFeed room`);
        });

        socket.on("joinLeaderboard", () => {
            socket.join("leaderboard");
            console.log(`Client ${socket.id} joined leaderboard room`);
        });

        socket.on("joinEventFeed", () => {
            socket.join("eventFeed");
            console.log(`Client ${socket.id} joined eventസ

System: eventFeed room`);
        });

        socket.on("joinEvent", (eventId) => {
            socket.join(`event:${eventId}`);
            console.log(`Client ${socket.id} joined room event:${eventId}`);
        });

        socket.on("joinRewardFeed", () => {
            socket.join("rewardFeed");
            console.log(`Client ${socket.id} joined rewardFeed room`);
        });

        socket.on("joinRoom", (room) => {
            socket.join(room);
            console.log(`Client ${socket.id} joined room ${room}`);
            io.in(room).allSockets().then(clients => {
                console.log(`Clients in room ${room}: `, Array.from(clients));
            });
        });

        socket.on("joinPrivateRoom", (roomId) => {
            socket.join(roomId);
            console.log(`Client ${socket.id} joined private room ${roomId}`);
            io.in(roomId).allSockets().then(clients => {
                console.log(`Clients in private room ${roomId}: `, Array.from(clients));
            });
        });

        // Xử lý tái kết nối
        socket.on("reconnect", async () => {
            // Bỏ logic cập nhật userModel, chỉ phát viewCount
            broadcastViewCount();
            console.log(`Client ${socket.id} reconnected`);
        });

        // Xử lý ngắt kết nối
        socket.on("disconnect", async () => {
            guestCount = Math.max(0, guestCount - 1);
            io.to('userStatus').emit('GUEST_COUNT_UPDATED', { guestCount });
            console.log(`Guest disconnected, total guests: ${guestCount}`);
            // Phát viewCount khi client ngắt kết nối
            broadcastViewCount();
            console.log(`Socket.IO client disconnected: ${socket.id}`);
        });

        socket.on("error", (error) => {
            console.error(`Socket.IO error for client ${socket.id}: `, error.message);
        });
    });

    console.log("Socket.IO server initialized");
}

function broadcastComment({ type, data, room, postId, eventId }) {
    if (!io) {
        console.warn("Socket.IO server not initialized, skipping broadcast");
        return;
    }
    if (room) {
        io.to(room).emit(type, { ...data, roomId: room });
        console.log(`Broadcasted ${type} to room ${room}`);
    } else if (postId) {
        io.to(`post:${postId}`).emit(type, data);
        console.log(`Broadcasted ${type} to room post:${postId}`);
    } else if (eventId) {
        io.to(`event:${eventId}`).emit(type, data);
        console.log(`Broadcasted ${type} to room event:${eventId}`);
    } else {
        io.to("public").emit(type, data);
        console.log(`Broadcasted ${type} to public room`);
    }
}

module.exports = { initializeWebSocket, broadcastComment, io, broadcastViewCount };