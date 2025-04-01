const mongoose = require("mongoose");
const Volunteer = require("../models/Volunteer");
const User = require("../models/User");
const Event = require("../models/Event");
const { generateBadge, generateBadgePDF } = require("../utils/badgeGenerator");

exports.assignVolunteer = async (req, res) => {
    try {
        const { userId, eventId } = req.body;

        console.log("Assigning Volunteer:", { userId, eventId }); // ✅ Debug Log

        // 🛠️ Validate Object IDs
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ success: false, message: "Invalid userId or eventId" });
        }

        // 🔍 Check if User & Event Exist
        const user = await User.findById(userId);
        const event = await Event.findById(eventId);
        if (!user || !event) {
            return res.status(404).json({ success: false, message: "User or Event not found" });
        }

        // 🏷️ Check if User is Already a Volunteer for this Event
        let volunteer = await Volunteer.findOne({ user: userId, event: eventId });
        if (!volunteer) {
            volunteer = new Volunteer({ user: userId, event: eventId });
            await volunteer.save();
        }

        console.log("Volunteer Assigned:", volunteer); // ✅ Debug Log

         // 🎟️ Generate Badge for Volunteer
         user.role = "volunteer"; // Ensure role is correctly set
         const badgePath = await generateBadge(user, event);
         const badgePDFPath = await generateBadgePDF(badgePath, userId, eventId, "volunteer");
 
         return res.status(201).json({
             success: true,
             message: "Volunteer assigned successfully",
             volunteer,
             badgePath,  // ✅ Corrected variable name
             badgePDFPath // ✅ Corrected variable name
         }); 

    } catch (error) {
        console.error("Error assigning volunteer:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Rate a Volunteer
exports.rateVolunteer = async (req, res) => {
    try {
        const { volunteerId, stars, comment } = req.body;
        const ratedBy = req.user.id;
        
        if (!volunteerId || stars === undefined) {
            return res.status(400).json({ message: "Volunteer ID and stars are required" });
        }
        
        const volunteer = await Volunteer.findById(volunteerId);
        if (!volunteer) return res.status(404).json({ message: "Volunteer not found" });
        
        volunteer.ratings.push({ ratedBy, stars, comment });
        await volunteer.save();
        
        res.status(200).json({ message: "Rating submitted!" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get Volunteers with Ratings
exports.getVolunteers = async (req, res) => {
    try {
        const volunteers = await Volunteer.find().populate("user", "name email");
        res.status(200).json(volunteers);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ Get volunteers for a specific event
exports.getEventVolunteers = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: "Invalid event ID format" });
        }

        const volunteers = await Volunteer.find({ event: new mongoose.Types.ObjectId(eventId) })
            .populate("user", "name email")
            .exec();

        res.status(200).json({ success: true, volunteers });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ Get details of a specific volunteer
exports.getVolunteerDetails = async (req, res) => {
    try {
        const { volunteerId } = req.params;

        const volunteer = await Volunteer.findById(volunteerId)
            .populate("user", "name email rating") // ✅ Ensure 'userId' is populated
            .exec();

        if (!volunteer) {
            return res.status(404).json({ message: "Volunteer not found" });
        }

        res.status(200).json({ success: true, volunteer });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};