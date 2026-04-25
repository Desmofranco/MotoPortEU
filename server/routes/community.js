import express from "express";
import CommunityPost from "../models/CommunityPost.js";

const router = express.Router();

// GET annunci community
router.get("/", async (req, res) => {
  try {
    const { type, region, city, q } = req.query;

    const filter = { active: true };

    if (type && type !== "all") filter.type = type;
    if (region && region !== "Tutte") filter.region = region;
    if (city && city !== "Tutte") filter.city = city;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { region: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
        { bike: { $regex: q, $options: "i" } },
        { style: { $regex: q, $options: "i" } },
        { availability: { $regex: q, $options: "i" } },
        { contact: { $regex: q, $options: "i" } },
        { text: { $regex: q, $options: "i" } },
      ];
    }

    const posts = await CommunityPost.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ ok: true, posts });
  } catch (err) {
    console.error("Community GET error:", err);
    res.status(500).json({ ok: false, message: "Errore caricamento community" });
  }
});

// CREA annuncio
router.post("/", async (req, res) => {
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
      imageUrl,
      text,
      userId,
    } = req.body;

    if (!type || !name || !region || !city || !text) {
      return res.status(400).json({
        ok: false,
        message: "Dati obbligatori mancanti",
      });
    }

    const post = await CommunityPost.create({
      userId: userId || undefined,
      type,
      name,
      region,
      city,
      bike: bike || "",
      style: style || "",
      availability: availability || "",
      contact: contact || "",
      imageUrl: imageUrl || "",
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

// MODIFICA annuncio
router.put("/:id", async (req, res) => {
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
      imageUrl,
      text,
    } = req.body;

    if (!type || !name || !region || !city || !text) {
      return res.status(400).json({
        ok: false,
        message: "Dati obbligatori mancanti",
      });
    }

    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      {
        type,
        name,
        region,
        city,
        bike: bike || "",
        style: style || "",
        availability: availability || "",
        contact: contact || "",
        imageUrl: imageUrl || "",
        text,
        badge: type === "event" ? "Uscita" : "Community",
      },
      { new: true, runValidators: true }
    );

    if (!post) {
      return res.status(404).json({
        ok: false,
        message: "Annuncio non trovato",
      });
    }

    res.json({ ok: true, post });
  } catch (err) {
    console.error("Community PUT error:", err);
    res.status(500).json({ ok: false, message: "Errore modifica annuncio" });
  }
});

// ELIMINA annuncio soft delete
router.delete("/:id", async (req, res) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({
        ok: false,
        message: "Annuncio non trovato",
      });
    }

    res.json({ ok: true, message: "Annuncio eliminato" });
  } catch (err) {
    console.error("Community DELETE error:", err);
    res.status(500).json({ ok: false, message: "Errore eliminazione annuncio" });
  }
});

export default router;