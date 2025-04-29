const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Event = require("../models/Event")

// ✅ Protect route (Require Login)
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];

            // Decode token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find user by ID and exclude password
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({ message: "User not found" });
            }
            
            next();
        } catch (error) {
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    } else {
        res.status(401).json({ message: "Not authorized, no token" });
    }
};

// ✅ Admin Only Middleware
exports.adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
};

// ✅ Admin or Organizer Middleware (Only they can create events)
exports.adminOrOrganizerOnly = (req, res, next) => {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "organizer")) {
        return res.status(403).json({ message: "Access denied. Only Admins & Organizers can create events." });
    }
    next();
};

// ✅ Only Event Organizer or Admin Can Modify Event
exports.organizerOrAdminOnly = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Allow only the event organizer or admin to edit/delete
        if (req.user.role !== "admin" && event.organizer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied. You can only modify your own events." });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
