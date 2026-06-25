import mongoose, { mongo, Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

// Define the structure/schema for User documents
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // convert username to lowercase before saving
      trim: true, // remove extra spaces from start and end
      index: true, // create index for faster searching
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // store emails in lowercase
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      index: true, // index for quicker searching/filtering
      trim: true,
    },

    avatar: {
      type: String, // cloudinary url
      required: true,
    },

    coverImage: {
      type: String, // cloudinary url
    },

    // Stores references to videos watched by the user
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video", // Reference to Video model
      },
    ],

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    // Stores the latest refresh token issued to the user
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Middleware that runs before saving a document
userSchema.pre("save", async function (next) {

    // If password is not modified, skip hashing
    if(!this.isModified("password")) return next();

    // Hash the password before storing it in the database
    //changes the password to a code value
    this.password = await bcrypt.hash(this.password, 10)

    next()
})

// Method to compare entered password with hashed password in DB
userSchema.methods.isPasswordCorrect = async function (password) {
    //here .compare decrypt the hashed password to match the password entered by the user
    return await bcrypt.compare(password, this.password)
}

// Generate a short-lived Access Token used to authenticate API requests.
// The token contains basic user information and is signed using
// ACCESS_TOKEN_SECRET. Once expired, the user must use a Refresh Token
// to obtain a new Access Token.userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}


// Generate a long-lived Refresh Token used to create new Access Tokens
// without requiring the user to log in again. It contains only the user's
// id and is signed using REFRESH_TOKEN_SECRET for added security.
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);