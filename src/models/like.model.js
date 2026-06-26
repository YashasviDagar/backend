import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    // Reference to the video that was liked.
    // Will be null if the like belongs to a comment or tweet.
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },

    // Reference to the comment that was liked.
    // Will be null if the like belongs to a video or tweet.
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },

    // Reference to the tweet that was liked.
    // Will be null if the like belongs to a video or comment.
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },

    // Reference to the user who performed the like
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

export const Like = mongoose.model("Like", likeSchema);
