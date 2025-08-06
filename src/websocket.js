"use strict";

const { Server } = require("socket.io");
const mongoose = require('mongoose');
const userModel = require("./models/users.models");
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');

let io = null;
let guestCount = 0;
let onlineUsers = new Map(); // Quản lý user online hiệu quả hơn

// Performance monitoring
const performanceMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    averageResponseTime: 0
};

// Connection tracking
const connectionStats = {
    startTime: Date.now(),
    peakConnections: 0,
    totalDisconnections: 0
};

// Hàm phát số lượt xem tới tất cả client trong viewCountRoom
async function broadcastViewCount() {
    try {
        const onlineUsersCount = await userModel.countDocuments({ isOnline: true });
        const totalViews = onlineUsersCount + guestCount;
        io.to('viewCountRoom').emit('VIEW_COUNT_UPDATED', { viewCount: totalViews });
        console.log(`📊 Broadcasted view count: ${totalViews}`);
    } catch (err) {
        console.error('❌ Error broadcasting view count:', err.message);
    }
}

// Hàm quản lý user online với performance optimization
async function updateUserOnlineStatus(userId, isOnline) {
    try {
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const updateData = {
                isOnline,
                lastActive: moment.tz('Asia/Ho_Chi_Minh').toDate()
            };

            await userModel.findByIdAndUpdate(userId, updateData, {
                new: true,
                lean: true
            });

            console.log(`👤 User ${userId} ${isOnline ? 'online' : 'offline'}`);
        }
    } catch (err) {
        console.error('❌ Error updating user online status:', err.message);
    }
}

// Health check function
function performHealthCheck() {
    const now = Date.now();
    const uptime = now - connectionStats.startTime;
    const avgResponseTime = performanceMetrics.averageResponseTime;

    console.log(`🏥 Socket.IO Health Check:
    - Uptime: ${Math.floor(uptime / 1000)}s
    - Active Connections: ${performanceMetrics.activeConnections}
    - Peak Connections: ${connectionStats.peakConnections}
    - Total Messages: ${performanceMetrics.totalMessages}
    - Avg Response Time: ${avgResponseTime.toFixed(2)}ms
    - Guest Count: ${guestCount}
    - Online Users: ${onlineUsers.size}`);
}

function initializeWebSocket(server) {
    if (io) {
        console.warn("⚠️ Socket.IO server already initialized");
        return;
    }

    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        maxHttpBufferSize: 1e6, // 1MB
        connectTimeout: 45000
    });

    // Performance monitoring
    io.engine.on('connection_error', (err) => {
        console.error('🚨 Socket.IO connection error:', err);
    });

    io.on("connection", async (socket) => {
        performanceMetrics.totalConnections++;
        performanceMetrics.activeConnections++;
        connectionStats.peakConnections = Math.max(connectionStats.peakConnections, performanceMetrics.activeConnections);

        console.log(`🔌 Socket.IO client connected: ${socket.id}`);
        console.log(`📈 Active connections: ${performanceMetrics.activeConnections}`);

        // Không yêu cầu xác thực token, coi tất cả client là khách
        guestCount++;
        broadcastViewCount();

        socket.join("public");

        // Thêm sự kiện joinViewCount
        socket.on("joinViewCount", () => {
            socket.join("viewCountRoom");
            console.log(`👥 Client ${socket.id} joined viewCountRoom`);
            broadcastViewCount();
        });

        socket.on("joinChat", () => {
            socket.join("chat");
            console.log(`💬 Client ${socket.id} joined chat room`);

            // Log current clients in chat room
            io.in("chat").allSockets().then(clients => {
                console.log(`📊 Clients in chat room: ${clients.size}`);
                console.log(`📋 Chat room clients:`, Array.from(clients));
            });
        });

        socket.on("getRooms", () => {
            socket.rooms.forEach(room => {
                console.log(`🏠 Client ${socket.id} is in room: ${room}`);
            });
            socket.emit('rooms', Array.from(socket.rooms));
        });

        socket.on("joinPost", (postId) => {
            socket.join(`post:${postId}`);
            console.log(`📝 Client ${socket.id} joined room post:${postId}`);
        });

        // Removed joinEventFeed room for components that no longer use Socket.IO

        socket.on("joinEvent", (eventId) => {
            socket.join(`event:${eventId}`);
            console.log(`🎯 Client ${socket.id} joined room event:${eventId}`);
        });

        socket.on("joinRewardFeed", () => {
            socket.join("rewardFeed");
            console.log(`🎁 Client ${socket.id} joined rewardFeed room`);
        });

        socket.on("joinRoom", (room) => {
            socket.join(room);
            console.log(`🚪 Client ${socket.id} joined room ${room}`);
        });

        socket.on("joinPrivateRoom", (roomId) => {
            socket.join(roomId);
            console.log(`🔒 Client ${socket.id} joined private room ${roomId}`);

            // Log current clients in private room
            io.in(roomId).allSockets().then(clients => {
                console.log(`📊 Clients in private room ${roomId}: ${clients.size}`);
            });
        });

        // Xử lý user authentication và online status với performance optimization
        socket.on("authenticate", async (token) => {
            const startTime = Date.now();
            try {
                if (!token) {
                    console.log(`⚠️ Client ${socket.id} has no token`);
                    return;
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decoded.userId || decoded.id;

                if (userId) {
                    onlineUsers.set(socket.id, userId);
                    await updateUserOnlineStatus(userId, true);
                    console.log(`✅ User ${userId} authenticated via socket ${socket.id}`);

                    // Join user to their personal room
                    socket.join(userId);
                    console.log(`🔒 User ${userId} joined personal room`);

                    // Performance tracking
                    const responseTime = Date.now() - startTime;
                    performanceMetrics.averageResponseTime =
                        (performanceMetrics.averageResponseTime + responseTime) / 2;
                }
            } catch (err) {
                console.error(`❌ Authentication error for socket ${socket.id}:`, err.message);
            }
        });

        // Ping/Pong for health check
        socket.on("ping", () => {
            socket.emit("pong");
        });

        // Xử lý tái kết nối
        socket.on("reconnect", async () => {
            console.log(`🔄 Client ${socket.id} reconnected`);
            broadcastViewCount();
        });

        // Xử lý ngắt kết nối với cleanup optimization
        socket.on("disconnect", async (reason) => {
            performanceMetrics.activeConnections--;
            connectionStats.totalDisconnections++;

            console.log(`🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);

            // Cập nhật trạng thái user offline
            const userId = onlineUsers.get(socket.id);
            if (userId) {
                await updateUserOnlineStatus(userId, false);
                onlineUsers.delete(socket.id);
                console.log(`👤 User ${userId} went offline`);
            }

            guestCount = Math.max(0, guestCount - 1);
            broadcastViewCount();

            console.log(`📉 Active connections: ${performanceMetrics.activeConnections}`);
        });

        socket.on("error", (error) => {
            console.error(`🚨 Socket.IO error for client ${socket.id}:`, error.message);
        });

        // Message handling with performance tracking
        socket.onAny((eventName, ...args) => {
            performanceMetrics.totalMessages++;
            console.log(`📨 Event: ${eventName}, Args:`, args.length);
        });
    });

    // Periodic health check
    setInterval(performHealthCheck, 60000); // Every minute

    console.log("✅ Socket.IO server initialized with performance monitoring");
}

function broadcastComment({ type, data, room, postId, eventId }) {
    if (!io) {
        console.warn("⚠️ Socket.IO server not initialized, skipping broadcast");
        return;
    }

    const startTime = Date.now();

    try {
        let targetRoom = null;
        let roomType = null;

        if (room) {
            targetRoom = room;
            roomType = 'custom';
        } else if (postId) {
            targetRoom = `post:${postId}`;
            roomType = 'post';
        } else if (eventId) {
            targetRoom = `event:${eventId}`;
            roomType = 'event';
        } else {
            targetRoom = "public";
            roomType = 'public';
        }

        // Kiểm tra số lượng client trong room trước khi broadcast
        io.in(targetRoom).allSockets().then(clients => {
            const clientCount = clients.size;
            console.log(`📡 Broadcasting ${type} to ${roomType} room "${targetRoom}" (${clientCount} clients)`);

            // Broadcast message
            io.to(targetRoom).emit(type, { ...data, roomId: targetRoom });

            const responseTime = Date.now() - startTime;
            performanceMetrics.averageResponseTime =
                (performanceMetrics.averageResponseTime + responseTime) / 2;

            console.log(`✅ Broadcasted ${type} to ${roomType} room ${targetRoom} (${responseTime}ms, ${clientCount} clients)`);
        }).catch(error => {
            console.error(`❌ Error getting clients in room ${targetRoom}:`, error.message);
        });

    } catch (error) {
        console.error(`❌ Error broadcasting ${type}:`, error.message);
    }
}

// Utility functions for monitoring
function getSocketStats() {
    return {
        performanceMetrics,
        connectionStats,
        guestCount,
        onlineUsersCount: onlineUsers.size,
        uptime: Date.now() - connectionStats.startTime
    };
}

module.exports = {
    initializeWebSocket,
    broadcastComment,
    io,
    broadcastViewCount,
    getSocketStats,
    updateUserOnlineStatus
};