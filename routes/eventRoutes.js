const express = require("express");
const {
    createEvent, getEvents, updateEvent, deleteEvent,
    getEventsByOrganizer, getEventById, getAttendees,
    searchEvents, addAttendee
} = require("../controllers/eventController");
const { protect, adminOnly, adminOrOrganizerOnly, organizerOrAdminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getEvents); // ✅ Anyone can view events
router.get("/organizer", protect, adminOrOrganizerOnly, getEventsByOrganizer); // ✅ Only Admins & Organizers can see their events
router.get("/search", searchEvents); // ✅ Anyone can search events
router.get("/:id", getEventById); // ✅ Anyone can see event details

router.post("/", protect, adminOrOrganizerOnly, createEvent); // ✅ Only Admins & Organizers can create events
router.put("/:id", protect, organizerOrAdminOnly, updateEvent); // ✅ Only event owner or admin can update
router.delete("/:id", protect, organizerOrAdminOnly, deleteEvent); // ✅ Only event owner or admin can delete

router.post("/:eventId/attendees", protect, addAttendee); // ✅ Only logged-in users can register as attendees
router.get("/:id/attendees", protect, getAttendees); // ✅ Only event organizer & admin can view attendees

module.exports = router;
