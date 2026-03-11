import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "motoport_secret";

function getPremiumState(user) {
  return (
    user?.role === "premium" ||
    user?.isPremium === true ||
    user?.passActive === true
  );
}

function signToken(user) {
  const premiumActive = getPremiumState(user);

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || "user",
      isPremium: premiumActive,
      passActive: premiumActive,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function buildUserPayload(user) {
  const premiumActive = getPremiumState(user);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    isPremium: premiumActive,
    passActive: premiumActive,
    premiumActivatedAt: user.premiumActivatedAt || null,
    premiumExpiredAt: user.premiumExpiredAt || null,
  };
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Utente già registrato" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name || "").trim(),
      email: normalizedEmail,
      password: hash,
    });

    const token = signToken(user);

    return res.json({
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Errore server" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Utente non trovato" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Password errata" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Errore server" });
  }
});

// AUTH CHECK
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Token mancante" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    return res.json({
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(401).json({ message: "Token non valido" });
  }
});

// REFRESH TOKEN
router.get("/refresh-token", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Token mancante" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato" });
    }

    const newToken = signToken(user);

    return res.json({
      token: newToken,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("REFRESH TOKEN ERROR:", err);
    return res.status(401).json({ message: "Token non valido" });
  }
});

export default router;