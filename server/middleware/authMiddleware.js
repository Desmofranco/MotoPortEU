import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "motoport_secret";

const authMiddleware = async (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token mancante" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "Utente non trovato" });
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      passActive: user.passActive
    };

    next();

  } catch (error) {

    console.error("❌ Auth middleware error:", error.message);
    return res.status(401).json({ error: "Token non valido" });

  }
};

export default authMiddleware;