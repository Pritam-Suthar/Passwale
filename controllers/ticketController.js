const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Event = require("../models/Event");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs-extra");
const { generateBadge, generateBadgePDF } = require("../utils/badgeGenerator"); // ✅ Import it correctly
const Discount = require("../models/Discount"); 

// 📌 Book Ticket & Generate QR Code
exports.bookTicket = async (req, res) => {
    try {
        const { eventId, userId, ticketType, price, discountCode } = req.body;

        if (!eventId || !userId || !ticketType || !price) {
            return res.status(400).json({ message: "All fields are required: eventId, userId, ticketType, price" });
        }

        // Fetch user and event details
        const user = await User.findById(userId);
        const event = await Event.findById(eventId);
        if (!user || !event) return res.status(404).json({ message: "User or Event not found" });

        let finalPrice = price; // Default price (before discount)

         // ✅ Check if a discount code is applied
         if (discountCode) {
            const discount = await Discount.findOne({ 
                code: { $regex: new RegExp(`^${discountCode}$`, "i") }, 
                event: eventId,
                isActive: true,
                expiryDate: { $gte: new Date() }, // Not expired
            });

            if (!discount) {
                return res.status(400).json({ message: "Invalid discount code" });
            }

            // Check if the discount is still valid
            const now = new Date();
            if (now < discount.startDate || now > discount.endDate) {
                return res.status(400).json({ message: "Discount code expired or not active" });
            }

            // ✅ Apply Discount (either percentage or fixed amount)
            if (discount.discountType === "percentage") {
                finalPrice = finalPrice - (finalPrice * discount.value) / 100;
            } else if (discount.discountType === "flat") {
                finalPrice = Math.max(0, finalPrice - discount.value);
            }

            // ✅ Increase discount usage count
            discount.usedCount += 1;
            if (discount.maxUsage > 0 && discount.usedCount >= discount.maxUsage) {
                discount.isActive = false; // Disable if max usage reached
            }
            await discount.save();
        }

        // Create and save the ticket
        const ticket = new Ticket({
            event: eventId,
            user: userId,
            ticketType,
            price: finalPrice,
            status: "Booked",
        });

        await ticket.save();

        // ✅ Generate QR Code (Ticket URL)
        const ticketUrl = `http://localhost:3000/api/tickets/${ticket._id}`;

        // ✅ Generate Badge
        const badgePath = await generateBadge(user, event, ticket);
        ticket.badge = badgePath;
        await ticket.save();

        // ✅ Generate Badge PDF
        const badgePdfPath = await generateBadgePDF(badgePath, ticket._id);
        ticket.badgePdf = badgePdfPath;
        await ticket.save();

        // ✅ Referral Reward System
        if (user.referredBy) {
            const referrer = await User.findById(user.referredBy);
            if (referrer) {
                referrer.rewardPoints = (referrer.rewardPoints || 0) + 10; // Reward 10 points for a successful booking
                await referrer.save();
            }
        }

        res.status(201).json({
            message: "Ticket booked successfully",
            ticket: {
                _id: ticket._id,
                event: ticket.event,
                user: ticket.user,
                ticketType: ticket.ticketType,
                price: finalPrice,
                status: ticket.status,
                badge: `http://localhost:3000${badgePath}`, // Badge URL
                badgePdf: `http://localhost:3000${badgePdfPath}`, // ✅ Badge PDF URL
            },
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.validateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticket = await Ticket.findById(ticketId);

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found." });
        }

        if (ticket.status === "Checked-in") {
            return res.status(400).json({ message: "Ticket already checked in." });
        }

        if (ticket.status === "Cancelled") {
            return res.status(400).json({ message: "Ticket is cancelled." });
        }

        // ✅ Mark ticket as Checked-in
        ticket.status = "Checked-in";
        await ticket.save();

        res.status(200).json({ message: "Ticket successfully checked in.", ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 📌 Get Ticket Details (When QR Code is Scanned)
exports.getTicketDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const ticket = await Ticket.findById(id)
            .populate({
                path: "user",
                select: "name email" // ✅ Only send name & email of the user
            });

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        res.status(200).json({
            ticket: {
                _id: ticket._id,
                event: ticket.event,
                user: ticket.user,
                ticketType: ticket.ticketType,
                price: ticket.price,
                status: ticket.status,
                qrCode: `http://localhost:3000/qrcodes/${ticket._id}.png`, // Full URL
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 📌 Request Ticket Cancellation
exports.cancelTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }

        if (ticket.status === "Cancelled") {
            return res.status(400).json({ message: "Ticket is already cancelled" });
        }

        // Refund logic based on ticket type
        let refundPercentage = 0;
        const currentDate = new Date();
        const eventDate = new Date(ticket.event.date);
        const daysBeforeEvent = Math.ceil((eventDate - currentDate) / (1000 * 60 * 60 * 24));

        if (ticket.ticketType === "Early Bird" && daysBeforeEvent >= 7) {
            refundPercentage = 50;
        } else if (ticket.ticketType === "Regular" && daysBeforeEvent >= 3) {
            refundPercentage = 75;
        } else if (ticket.ticketType === "VIP") {
            refundPercentage = 0;
        }

        ticket.status = "Cancelled";
        await ticket.save();

        res.status(200).json({
            message: "Ticket cancelled successfully",
            refundPercentage,
            ticket,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 📌 Get Refund Policy
exports.getRefundPolicy = async (req, res) => {
    try {
        const refundPolicy = {
            "Early Bird": "50% refund if canceled 7 days before the event.",
            "Regular": "75% refund if canceled 3 days before the event.",
            "VIP": "No refund after booking."
        };

        res.status(200).json({ refundPolicy });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
