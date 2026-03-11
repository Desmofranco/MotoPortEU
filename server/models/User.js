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

  passActive: {
    type: Boolean,
    default: false
  }

},
{ timestamps: true }
);

export default mongoose.model("User", UserSchema);