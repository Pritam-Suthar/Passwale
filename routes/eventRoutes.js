const express = require("express");
const {
    createEvent, getEvents, updateEvent, deleteEvent,
    getEventsByOrganizer, getEventById, getAttendees,
    searchEvents, addAttendee
} = require("../controllers/eventController");
const { protect, adminOnly, adminOrOrganizerOnly, organizerOrAdminOnly } = require("../middleware/authMiddleware");
const router = express.Router();
const upload = require('../config/multerConfig');

router.get("/", getEvents); // ✅ Anyone can view events
router.get("/organizer", protect, adminOrOrganizerOnly, getEventsByOrganizer); // ✅ Only Admins & Organizers can see their events
router.get("/search", searchEvents); // ✅ Anyone can search events
router.get("/:id", getEventById); // ✅ Anyone can see event details

router.post("/", protect, adminOrOrganizerOnly, upload.single('image'), createEvent); // ✅ Only Admins & Organizers can create events
router.put("/:id", protect, organizerOrAdminOnly, upload.single('image'), updateEvent); // ✅ Only event owner or admin can update
router.delete("/:id", protect, organizerOrAdminOnly, deleteEvent); // ✅ Only event owner or admin can delete

router.post("/:eventId/attendees", protect, addAttendee); // ✅ Only logged-in users can register as attendees
router.get("/:id/attendees", protect, getAttendees); // ✅ Only event organizer & admin can view attendees

router.post("/bookings", async (req, res) => {
    try {
      const newBooking = req.body; // Data from frontend
      console.log("Received booking:", newBooking);
      res.status(201).json({ success: true, booking: newBooking });
    } catch (err) {
      res.status(500).json({ error: "Booking failed" });
    }
  });

module.exports = router;
