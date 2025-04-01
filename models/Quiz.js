const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema({
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    questions: [
        {
            question: { type: String, required: true },
            options: { type: [String], required: true },
            correctAnswer: { type: String, required: true },
            rewardPoints: { type: Number, default: 0 }
        }
    ],
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const UserResponseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    question: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    rewardPoints: { type: Number, default: 0 },
}, { timestamps: true });

const Quiz = mongoose.model("Quiz", QuizSchema);
const UserResponse = mongoose.model("UserResponse", UserResponseSchema);

module.exports = { Quiz, UserResponse };
