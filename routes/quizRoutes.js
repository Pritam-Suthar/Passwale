const express = require("express");
const router = express.Router();
const { createQuiz, getQuizzes, answerQuiz, getUserResponses, getUserLeaderboard } = require("../controllers/quizController");

// Organizer creates a quiz
router.post("/create", createQuiz);

// Users fetch available quizzes
router.get("/list/:eventId", getQuizzes);

// Users submit an answer
router.post("/answer", answerQuiz);

// Organizer retrieves user responses
router.get("/responses/:userId", getUserResponses);

router.get("/leaderboard", getUserLeaderboard);


module.exports = router;
