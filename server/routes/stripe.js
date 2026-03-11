import express from "express";
import Stripe from "stripe";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Utente non autenticato" });
    }

    if (!process.env.STRIPE_PRICE_PREMIUM_YEARLY) {
      return res.status(500).json({ error: "Prezzo Stripe non configurato" });
    }

    const dbUser = await User.findById(userId);
    if (!dbUser) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    if (dbUser.isPremium === true || dbUser.role === "premium") {
      return res.status(400).json({ error: "Utente già premium" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/premium-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/premium`,
      customer_email: dbUser.email,
      client_reference_id: String(dbUser._id),
      metadata: {
        userId: String(dbUser._id),
        app: "motoporteu",
        product: "premium_yearly",
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe create-checkout-session error:", error);
    return res.status(500).json({ error: "Errore creazione sessione Stripe" });
  }
});

export default router;