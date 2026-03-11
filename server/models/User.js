import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    default: "user"
  },

  // compatibilità con sistema attuale
  passActive: {
    type: Boolean,
    default: false
  },

  // nuovo sistema premium
  isPremium: {
    type: Boolean,
    default: false
  },

  stripeCustomerId: {
    type: String,
    default: null
  },

  stripeSubscriptionId: {
    type: String,
    default: null
  },

  premiumActivatedAt: {
    type: Date,
    default: null
  },

  premiumExpiredAt: {
    type: Date,
    default: null
  }

},
{ timestamps: true }
);

export default mongoose.model("User", UserSchema);