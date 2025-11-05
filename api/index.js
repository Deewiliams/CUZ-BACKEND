const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const addressRoutes = require("../routes/addressRoutes");
const bankRoutes = require("../routes/bankRoutes");

const app = express();

// Enable CORS for all routes
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://soschoir.vercel.app",
      "https://soschoir-git-staging-desire-irankundas-projects.vercel.app",
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all localhost origins in development
    if (process.env.NODE_ENV !== "production" && origin.includes("localhost")) {
      return callback(null, true);
    }

    // Check allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200, // Support legacy browsers
};

app.use(cors(corsOptions));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${
      req.get("Origin") || "No origin"
    }`
  );
  next();
});

// Middleware to parse JSON
app.use(express.json());

// Basic route for testing
app.get("/", (req, res) => {
  res.json({
    message: "🚀 CUZ Banking API is live on Vercel!",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
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
      console.log("Connecting to Cloud MongoDB...");
    } else {
      // Use local MongoDB for development
      mongoURI =
        process.env.MONGO_URI_LOCAL ||
        process.env.MONGO_URI ||
        "mongodb://localhost:27017/zambiabank";
      console.log("Connecting to Local MongoDB...");
    }

    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("Database connection error:", error.message);

    // Fallback connection attempt
    if (process.env.MONGO_URI) {
      try {
        console.log("Attempting fallback connection...");
        const fallbackConn = await mongoose.connect(process.env.MONGO_URI);
        console.log(
          `Fallback connection successful: ${fallbackConn.connection.host}`
        );
      } catch (fallbackError) {
        console.error(" Fallback connection failed:", fallbackError.message);
      }
    }
  }
};

// Connect to MongoDB
connectDB();

// Export the Express app for Vercel
module.exports = app;
