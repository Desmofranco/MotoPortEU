import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI;

/*
---------------------------------------
CHECK ENV
---------------------------------------
*/
if (!MONGO_URI) {
  console.error("❌ MONGODB_URI non definita nelle variabili ENV");
  process.exit(1);
}

console.log("🔎 Tentativo connessione Mongo...");

/*
---------------------------------------
MONGODB CONNECTION
---------------------------------------
*/
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

/*
---------------------------------------
HEALTH CHECK
---------------------------------------
*/
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "MotoPortEU",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "not connected",
  });
});

/*
---------------------------------------
SERVER START
---------------------------------------
*/
app.listen(PORT, () => {
  console.log(`🏍️ MotoPortEU server running on port ${PORT}`);
});