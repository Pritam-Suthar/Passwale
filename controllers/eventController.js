const Event = require("../models/Event");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { generateBadge, generateBadgePDF } = require("../utils/badgeGenerator");

exports.createEvent = async (req, res) => {
    try {
        const { name, date, time, location, description, ticketTypes } = req.body;

        if (!name || !date || !time || !location || !description || !ticketTypes) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // 🛠 Convert Date & Time to UTC Properly
        const [hours, minutes] = time.split(":").map(Number);
        const eventDateTime = new Date(`${date}T00:00:00.000Z`);
        eventDateTime.setUTCHours(hours, minutes, 0, 0);

        // Ensure that the logged-in user is an organizer
        if (req.user.role !== "organizer") {
            return res.status(403).json({ message: "Only organizers can create events." });
        }

        const event = new Event({
            name,
            datetime: eventDateTime,
            location,
            description,
            ticketTypes,
            organizer: req.user.id,
        });

        await event.save();

        // 🎟️ Generate Badge for Organizer
        const badgePath = await generateBadge(req.user, event);
        const badgePDFPath = await generateBadgePDF(badgePath, req.user.id, event._id, "organizer");

        res.status(201).json({ 
            message: "Event created successfully", 
            event, 
            badgePath,  // ✅ Organizer badge path
            badgePDFPath // ✅ Organizer badge PDF path
        });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const events = await Event.find().populate("organizer", "name email").lean();

        if (events.length === 0) {
            console.warn("⚠️ No events found.");
        }

        const formattedEvents = events.map(event => {
            let updatedEvent = { ...event };

            if (event.datetime) {
                console.log("📅 Before Formatting:", event.datetime);

                // ✅ Convert datetime to IST (Indian Standard Time)
                event.datetimeFormatted = new Date(event.datetime).toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                });

                console.log("✅ After Formatting:", event.datetimeFormatted);
            } else {
                console.warn("⚠️ Event missing datetime:", event);
                updatedEvent.datetimeFormatted = "Invalid Date";
            }

            return updatedEvent;
        });

        res.status(200).json(formattedEvents);
    } catch (error) {
        console.error("❌ Error fetching events:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        console.log("Event model:", Event); // Debug the model
        console.log("Event methods:", Object.keys(Event)); // Check available functions
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        // Prevent overwriting the `_id`
        delete req.body._id;

        // Merge `date` and `time` into a full `datetime` with the correct timezone
        if (req.body.date && req.body.time) {
            const localDatetime = moment.tz(
                `${req.body.date} ${req.body.time}`,
                "YYYY-MM-DD HH:mm",
                "Asia/Kolkata" // Set the correct timezone for India (or change based on your region)
            ).toISOString();
            req.body.datetime = localDatetime; // Save in UTC
        }

        const updatedEvent = await Event.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error("Update Event Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        await Event.findByIdAndDelete(id);
        res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getEventsByOrganizer = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authorized" });
        }

        const events = req.user.role === "admin"
            ? await Event.find({})
            : await Event.find({ organizer: req.user._id });
        res.status(200).json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        const event = await Event.findById(id).populate("organizer", "name email");
        if (!event) {
            // console.warn("⚠️ Event not found for ID:", id);
            return res.status(404).json({ message: "Event not found" });
        }

        res.status(200).json(event);
    } catch (error) {
        console.error("❌ Error fetching event:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.addAttendee = async (req, res) => {
    try {
        const { eventId } = req.params;  // Get event ID from URL params
        const { userId } = req.body;     // Get user ID from request body

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if the user is already an attendee
        if (event.attendees.includes(userId)) {
            return res.status(400).json({ message: "User already registered for this event" });
        }

        // Add user to attendees list
        const updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            { $addToSet: { attendees: userId } },
            { new: true }
        );

        res.status(200).json({ message: "User added as an attendee", event });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getAttendees = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate("attendees", "name email");
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json(event.attendees);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.searchEvents = async (req, res) => {
    try {
        const { keyword } = req.query;

        if (!keyword) {
            return res.status(400).json({ message: "Keyword is required for search" });
        }

        // Search by name or description (case-insensitive)
        const events = await Event.find({
            $or: [
                { name: { $regex: keyword, $options: "i" } },
                { description: { $regex: keyword, $options: "i" } }
            ]
        });

        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



