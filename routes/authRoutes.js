const express = require("express");
const { registerUser, loginUser, forgotPassword, resetPassword, verifyOTP, resendOTP, getMe, updateProfile, getReferralCode, getReferralStats, upload, updateProfileImage } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.get('/me', protect, getMe); // Get profile
router.put('/update', protect, updateProfile); // Update profile
router.put('/profile-image', protect, upload.single('profileImage'), updateProfileImage );
router.get("/referral/code", protect, getReferralCode);
router.get("/referral-stats", protect, getReferralStats);

module.exports = router;
