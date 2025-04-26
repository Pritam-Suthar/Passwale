const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const sendOTP = require("../utils/sendEmail");
const multer = require('multer');
const path = require('path');

exports.registerUser = async (req, res) => {
    console.log('Received request body:', req.body); // Add this line
    console.log('Received query params:', req.query); // Add this line
    const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        referralCode: referralFromBody
    } = req.body;

    const referralCode = req.query.ref || req.body.referralCode;

    // Enhanced validation with detailed errors
    const missingFields = [];
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!confirmPassword) missingFields.push('confirmPassword');

    if (missingFields.length > 0) {
        console.log('Missing fields detected:', missingFields);
        return res.status(400).json({ 
            message: "All fields are required",
            missingFields: missingFields,
            receivedData: req.body // Send back what we actually received
        });
    }

    try {
        // Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 5 * 60 * 1000;

        // Handle referral
        let referredByUser = null;
        if (referralCode) {
            referredByUser = await User.findOne({ referralCode });
            if (!referredByUser) {
                return res.status(400).json({ message: "Invalid referral code" });
            }
        }

        // Create user - DON'T include confirmPassword
        const user = await User.create({
            name: `${firstName} ${lastName}`,
            firstName,
            lastName,
            email,
            password, // Let pre-save hook handle hashing
            otp,
            otpExpiry,
            referredBy: referredByUser?._id,
            referralCode: Math.random().toString(36).substring(2, 10),
        });

        // Reward referrer
        if (referredByUser) {
            referredByUser.rewardPoints += 10;
            await referredByUser.save();
        }

        // Send OTP
        await sendOTP(email, otp);

        res.status(201).json({
            message: "OTP sent to email. Verify your account.",
            userId: user._id,
            email: user.email
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ 
            message: "Server error during registration",
            error: error.message 
        });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log('Login attempt for:', email); // Debug log
        
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.log('User not found for email:', email);
            return res.status(401).json({ 
                success: false,
                message: "Invalid credentials" 
            });
        }

        console.log('Entered password:', password);
        console.log('Stored hash:', user.password);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', isMatch);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid credentials" 
            });
        }

        // Generate token
        const token = generateToken(user._id);
        
        res.status(200).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error during login",
            error: error.message 
        });
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
    const { userId, email, otp } = req.body;

    try {
        // Validate input
        if (!otp) {
            return res.status(400).json({ message: "OTP is required" });
        }

        if (!userId && !email) {
            return res.status(400).json({ message: "User ID or email is required" });
        }

        // Find user by either ID or email
        const user = userId 
            ? await User.findById(userId)
            : await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User already verified" });
        }

        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({ message: "No OTP request found" });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (Date.now() > user.otpExpiry) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        // Update user
        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        res.status(200).json({ 
            success: true,
            message: "User verified successfully", 
            token: generateToken(user.id) 
        });
    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({ 
            message: "Server error during OTP verification",
            error: error.message 
        });
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

// Get current user profile
exports.getMe = async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      res.status(200).json(user);
    } catch (error) {
      console.error('Error getting user profile:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error',
        error: error.message 
      });
    }
  };

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
      const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        profileImage: req.body.profileImage
      };
  
      const user = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
      ).select('-password');
  
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error',
        error: error.message 
      });
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

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads/profile-images');
    },
    filename: function (req, file, cb) {
      cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
  });
  
  // File filter
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  };
  
  exports.upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });
  
  exports.updateProfileImage = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      const imagePath = `/uploads/profile-images/${req.file.filename}`;
      
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { profileImage: imagePath },
        { new: true }
      );
  
      res.status(200).json({
        success: true,
        profileImage: user.profileImage
      });
    } catch (error) {
      console.error('Error updating profile image:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error updating profile image'
      });
    }
  };