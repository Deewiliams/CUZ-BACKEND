const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const addressRoutes = require("./routes/addressRoutes");
const bankRoutes = require("./routes/bankRoutes");

const app = express();

// Enable CORS for all routes
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://soschoir.vercel.app",
      "https://soschoir-git-staging-desire-irankundas-projects.vercel.app",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true,
};

app.use(cors(corsOptions));

// Middleware to parse JSON
app.use(express.json());

// Basic route for testing
app.get("/", (req, res) => {
  res.json({
    message: "🚀 CUZ Banking API Server is running!",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes
app.use("/cuz/address", addressRoutes);
app.use("/cuz/bank", bankRoutes);

// Database connection configuration
const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const isVercel = process.env.VERCEL === "1";

    let mongoURI;

    if (isProduction || isVercel) {
      // Use cloud MongoDB for production/Vercel deployment
      mongoURI = process.env.MONGO_URI_CLOUD || process.env.MONGO_URI;
      console.log("🌐 Connecting to Cloud MongoDB...");
    } else {
      // Use local MongoDB for development
      mongoURI =
        process.env.MONGO_URI_LOCAL ||
        process.env.MONGO_URI ||
        "mongodb://localhost:27017/zambiabank";
      console.log("🏠 Connecting to Local MongoDB...");
    }

    const conn = await mongoose.connect(mongoURI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("❌ Database connection error:", error.message);

    // Fallback connection attempt
    if (process.env.MONGO_URI) {
      try {
        console.log("🔄 Attempting fallback connection...");
        const fallbackConn = await mongoose.connect(process.env.MONGO_URI);
        console.log(
          `✅ Fallback connection successful: ${fallbackConn.connection.host}`
        );
      } catch (fallbackError) {
        console.error("❌ Fallback connection failed:", fallbackError.message);
      }
    }
  }
};

// Connect to MongoDB and start server
connectDB().then(() => {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Local server: http://localhost:${PORT}`);
    console.log(`📋 API Base URL: http://localhost:${PORT}/cuz`);
    console.log(`📖 Test endpoint: http://localhost:${PORT}/`);
  });
});

module.exports = app;
