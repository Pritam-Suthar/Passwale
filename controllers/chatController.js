const ChatRoom = require("../models/Chatroom");
const Message = require("../models/Message");
const mongoose = require("mongoose");   

// ✅ Create a Chat Room (Between Two Users)
exports.createChatRoom = async (req, res) => {
    try {
        const { user1, user2, event, name } = req.body;

        if (!user1 || !user2 || !event || !name) {
            return res.status(400).json({ message: "All fields (user1, user2, event, name) are required." });
        }

        let chatRoom = await ChatRoom.findOne({ users: { $all: [user1, user2] }, event });

        if (!chatRoom) {
            chatRoom = new ChatRoom({ users: [user1, user2], event, name });
            await chatRoom.save();
        }

        res.status(201).json({ message: "Chat room created/found", chatRoomId: chatRoom._id });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ Send a Message
exports.sendMessage = async (req, res) => {
    try {
        const { chatroom, sender, message } = req.body;

        if (!chatroom || !sender || !message) {
            return res.status(400).json({ message: "chatroom, sender, and message are required." });
        }

        // ✅ Check if the ChatRoom exists
        const chatRoomExists = await ChatRoom.findById(chatroom);
        if (!chatRoomExists) {
            return res.status(404).json({ message: "Chat Room not found" });
        }

        // ✅ Save the message with chatroom ID
        const newMessage = new Message({
            chatroom, // ✅ Correct field name
            sender,
            message,
        });

        await newMessage.save();

        res.status(201).json({ message: "Message sent successfully", newMessage });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ Get Messages of a Chat Room
exports.getMessages = async (req, res) => {
    try {
        const { chatRoomId } = req.params; 

        if (!chatRoomId) {
            return res.status(400).json({ message: "Chat Room ID is required" });
        }

        // Ensure ObjectId conversion
        const chatroomObjectId = new mongoose.Types.ObjectId(chatRoomId);

        // Fetch messages linked to this chatroom
        const messages = await Message.find({ chatroom: chatroomObjectId })
            .populate("sender", "name email")
            .sort({ createdAt: 1 });

        console.log("📩 Retrieved Messages:", messages);

        res.status(200).json(messages);
    } catch (error) {
        console.error("❌ Error fetching messages:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



