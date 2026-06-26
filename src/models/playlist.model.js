import mongoose, { Schema } from "mongoose";

const playlistSchema = new Schema(
  {
    // Name/title of the playlist
    name: {
      type: String,
      required: true,
    },

    // Short description about the playlist
    description: {
      type: String,
      required: true,
    },

    // Array of Video ObjectIds.
    // Each ObjectId references a video that belongs to this playlist.
    videos: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],

    // Reference to the user who created/owns this playlist
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

export const Playlist = mongoose.model("Playlist", playlistSchema);
