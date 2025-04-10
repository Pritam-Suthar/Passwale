const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const sendOTP = require("../utils/sendEmail");

exports.registerUser = async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        referralCode: referralFromBody
    } = req.body;
    const referralCode = req.query.ref || req.body.referralCode; // Check for referral in query or body

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Generate OTP and Expiry Time
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

        // Check if user was referred
        let referredByUser = null;
        if (referralCode) {
            referredByUser = await User.findOne({ referralCode });
            if (!referredByUser) {
                return res.status(400).json({ message: "Invalid referral code" });
            }
        }

        // 👤 Create New User
        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            otp,
            otpExpiry,
            referredBy: referredByUser ? referredByUser._id : null,
            referralCode: Math.random().toString(36).substring(2, 10),
        });

        // ✅ Reward Referrer (Give points, discounts, etc.)
        if (referredByUser) {
            referredByUser.rewardPoints += 10;  // Example: Give 10 points
            await referredByUser.save();
        }

        // Send OTP to email
        await sendOTP(email, otp);

        res.status(201).json({
            message: "OTP sent to email. Verify your account.",
            userId: user._id,
            referralCode: user.referralCode,
            referredBy: referredByUser ? referredByUser.referralCode : null,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        console.log("User found:", user);

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        console.log("User found:", user);
        console.log("Entered password:", password);
        console.log("Stored password:", user.password);

        // Check if the password matches
        const isMatch = await user.matchPassword(password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user.id),
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate and hash the token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        await User.findOneAndUpdate(
            { email: email },
            {
                resetPasswordToken: hashedToken, // Store the hashed version
                resetPasswordExpire: Date.now() + 10 * 60 * 1000 // 10 minutes
            },
            { runValidators: false }
        );

        // Send email with the raw token (unhashed)
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
        
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            to: user.email,
            subject: "Password Reset Request",
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link is valid for 10 minutes.</p>`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Password reset email sent!" });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ 
            message: "Server error", 
            error: error.message 
        });
    }
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!token) {
        return res.status(400).json({ message: "Reset token is required" });
    }

    if (!newPassword || !confirmPassword) {
        return res.status(400).json({ message: "Both password fields are required" });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
        // Hash the token for comparison
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update using findOneAndUpdate to avoid validation issues
        await User.findOneAndUpdate(
            { _id: user._id },
            { 
                password: hashedPassword,
                resetPasswordToken: undefined,
                resetPasswordExpire: undefined 
            },
            { runValidators: false }
        );

        res.status(200).json({ message: "Password reset successful!" });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ 
            message: "Server error", 
            error: error.message 
        });
    }
};

exports.verifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User already verified" });
        }

        if (user.otp !== otp || Date.now() > user.otpExpiry) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        res.status(200).json({ message: "User verified successfully", token: generateToken(user.id) });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User already verified" });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

        await user.save();
        await sendOTP(email, otp);

        res.status(200).json({ message: "New OTP sent to email" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from authentication middleware
        const user = await User.findById(userId).select("-password"); // Exclude password

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from authentication middleware
        const { name, phone, dateOfBirth, gender, profileImage } = req.body;

        if (!name || !phone || !dateOfBirth || !gender) {
            return res.status(400).json({ message: "Phone, date of birth, and gender are required" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, phone, dateOfBirth, gender, profileImage },
            { new: true, runValidators: true }
        ).select("-password"); // Exclude password

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        // Update profile fields
        updatedUser.name = name;
        updatedUser.phone = phone;
        updatedUser.dateOfBirth = dateOfBirth;
        updatedUser.gender = gender;
        await updatedUser.save();
        res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getReferralCode = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const referralLink = `http://localhost:3000/register?ref=${user.referralCode}`;

        res.status(200).json({ referralCode: user.referralCode, referralLink });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id; // Assume user is authenticated

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Count how many users this person referred
        const referrals = await User.find({ referredBy: userId }).select("name email createdAt");

        res.status(200).json({
            totalReferrals: referrals.length,
            referrals,
            rewardPoints: user.rewardPoints || 0,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

