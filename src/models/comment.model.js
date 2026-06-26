import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    // The text/content of the comment
    content: {
      type: String,
      required: true,
    },

    // Reference to the video on which the comment was made
    // Stores only the Video document's ObjectId
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },

    // Reference to the user who wrote the comment
    // Stores only the User document's ObjectId
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

// Adds aggregatePaginate() method to the Comment model,
// allowing aggregation queries to be paginated easily.
commentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commentSchema);
