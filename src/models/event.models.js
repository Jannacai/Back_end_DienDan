const mongoose = require('mongoose');
const moment = require('moment-timezone');

const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: () => moment.tz('Asia/Ho_Chi_Minh').toDate()
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    replies: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: () => moment.tz('Asia/Ho_Chi_Minh').toDate()
        },
        likes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }]
});

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    label: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['event', 'hot_news', 'discussion'],
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    comments: [commentSchema],
    lotteryFields: {
        type: {
            bachThuLo: { type: Boolean, default: false },
            songThuLo: { type: Boolean, default: false },
            threeCL: { type: Boolean, default: false },
            cham: { type: Boolean, default: false },
            danDe: { type: Boolean, default: false },
            danDeType: {
                type: String,
                default: null,
                enum: [null, '1x', '2x', '3x', '4x', '5x', '6x']
            }
        },
        default: {
            bachThuLo: false,
            songThuLo: false,
            threeCL: false,
            cham: false,
            danDe: false,
            danDeType: null
        }
    },
    viewCount: {
        type: Number,
        default: 0
    },
    startTime: {
        type: Date,
        required: false
    },
    endTime: {
        type: Date,
        required: false
    },
    rules: {
        type: String,
        required: false
    },
    rewards: {
        type: String,
        required: false
    },
    scoringMethod: {
        type: String,
        required: false
    },
    notes: {
        type: String,
        required: false
    }
}, {
    timestamps: {
        currentTime: () => moment.tz('Asia/Ho_Chi_Minh').toDate()
    }
});

module.exports = mongoose.model('Event', eventSchema);