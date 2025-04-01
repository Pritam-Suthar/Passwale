const express = require("express");
const { registerUser, loginUser, getMe , forgotPassword, resetPassword, verifyOTP, resendOTP, getUserProfile, updateUserProfile, getReferralCode, getReferralStats } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.get("/profile", protect, getUserProfile); // Get profile
router.put("/profile", protect, updateUserProfile); // Update profile
router.get("/referral/code", protect, getReferralCode);
router.get("/referral-stats", protect, getReferralStats);

module.exports = router;
