import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "premium", "admin"],
      default: "user",
    },

    isPremium: {
      type: Boolean,
      default: false,
    },

    passActive: {
      type: Boolean,
      default: false,
    },

    stripeCustomerId: {
      type: String,
      default: null,
    },

    stripeSubscriptionId: {
      type: String,
      default: null,
    },

    // ✅ DEMO GRATUITA 10 GIORNI
    trialActive: {
      type: Boolean,
      default: true,
    },

    trialExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;