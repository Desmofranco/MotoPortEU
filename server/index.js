import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import stripeRoutes from "./routes/stripe.js";
import stripeWebhookRoutes from "./routes/stripeWebhook.js";

dotenv.config();

const app = express();

// CORS
app.use(cors());

// ⚠️ Stripe webhook PRIMA del parser JSON
app.use("/api/stripe", stripeWebhookRoutes);

// Parser JSON per tutte le altre route
app.use(express.json());

// Auth
app.use("/api/auth", authRoutes);

// Stripe routes (checkout)
app.use("/api/stripe", stripeRoutes);

const PORT = process.env.PORT || 10000;

// Test server
app.get("/", (req, res) => {
  res.send("🏍️ MotoPortEU server running");
});

// Connessione Mongo
console.log("🔎 Tentativo connessione Mongo...");
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🏍️ MotoPortEU server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });