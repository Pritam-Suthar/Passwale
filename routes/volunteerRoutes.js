const express = require("express");
const router = express.Router();
const { assignVolunteer, rateVolunteer, getVolunteers, getEventVolunteers, getVolunteerDetails } = require("../controllers/volunteerController");
const { protect } = require("../middleware/authMiddleware"); // ✅ Correctly import protect

router.post("/assign", protect, assignVolunteer); // ✅ Use protect middleware
router.post("/rate", protect, rateVolunteer);
router.get("/all", getVolunteers);
router.get("/event/:eventId", protect, getEventVolunteers);
router.get("/:volunteerId", protect, getVolunteerDetails);

module.exports = router;
