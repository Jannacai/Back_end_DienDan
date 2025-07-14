"use strict";

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const userModel = require("../../models/users.models");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const axios = require("axios");

// Rate limiting cho login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 yêu cầu mỗi IP
    message: "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 15 phút.",
});

// Rate limiting cho register
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 3, // Tối đa 3 yêu cầu mỗi IP
    message: "Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 1 giờ.",
});

// Rate limiting cho forgot-password
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 3, // Tối đa 3 yêu cầu mỗi IP
    message: "Quá nhiều yêu cầu gửi link đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.",
});

// Rate limiting cho reset-password
const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 5, // Tối đa 5 yêu cầu mỗi IP
    message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.",
});

// Rate limiting cho send-verification-code
const verificationCodeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 3, // Tối đa 3 yêu cầu mỗi IP
    message: "Quá nhiều yêu cầu gửi mã xác thực. Vui lòng thử lại sau 1 giờ.",
});

// Kiểm tra biến môi trường
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: "gmail",
        pool: true,
        maxConnections: 5,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    transporter.verify((error, success) => {
        if (error) {
            console.error("Nodemailer configuration error:", error.message);
        } else {
            console.log("Nodemailer ready to send emails");
        }
    });
} else {
    console.error("Missing EMAIL_USER or EMAIL_PASS in environment variables. Email functionality will be disabled.");
}

// Middleware để validate CAPTCHA
const validateCaptcha = async (req, res, next) => {
    const captchaToken = req.headers["x-captcha-token"];
    if (!captchaToken) {
        console.log(`CAPTCHA validation failed: Missing CAPTCHA token`);
        return res.status(400).json({ error: "CAPTCHA token is required" });
    }

    try {
        const response = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify`,
            null,
            {
                params: {
                    secret: process.env.RECAPTCHA_SECRET_KEY,
                    response: captchaToken,
                },
            }
        );

        if (!response.data.success) {
            console.log(`CAPTCHA validation failed: Invalid CAPTCHA token`);
            return res.status(400).json({ error: "Invalid CAPTCHA token" });
        }
        next();
    } catch (error) {
        console.error(`CAPTCHA validation error: ${error.message}`);
        return res.status(500).json({ error: "Failed to validate CAPTCHA" });
    }
};

// Middleware để validate dữ liệu
const validateRegisterInput = (req, res, next) => {
    const { username, password, email, fullname } = req.body;
    if (req.path === "/login") {
        if (!username || !password) {
            console.log(`Login validation failed: Missing username or password`);
            return res.status(400).json({ error: "Username and password are required" });
        }
        if (username.length < 3) {
            console.log(`Login validation failed: Username too short (${username})`);
            return res.status(400).json({ error: "Username must be at least 3 characters long" });
        }
        if (password.length < 6) {
            console.log(`Login validation failed: Password too short for username ${username}`);
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
    } else {
        if (!username || !password || !email || !fullname) {
            console.log(`Register validation failed: Missing fields - username: ${!!username}, email: ${!!email}, fullname: ${!!fullname}, password: ${!!password}`);
            return res.status(400).json({ error: "Username, password, email, and fullname are required" });
        }
        if (username.length < 3) {
            console.log(`Register validation failed: Username too short (${username})`);
            return res.status(400).json({ error: "Username must be at least 3 characters long" });
        }
        if (password.length < 6) {
            console.log(`Register validation failed: Password too short for username ${username}`);
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        if (fullname.length < 3) {
            console.log(`Register validation failed: Fullname too short (${fullname})`);
            return res.status(400).json({ error: "Fullname must be at least 3 characters long" });
        }
    }
    next();
};

// Middleware để validate email
const validateEmailInput = (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        console.log(`Email validation failed: Email is missing`);
        return res.status(400).json({ error: "Email is required" });
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        console.log(`Email validation failed: Invalid email format (${email})`);
        return res.status(400).json({ error: "Invalid email format" });
    }
    if (email.length > 254) {
        console.log(`Email validation failed: Email too long (${email})`);
        return res.status(400).json({ error: "Email is too long" });
    }
    next();
};

// Middleware xác thực token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log(`Authentication failed: Authorization header is missing`);
        return res.status(401).json({ error: "Authorization header is missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        console.log(`Authentication failed: Token is missing`);
        return res.status(401).json({ error: "Token is missing" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.userId && !decoded._id) {
            console.log(`Authentication failed: Token does not contain user ID`);
            return res.status(401).json({ error: "Token không chứa ID người dùng" });
        }
        req.user = {
            id: decoded.userId || decoded._id,
            userId: decoded.userId || decoded._id,
            role: decoded.role,
        };
        next();
    } catch (error) {
        console.error(`Authentication error: ${error.message}`);
        return res.status(401).json({ error: "Invalid token" });
    }
};

// In-memory store cho mã xác thực (thay bằng Redis trong production)
const verificationCodes = new Map();

// POST: Gửi mã xác thực email
router.post("/send-verification-code", verificationCodeLimiter, validateEmailInput, validateCaptcha, async (req, res) => {
    const { email } = req.body;

    if (!transporter) {
        console.error("Email service not configured for /send-verification-code");
        return res.status(500).json({ error: "Email service is not configured" });
    }

    try {
        console.log(`Sending verification code to email: ${email}`);
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            console.log(`Verification failed: Email already exists (${email})`);
            return res.status(400).json({ error: "Email already exists" });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString(); // Mã 6 chữ số
        const expiresAt = Date.now() + 10 * 60 * 1000; // Hết hạn sau 10 phút

        verificationCodes.set(email, { code, expiresAt });
        console.log(`Verification code for ${email}: ${code}`);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Mã xác thực đăng ký",
            html: `<p>Mã xác thực của bạn là: <strong>${code}</strong></p><p>Mã có hiệu lực trong 10 phút.</p>`,
        }).catch(error => {
            console.error(`Failed to send verification email to ${email}: ${error.message}`);
            throw new Error("Failed to send verification email");
        });

        console.log(`Verification email sent successfully to ${email}`);
        res.status(200).json({ message: "Mã xác thực đã được gửi tới email của bạn" });
    } catch (error) {
        console.error(`Error in /send-verification-code for ${email}: ${error.message}`);
        if (error.message === "Failed to send verification email") {
            return res.status(500).json({ error: "Failed to send verification email" });
        }
        res.status(500).json({ error: "Không thể gửi mã xác thực. Vui lòng thử lại sau." });
    }
});

// POST: Xác thực mã
router.post("/verify-code", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        console.log(`Verify code failed: Missing email or code (email: ${email}, code: ${code})`);
        return res.status(400).json({ error: "Email and code are required" });
    }

    const stored = verificationCodes.get(email);
    if (!stored) {
        console.log(`Verify code failed: No verification code found for ${email}`);
        return res.status(400).json({ error: "No verification code found for this email" });
    }

    if (stored.expiresAt < Date.now()) {
        verificationCodes.delete(email);
        console.log(`Verify code failed: Verification code expired for ${email}`);
        return res.status(400).json({ error: "Verification code has expired" });
    }

    if (stored.code !== code) {
        console.log(`Verify code failed: Invalid verification code for ${email}`);
        return res.status(400).json({ error: "Invalid verification code" });
    }

    verificationCodes.delete(email); // Xóa mã sau khi xác thực thành công
    console.log(`Verification successful for ${email}`);
    res.status(200).json({ message: "Verification successful" });
});

// GET: Lấy thông tin người dùng
router.get("/me", authenticate, async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id).select("-password -refreshTokens");
        if (!user) {
            console.log(`User not found for ID: ${req.user.id}`);
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error(`Error in /me: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET: Lấy tất cả người dùng
router.get("/", async (req, res) => {
    try {
        const results = await userModel.find().select("-password -refreshTokens");
        res.status(200).json(results);
    } catch (error) {
        console.error(`Error in /: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST: Đăng ký người dùng
router.post("/register", registerLimiter, validateRegisterInput, async (req, res) => {
    const { username, email, fullname, password } = req.body;
    const deviceInfo = req.headers["user-agent"] || "unknown";

    try {
        console.log(`Register attempt for username: ${username}, email: ${email}`);
        const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            console.log(`Register failed: ${existingUser.username === username ? "Username" : "Email"} already exists (${username}, ${email})`);
            return res.status(400).json({ error: existingUser.username === username ? "Username already exists" : "Email already exists" });
        }

        const user = new userModel({ username, email, fullname, password });
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "30d" }
        );

        user.refreshTokens = [{
            token: refreshToken,
            deviceInfo,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }];
        await user.save();

        console.log(`Register successful for username: ${username}, email: ${email}`);
        res.status(201).json({
            message: "User registered successfully",
            accessToken,
            refreshToken,
            user: { id: user._id, username: user.username, email: user.email, role: user.role },
        });
    } catch (error) {
        console.error(`Error in /register for ${username}, ${email}: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST: Đăng nhập
router.post("/login", loginLimiter, validateRegisterInput, async (req, res) => {
    const { username, password } = req.body;
    const deviceInfo = req.headers["user-agent"] || "unknown";

    try {
        console.log(`Login attempt for username: ${username}`);
        const user = await userModel.findOne({ username });
        if (!user) {
            console.log(`Login failed: Username not found (${username})`);
            return res.status(400).json({ error: "Username not found" });
        }

        if (user.lockUntil && user.lockUntil > new Date()) {
            console.log(`Login failed: Account locked for username ${username}, until: ${user.lockUntil}`);
            return res.status(403).json({ error: "Tài khoản bị khóa. Vui lòng thử lại sau." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                user.failedLoginAttempts = 0;
                console.log(`Login failed: Account locked for username ${username} due to too many failed attempts`);
            }
            await user.save();
            console.log(`Login failed: Incorrect password for username ${username}, attempts: ${user.failedLoginAttempts}`);
            return res.status(400).json({ error: "Incorrect password" });
        }

        user.failedLoginAttempts = 0;
        user.lockUntil = null;

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "30d" }
        );

        user.refreshTokens.push({
            token: refreshToken,
            deviceInfo,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await user.save();

        console.log(`Login successful for username: ${username}`);
        res.status(200).json({
            accessToken,
            refreshToken,
            user: { id: user._id, username: user.username, email: user.email, role: user.role },
        });
    } catch (error) {
        console.error(`Error in /login for ${username}: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST: Quên mật khẩu
router.post("/forgot-password", forgotPasswordLimiter, validateEmailInput, async (req, res) => {
    const { email } = req.body;

    if (!transporter) {
        console.error("Email service not configured for /forgot-password");
        return res.status(500).json({ error: "Email service is not configured" });
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            console.log(`Forgot password failed: Email not found (${email})`);
            return res.status(400).json({ error: "Email not found" });
        }

        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        const resetLink = `${process.env.FRONTEND_URL}/resetauth/reset-password?token=${resetToken}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Đặt lại mật khẩu",
            html: `<p>Nhấn vào liên kết sau để đặt lại mật khẩu:</p><a href="${resetLink}">Đặt lại mật khẩu</a><p>Link có hiệu lực trong 1 giờ.</p>`,
        }).catch(error => {
            console.error(`Failed to send reset password email to ${email}: ${error.message}`);
            throw new Error("Failed to send reset password email");
        });

        console.log(`Reset password email sent successfully to ${email}`);
        res.status(200).json({ message: "Link đặt lại mật khẩu đã được gửi tới email của bạn" });
    } catch (error) {
        console.error(`Error in /forgot-password for ${email}: ${error.message}`);
        if (error.message === "Failed to send reset password email") {
            return res.status(500).json({ error: "Failed to send reset password email" });
        }
        res.status(500).json({ error: "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
});

// POST: Đặt lại mật khẩu
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token) {
        console.log(`Reset password failed: Token is missing`);
        return res.status(400).json({ error: "Token is required" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);

        if (!user) {
            console.log(`Reset password failed: Invalid or expired token for user ID ${decoded.userId}`);
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        if (!newPassword) {
            console.log(`Reset password: Token is valid for user ID ${decoded.userId}`);
            return res.status(200).json({ message: "Token is valid" });
        }

        if (newPassword.length < 8) {
            console.log(`Reset password failed: New password too short for user ID ${decoded.userId}`);
            return res.status(400).json({ error: "New password must be at least 8 characters long" });
        }

        user.password = newPassword;
        user.refreshTokens = [];
        await user.save();

        console.log(`Password reset successfully for user ID ${decoded.userId}`);
        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(`Error in /reset-password: ${error.message}`);
        if (error.name === "TokenExpiredError") {
            console.log(`Reset password failed: Token expired`);
            return res.status(400).json({ error: "Token has expired" });
        }
        res.status(400).json({ error: "Invalid token" });
    }
});

// POST: Cấp lại access token
router.post("/refresh-token", async (req, res) => {
    const { refreshToken } = req.body;
    const deviceInfo = req.headers["user-agent"] || "unknown";

    if (!refreshToken) {
        console.log(`Refresh token failed: Refresh token is missing`);
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        const user = await userModel.findOne({ "refreshTokens.token": refreshToken });
        if (!user) {
            console.log(`Refresh token failed: Invalid refresh token`);
            return res.status(403).json({ error: "Invalid refresh token" });
        }

        const tokenData = user.refreshTokens.find((t) => t.token === refreshToken);
        if (!tokenData || tokenData.expiresAt < new Date()) {
            console.log(`Refresh token failed: Invalid or expired refresh token for user ID ${user._id}`);
            return res.status(403).json({ error: "Invalid or expired refresh token" });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (decoded.userId !== user._id.toString()) {
            console.log(`Refresh token failed: Invalid refresh token for user ID ${user._id}`);
            return res.status(403).json({ error: "Invalid refresh token" });
        }

        user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
        const newRefreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "30d" }
        );
        user.refreshTokens.push({
            token: newRefreshToken,
            deviceInfo,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        await user.save();
        console.log(`Refresh token successful for user ID ${user._id}`);
        res.status(200).json({ accessToken, newRefreshToken });
    } catch (error) {
        console.error(`Error in /refresh-token: ${error.message}`);
        if (error.name === "TokenExpiredError") {
            console.log(`Refresh token failed: Refresh token expired`);
            return res.status(403).json({ error: "Refresh token expired" });
        }
        res.status(403).json({ error: "Invalid refresh token" });
    }
});

// POST: Đăng xuất
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        console.log(`Logout failed: Refresh token is missing`);
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        const user = await userModel.findOne({ "refreshTokens.token": refreshToken });
        if (user) {
            user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
            await user.save();
            console.log(`Logout successful for user ID ${user._id}`);
        }
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error(`Error in /logout: ${error.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = {
    router,
    authenticate,
};