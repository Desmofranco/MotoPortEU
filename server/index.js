import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import stripeRoutes from "./routes/stripe.js";
import stripeWebhookRoutes from "./routes/stripeWebhook.js";
import communityRoutes from "./routes/community.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://motoporteu.app",
  "https://www.motoporteu.app",
  "https://motoporteu.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

// CORS prima di tutte le route
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS non autorizzato: ${origin}`));
    },
    credentials: true,
  })
);

// Stripe webhook PRIMA del parser JSON
app.use("/api/stripe", stripeWebhookRoutes);

// Parser JSON per tutte le altre route
app.use(express.json());

// Test server
app.get("/", (req, res) => {
  res.send("🏍️ MotoPortEU server running");
});

// Auth
app.use("/api/auth", authRoutes);

// Stripe routes checkout
app.use("/api/stripe", stripeRoutes);

// Community
app.use("/api/community", communityRoutes);

const PORT = process.env.PORT || 10000;

console.log("🔎 Tentativo connessione Mongo...");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🏍️ MotoPortEU server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });