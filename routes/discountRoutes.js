const express = require("express");
const router = express.Router();
const Discount = require("../models/Discount");

// ✅ Add a discount code
router.post("/add", async (req, res) => {
    try {
        const { code, event, discountType, value, maxUsage, expiryDate } = req.body;

        // Check if discount code already exists
        const existingDiscount = await Discount.findOne({ code });
        if (existingDiscount) {
            return res.status(400).json({ message: "Discount code already exists" });
        }

        const discount = new Discount({
            code,
            event,
            discountType,
            value,
            maxUsage,
            expiryDate,
        });

        await discount.save();

        res.status(201).json({ message: "Discount code added successfully", discount });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
