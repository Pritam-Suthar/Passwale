const mongoose = require("mongoose");

const ChatroomSchema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true }, // Chatroom Name (e.g., "Tech Fest 2025")
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isGroupChat: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ChatRoom", ChatroomSchema);
