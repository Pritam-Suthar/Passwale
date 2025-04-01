const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

router.post("/chatroom", chatController.createChatRoom);
router.post("/message", chatController.sendMessage);
router.get("/messages/:chatRoomId", chatController.getMessages);

module.exports = router;
