import mongoose from "mongoose";

const communityPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    type: {
      type: String,
      enum: ["ride-buddy", "biker-passenger", "passenger-biker", "event"],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    region: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    bike: {
      type: String,
      trim: true,
      default: "",
    },

    style: {
      type: String,
      trim: true,
      default: "",
    },

    availability: {
      type: String,
      trim: true,
      default: "",
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 800,
    },

    badge: {
      type: String,
      default: "Community",
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CommunityPost", communityPostSchema);