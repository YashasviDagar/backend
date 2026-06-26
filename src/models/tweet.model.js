import mongoose, { Schema } from "mongoose";

const tweetSchema = new Schema(
  {
    // The text/content of the tweet
    content: {
      type: String,
      required: true,
    },

    // Reference to the user who created the tweet
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

export const Tweet = mongoose.model("Tweet", tweetSchema);
