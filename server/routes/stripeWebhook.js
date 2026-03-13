import express from "express";
import Stripe from "stripe";
import User from "../models/User.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const userId =
            session.metadata?.userId || session.client_reference_id;

          if (userId) {
            await User.findByIdAndUpdate(userId, {
              isPremium: true,
              role: "premium",
              passActive: true,
              trialActive: false,
              trialExpires: null,
              stripeCustomerId: session.customer || null,
              stripeSubscriptionId: session.subscription || null,
              premiumActivatedAt: new Date(),
            });

            console.log("✅ Premium attivato per user:", userId);
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object;

          if (invoice.subscription) {
            await User.findOneAndUpdate(
              { stripeSubscriptionId: invoice.subscription },
              {
                isPremium: true,
                role: "premium",
                passActive: true,
                trialActive: false,
                trialExpires: null,
              }
            );

            console.log("💳 Invoice paid, premium confermato per subscription:", invoice.subscription);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;

          await User.findOneAndUpdate(
            { stripeSubscriptionId: subscription.id },
            {
              isPremium: false,
              role: "user",
              passActive: false,
              premiumExpiredAt: new Date(),
            }
          );

          console.log("⚠️ Premium disattivato per subscription:", subscription.id);
          break;
        }

        default:
          console.log(`ℹ️ Evento Stripe ignorato: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      return res.status(500).json({ error: "Errore elaborazione webhook" });
    }
  }
);

export default router;