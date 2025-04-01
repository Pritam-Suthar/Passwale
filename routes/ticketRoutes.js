const express = require("express");
const { bookTicket, getTicketDetails, validateTicket, cancelTicket, getRefundPolicy} = require("../controllers/ticketController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/book", protect, bookTicket);
router.post("/validate/:ticketId", validateTicket);
router.post("/:id/cancel", cancelTicket);
router.get("/refund-policy", getRefundPolicy);
router.get("/:id", getTicketDetails);

module.exports = router;
