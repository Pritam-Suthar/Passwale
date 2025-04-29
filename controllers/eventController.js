const Event = require("../models/Event");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { generateBadge, generateBadgePDF } = require("../utils/badgeGenerator");
const fs = require('fs').promises;
const path = require('path');

exports.createEvent = async (req, res) => {
    try {
        // Debug: Log incoming request
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        // Validate required fields
        const { name, date, time, location, description, ticketTypes } = req.body;
        if (!name || !date || !time || !location || !description) {
            // Clean up uploaded file if validation fails
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: "All fields are required!",
                receivedFields: {
                    name: !!name,
                    date: !!date,
                    time: !!time,
                    location: !!location,
                    description: !!description
                }
            });
        }

        // Convert Date & Time to UTC
        const [hours, minutes] = time.split(":").map(Number);
        const eventDateTime = new Date(`${date}T00:00:00.000Z`);
        eventDateTime.setUTCHours(hours, minutes, 0, 0);

        // Check user role
        if (req.user.role !== "organizer") {
            return res.status(403).json({
                success: false,
                message: "Only organizers can create events."
            });
        }

        // Parse ticketTypes if it's a string
        let parsedTicketTypes = ticketTypes;
        if (typeof ticketTypes === 'string') {
            try {
                parsedTicketTypes = JSON.parse(ticketTypes);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid ticket types format"
                });
            }
        }

        const event = new Event({
            name,
            datetime: eventDateTime,
            location,
            description,
            ticketTypes: parsedTicketTypes,
            organizer: req.user.id,
            image: req.file ? `/event_images/${req.file.filename}` : null
        });

        await event.save();

        // 🎟️ Generate Badge for Organizer
        const badgePath = await generateBadge(req.user, event);
        const badgePDFPath = await generateBadgePDF(badgePath, req.user.id, event._id, "organizer");

        res.status(201).json({
            success: true,
            message: "Event created successfully",
            event,
            badgePath,
            badgePDFPath
        });

    } catch (error) {
        console.error("Create Event Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ datetime: 1 }).lean();

        const formattedEvents = events.map(event => ({
            ...event,
            eventName: event.name,
            startDate: event.datetime ? new Date(event.datetime).toISOString() : new Date().toISOString(),
            endDate: event.endDate ? new Date(event.endDate).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            image: event.image ? `${req.protocol}://${req.get('host')}${event.image}` : `${req.protocol}://${req.get('host')}/default-event.jpg`,
            eventType: event.eventType || 'General',
            eventMode: event.eventMode || 'In-Person'
        }));
        res.status(200).json({
            success: true,
            count: formattedEvents.length,
            data: formattedEvents
        });

    } catch (error) {
        console.error("Get Events Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve events",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.updateEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        console.log('--- UPDATE EVENT REQUEST ---');
        console.log('Headers:', req.headers);
        console.log('Params:', req.params);
        console.log('Body:', req.body);
        console.log('File:', req.file ? {
            originalname: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        } : null);

        const { id } = req.params;

        // 1. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ 
                success: false,
                message: "Invalid event ID format",
                error: `Received ID: ${id}`
            });
        }

        // 2. Find existing event with session
        const existingEvent = await Event.findById(id).session(session);
        if (!existingEvent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ 
                success: false,
                message: "Event not found",
                id: id
            });
        }

        // 3. Authorization check (uncommented and improved)
        if (req.user.role !== "admin" && existingEvent.organizer.toString() !== req.user.id) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ 
                success: false,
                message: "Not authorized to update this event",
                userRole: req.user.role,
                organizerId: existingEvent.organizer.toString(),
                userId: req.user.id
            });
        }

        // 4. Prepare update data with validation
        const updateData = {
            name: req.body.name?.trim(),
            description: req.body.description?.trim(),
            location: req.body.location?.trim()
        };

        // 5. Handle date/time with validation
        if (req.body.date && req.body.time) {
            try {
                const dateTimeString = `${req.body.date.trim()} ${req.body.time.trim()}`;
                const dateTime = moment.tz(
                    dateTimeString,
                    "YYYY-MM-DD HH:mm",
                    "Asia/Kolkata"
                );

                if (!dateTime.isValid()) {
                    throw new Error(`Invalid datetime: ${dateTimeString}`);
                }
                
                updateData.datetime = dateTime.toDate();
            } catch (dateError) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: "Invalid date/time format",
                    received: {
                        date: req.body.date,
                        time: req.body.time
                    },
                    expectedFormat: "YYYY-MM-DD HH:mm"
                });
            }
        }

        // 6. Handle image upload with verification
        if (req.file) {
            try {
                // Verify file was saved correctly
                const newImagePath = path.join(__dirname, '../public/event_images', req.file.filename);
                try {
                    await fs.promises.access(newImagePath, fs.constants.F_OK);
                } catch (accessError) {
                    throw new Error(`Uploaded file not found at: ${newImagePath}`);
                }

                updateData.image = `/event_images/${req.file.filename}`;
                
                // Delete old image if different (async)
                if (existingEvent.image && existingEvent.image !== updateData.image) {
                    const oldPath = path.join(__dirname, '../public', existingEvent.image);
                    if (fs.existsSync(oldPath)) {
                        fs.unlink(oldPath, (err) => {
                            if (err) console.error('Old image deletion error:', err);
                        });
                    }
                }
            } catch (fileError) {
                await session.abortTransaction();
                session.endSession();
                
                // Clean up failed upload
                if (req.file) {
                    const tempPath = path.join(__dirname, '../public/event_images', req.file.filename);
                    if (fs.existsSync(tempPath)) {
                        await fs.promises.unlink(tempPath);
                    }
                }
                
                return res.status(500).json({
                    success: false,
                    message: "Image processing failed",
                    error: process.env.NODE_ENV === 'development' ? fileError.message : undefined,
                    file: {
                        originalname: req.file.originalname,
                        filename: req.file.filename
                    }
                });
            }
        }

        // 7. Perform the update with transaction
        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            updateData,
            { 
                new: true,
                runValidators: true,
                session,
                context: 'query' // Important for proper validation
            }
        ).populate('organizer', 'name email');

        if (!updatedEvent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: "Update operation failed - no event returned"
            });
        }

        await session.commitTransaction();
        session.endSession();

        // 8. Prepare and send response
        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            data: {
                ...updatedEvent.toObject(),
                datetime: updatedEvent.datetime?.toISOString(),
                // Include other date fields if needed
                image: updatedEvent.image ? 
                    `${req.protocol}://${req.get('host')}${updatedEvent.image}` : 
                    null
            }
        });

    } catch (error) {
        // Handle transaction cleanup
        if (session.inTransaction()) {
            await session.abortTransaction();
            session.endSession();
        }

        console.error('FINAL UPDATE ERROR:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            body: req.body,
            file: req.file
        });

        // Clean up uploaded file if exists
        if (req.file) {
            try {
                const tempPath = path.join(__dirname, '../public/event_images', req.file.filename);
                if (fs.existsSync(tempPath)) {
                    await fs.promises.unlink(tempPath);
                }
            } catch (cleanupError) {
                console.error('File cleanup failed:', cleanupError);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error during update",
            error: process.env.NODE_ENV === 'development' ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
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

// exports.getEventById = async (req, res) => {
//     try {
//         const { id } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid event ID format"
//             });
//         }

//         const event = await Event.findById(id).populate("organizer", "name email");

//         if (!event) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Event not found"
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: {
//                 ...event.toObject(),
//                 startDate: event.datetime.toISOString(),
//                 endDate: event.endDate ? event.endDate.toISOString() : new Date(event.datetime.getTime() + 2 * 60 * 60 * 1000).toISOString()
//             }
//         });

//     } catch (error) {
//         console.error("Get Event Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal server error"
//         });
//     }
// };

exports.getEventById = async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
  
      // Construct full image URL
      const imageUrl = event.image 
        ? `${req.protocol}://${req.get('host')}${event.image}`
        : `${req.protocol}://${req.get('host')}/default-event.jpg`;
  
      res.status(200).json({
        success: true,
        data: {
          ...event.toObject(),
          image: imageUrl  // Send complete URL to frontend
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
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



