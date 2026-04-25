import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import cloudinary from "../utils/cloudinary.js";
import CommunityPost from "../models/CommunityPost.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function uploadToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "motoporteu/community",
        resource_type: "image",
        transformation: [
          { width: 1200, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    stream.end(fileBuffer);
  });
}

function authOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
}

function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return res.status(401).json({ ok: false, message: "Login richiesto" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token non valido" });
  }
}

router.get("/", authOptional, async (req, res) => {
  try {
    const posts = await CommunityPost.find({ active: true })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      ok: true,
      posts,
      currentUserId: req.user?.id || null,
    });
  } catch (err) {
    console.error("Community GET error:", err);
    res.status(500).json({ ok: false, message: "Errore caricamento community" });
  }
});

router.post("/", authRequired, upload.single("image"), async (req, res) => {
  try {
    const {
      type,
      name,
      region,
      city,
      bike,
      style,
      availability,
      contact,
      text,
    } = req.body;

    if (!type || !name || !region || !city || !text) {
      return res.status(400).json({ ok: false, message: "Dati obbligatori mancanti" });
    }

    let imageUrl = "";

    if (req.file?.buffer) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploaded.secure_url || "";
    }

    const post = await CommunityPost.create({
      userId: req.user.id,
      type,
      name,
      region,
      city,
      bike: bike || "",
      style: style || "",
      availability: availability || "",
      contact: contact || "",
      imageUrl,
      text,
      badge: type === "event" ? "Uscita" : "Community",
      active: true,
    });

    res.status(201).json({ ok: true, post });
  } catch (err) {
    console.error("Community POST error:", err);
    res.status(500).json({ ok: false, message: "Errore creazione annuncio" });
  }
});

router.put("/:id", authRequired, upload.single("image"), async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ ok: false, message: "Annuncio non trovato" });
    }

    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, message: "Non puoi modificare questo annuncio" });
    }

    let imageUrl = post.imageUrl || "";

    if (req.file?.buffer) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploaded.secure_url || imageUrl;
    }

    const updated = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        imageUrl,
        badge: req.body.type === "event" ? "Uscita" : "Community",
      },
      { new: true, runValidators: true }
    );

    res.json({ ok: true, post: updated });
  } catch (err) {
    console.error("Community PUT error:", err);
    res.status(500).json({ ok: false, message: "Errore modifica annuncio" });
  }
});

router.delete("/:id", authRequired, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ ok: false, message: "Annuncio non trovato" });
    }

    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, message: "Non puoi eliminare questo annuncio" });
    }

    post.active = false;
    await post.save();

    res.json({ ok: true, message: "Annuncio eliminato" });
  } catch (err) {
    console.error("Community DELETE error:", err);
    res.status(500).json({ ok: false, message: "Errore eliminazione annuncio" });
  }
});

export default router;