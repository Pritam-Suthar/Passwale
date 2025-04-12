const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

// ✅ Serve the public folder so QR codes are accessible
app.use("/public", express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ✅ API Routes
app.use("/api/users", require("./routes/authRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/discounts", require("./routes/discountRoutes"));
app.use("/api/quiz", require("./routes/quizRoutes"));
app.use("/api", require("./routes/chatRoutes"));
app.use("/api/volunteers", require("./routes/volunteerRoutes"));

// Handle 404 Errors
app.use((req, res) => {
    res.status(404).json({ message: "API route not found" });
});

const PORT = process.env.PORT || 5000;

app.listen(5000, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

