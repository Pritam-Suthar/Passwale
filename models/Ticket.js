const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    ticketType: {
        type: String,
        enum: ["Early Bird", "Regular", "VIP"],
        required: true,
    },
    price: { type: Number, required: true },
    finalPrice: { type: Number }, // Price after discounts
    status: {
        type: String,
        enum: ["Active", "Booked", "Checked-in", "Cancelled", "Refunded"],
        default: "Booked",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    qrCode: { type: String }, // Path to QR code
    badge: { type: String },  // Path to generated badge
});

module.exports = mongoose.model("Ticket", ticketSchema);
