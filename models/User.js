const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
    name: { type: String },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: false },
    dateOfBirth: { type: Date, required: false },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: false },
    profileImage: { type: String }, // Store URL of the uploaded profile image

    role: { type: String, enum: ["volunteer", "user", "organizer", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Stores who referred this user
    rewardPoints: { type: Number, default: 0 },

    otp: String,  // Stores the OTP
    otpExpiry: Date,  // OTP Expiry Time

}, { timestamps: true });

// ✅ Combined pre("save") Hook (Fixes password hash & referral code issues)
userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // Generate referral code if new user
    if (this.isNew && !this.referralCode) {
        this.referralCode = crypto.randomBytes(4).toString("hex");
    }

    // Combine first/last name if not provided
    if (!this.name && (this.firstName || this.lastName)) {
        this.name = `${this.firstName} ${this.lastName}`.trim();
    }

    userSchema.methods.matchPassword = async function (enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
      };

    next();
});

module.exports = mongoose.model("User", userSchema);
