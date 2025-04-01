const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // Discount code (e.g., "SUMMER25")
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true }, // Associated event
    discountType: { type: String, enum: ["percentage", "flat"], required: true }, // Type: % or flat
    value: { type: Number, required: true }, // Discount amount (e.g., 25% or ₹100)
    maxUsage: { type: Number, default: 0 }, // Max times the code can be used (0 = unlimited)
    usedCount: { type: Number, default: 0 }, // Times the code has been used
    expiryDate: { type: Date, required: true }, // Expiry date of the discount
    isActive: { type: Boolean, default: true }, // Status of the discount
});

module.exports = mongoose.model("Discount", DiscountSchema);
