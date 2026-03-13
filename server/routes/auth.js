import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function buildUserResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPremium: user.isPremium,
    passActive: user.passActive,
    trialActive: user.trialActive,
    trialExpires: user.trialExpires,
  };
}

// ===============================
// REGISTER
// ===============================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(400).json({ error: "Utente già registrato" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Demo gratuita 10 giorni
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "user",
      isPremium: false,
      passActive: false,
      trialActive: true,
      trialExpires,
    });

    const token = signToken(user);

    return res.status(201).json({
      message: "Registrazione completata",
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    return res.status(500).json({ error: "Errore server in registrazione" });
  }
});

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password obbligatorie" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(400).json({ error: "Credenziali non valide" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Credenziali non valide" });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Login effettuato",
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ error: "Errore server in login" });
  }
});

// ===============================
// REFRESH TOKEN
// ===============================
router.get("/refresh-token", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    const newToken = signToken(user);

    return res.status(200).json({
      token: newToken,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("❌ Refresh token error:", error);
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
});

export default router;