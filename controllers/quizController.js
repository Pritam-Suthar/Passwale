const { Quiz, UserResponse } = require("../models/Quiz");
const User = require("../models/User");
const mongoose = require("mongoose");

// ✅ Organizer creates a new quiz
exports.createQuiz = async (req, res) => {
    try {
        const { organizer, event, questions } = req.body;

        if (!organizer || !event || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: "All fields are required: organizer, event, and at least one question." });
        }

        // ✅ Check if the user is an Organizer
        const organizerUser = await User.findById(organizer);
        if (!organizerUser || organizerUser.role !== "organizer") {
            return res.status(403).json({ message: "Only organizers can create quizzes." });
        }

        const quiz = new Quiz({
            organizer,
            event,
            questions, // ✅ Storing an array of MCQs
        });

        await quiz.save();
        res.status(201).json({ message: "Quiz created successfully", quiz });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ Get quizzes for an event
exports.getQuizzes = async (req, res) => {
    try {
        const { eventId } = req.params;
        const quizzes = await Quiz.find({ event: eventId });

        res.status(200).json(quizzes);

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ✅ User answers a quiz
exports.answerQuiz = async (req, res) => {
    try {
        const { user, quizId, answers } = req.body;

        if (!user || !quizId || !answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ message: "All fields are required: user, quizId, and answers array." });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) return res.status(404).json({ message: "Quiz not found." });

        let totalRewards = 0;
        let userResponses = [];

        for (let answer of answers) {
            const { questionId, selectedAnswer } = answer;

            // Find the question in the quiz
            const question = quiz.questions.find(q => q._id.toString() === questionId);
            if (!question) {
                console.log(`❌ Question ID not found in quiz: ${questionId}`);
                return res.status(404).json({ message: "Question not found in quiz." });
            }

            console.log(`🔹 Checking question: ${questionId}`);
            console.log(`   🔹 Stored correctAnswer: ${question.correctAnswer}`);
            console.log(`   🔹 User selectedAnswer: ${selectedAnswer}`);

            const isCorrect = question.correctAnswer.trim().toLowerCase() === selectedAnswer.trim().toLowerCase();
            let rewardPoints = 0; // ✅ Default reward points to 0

            if (isCorrect) {
                rewardPoints = Number(question.rewardPoints) || 0; // ✅ Assign reward points only if correct
                totalRewards += rewardPoints;
                console.log(`✅ Correct! Added ${rewardPoints} points.`);
            } else {
                console.log(`❌ Incorrect answer.`);
            }

            // Store user response with rewardPoints
            userResponses.push({
                user,
                quiz: quizId,
                question: questionId,
                selectedAnswer,
                isCorrect,
                rewardPoints // ✅ Ensure rewardPoints is stored
            });
        }

        // Debug: Log responses before inserting
        console.log("🚀 Final user responses before saving:", userResponses);

        // Save all user responses in bulk
        await UserResponse.insertMany(userResponses);

        // Update user's reward points safely
        const userData = await User.findById(user);
        if (userData) {
            console.log(`🔹 Current user reward points: ${userData.rewardPoints}`);
            userData.rewardPoints = (Number(userData.rewardPoints) || 0) + totalRewards;
            await userData.save();
            console.log(`✅ Updated user reward points: ${userData.rewardPoints}`);
        }

        res.status(201).json({
            message: "Answers submitted successfully",
            totalRewards,
        });

    } catch (error) {
        console.error("❌ Error submitting quiz answers:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// ✅ Organizer gets user responses for a quiz or a user
exports.getUserResponses = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        console.log(`🔍 Received userId: ${userId}`);

        // Fetch all responses of the user
        const responses = await UserResponse.find({ user: userId })
            .select("quiz selectedAnswer isCorrect createdAt updatedAt") // Include `quiz` ID in response
            .populate({
                path: "quiz",
                select: "_id" // Only return quiz ID, no extra details
            });

        if (!responses.length) {
            return res.status(404).json({ message: "No responses found for this user." });
        }

        res.status(200).json(responses);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getUserLeaderboard = async (req, res) => {
    try {
        const userLeaderboard = await UserResponse.aggregate([
            {
                $group: {
                    _id: "$user", 
                    totalPoints: { $sum: "$rewardPoints" } // Sum all reward points for each user
                }
            },
            {
                $lookup: {
                    from: "users", // Ensure this matches your MongoDB collection name
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            {
                $unwind: "$userInfo"
            },
            {
                $project: {
                    _id: 0,
                    userId: "$userInfo._id",
                    name: "$userInfo.name",
                    email: "$userInfo.email",
                    totalPoints: 1
                }
            },
            {
                $sort: { totalPoints: -1 } // Sort by highest points
            }
        ]);

        console.log(userLeaderboard);
        res.status(200).json(userLeaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



