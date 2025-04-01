const mongoose = require("mongoose");

const VolunteerSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    event: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Event", // ✅ Linking volunteer to a specific event
        required: true 
    },
    ratings: [{
        ratedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User" 
        },
        stars: { 
            type: Number, 
            min: 0, 
            max: 5, 
            required: true 
        },
        comment: { 
            type: String 
        }
    }],
    averageRating: { 
        type: Number, 
        default: 0 
    }
}, { timestamps: true });

// ✅ Pre-save middleware to calculate average rating
VolunteerSchema.pre("save", function (next) {
    if (this.ratings.length > 0) {
        const totalStars = this.ratings.reduce((sum, rating) => sum + rating.stars, 0);
        this.averageRating = totalStars / this.ratings.length;
    } else {
        this.averageRating = 0;
    }
    next();
});

module.exports = mongoose.model("Volunteer", VolunteerSchema);
