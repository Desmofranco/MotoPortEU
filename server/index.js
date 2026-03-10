import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "MotoPortEU" });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("MotoPortEU server running on", PORT);
});