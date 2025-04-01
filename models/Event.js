const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    datetime: { type: Date, required: true },
    location: { type: String, required: true },
    image: { type: String },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true  },
    
    status: { type: String, enum: ["Draft", "Published", "Private"], default: "Draft" },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    ticketTypes: [
        {
            ticketType: { type: String, enum: ["Early Bird", "Regular", "VIP"], required: true, default: "Regular" },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
