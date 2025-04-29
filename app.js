const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
const multer = require('multer');

dotenv.config();
connectDB();

const app = express();

//Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// ✅ Serve the public folder so QR codes are accessible
app.use("/public", express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/event_images', express.static(path.join(__dirname, 'public/event_images')));

// ✅ API Routes
app.use("/api/users", require("./routes/authRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/discounts", require("./routes/discountRoutes"));
app.use("/api/quiz", require("./routes/quizRoutes"));
app.use("/api", require("./routes/chatRoutes"));
app.use("/api/volunteers", require("./routes/volunteerRoutes"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum 10MB allowed.'
      });
    }
    // Handle other Multer errors
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next(err);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(5000, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

