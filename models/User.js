const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
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
        console.log("Hashing password for:", this.email);
        this.password = await bcrypt.hash(this.password, 10);
    }

    if (!this.referralCode) {
        this.referralCode = crypto.randomBytes(4).toString("hex"); // Generates a unique referral code
    }

    next();
});

// ✅ Password Verification Method
userSchema.methods.matchPassword = async function (enteredPassword) {
    console.log("Entered Password:", enteredPassword);
    console.log("Stored Hashed Password:", this.password);
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log("Password Match Result:", isMatch);
    return isMatch;
};

module.exports = mongoose.model("User", userSchema);
