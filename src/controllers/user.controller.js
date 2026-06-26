import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
  //what we gotta do
  //get user details from frontend: email username password etc
  //vaildation! - if its not empty
  //checking if user exist or not
  //checking images and avatar!
  //upload them in cloudinary, for avatar
  //creating user object - create entry in DB
  //remove password and refresh token from response
  //checking if user creating if yes then return response

  const { fullName, email, username, password } = req.body;
  console.log("email", email);

  // if(fullName === ""){
  //     throw new ApiError(400, "FullName is required.")
  // }
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists.");
  }
  //console.log(req.files);

  //imgs

  // Get the local path of the uploaded avatar file from multer. req.files? -> does it exist or not,,, ? is basically called as chaining
  // Optional chaining prevents errors if no file was uploaded. here [0] if it exist then we can get its .path property then this avatarLocalPath becomes something like public/temp/profile.jpg
  const avatarLocalPath = req.files?.avatar[0]?.path;

  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user!");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    //here mongodb models kick where everyhting is required so bye using validateBeforeSave we say ik what im doing just save the given values
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    // console.log(error)
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  //find the user
  //password check
  //access and referesh token
  //send cookie

  console.log("BODY:", req.body);

  // Extract login credentials from the request body
  const { email, username, password } = req.body;
  console.log(email);

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  // Here is an alternative of above code based on logic discussed in video:
  // if (!(username || email)) {
  //     throw new ApiError(400, "username or email is required")
  // }

  // Search for the user using either username or email
  const user = await User.findOne({
    //here either find the username on basis or email or username
    $or: [{ username }, { email }],
  });

  // If no matching user is found, return an error
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Compare the entered password with the hashed password stored in the database
  const isPasswordValid = await user.isPasswordCorrect(password);

  // If the password doesn't match, deny access
  if (!isPasswordValid) {
    throw new ApiError(401, "Invlaid user credentials");
  }

  // Generate new Access Token and Refresh Token for the user
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  // Fetch the user's details while excluding sensitive fields
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Cookie options
  const options = {
    // can be modified from server only
    httpOnly: true,

    // Cookie will only be sent over HTTPS
    secure: true,
  };

  // Send tokens as cookies and user data in the response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // Remove the refresh token from the user's document in the database.
  // This invalidates the current login session, so the refresh token
  // can no longer be used to generate new access tokens.
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // $unset removes the refreshToken field from the document
      },
    },
    {
      new: true, // Return the updated document (not used here, but good practice)
    }
  );

  // Cookie options must match the ones used when the cookies were created.
  // This ensures the browser correctly identifies and removes them.
  const options = {
    httpOnly: true, // Cookies cannot be accessed or modified by client-side JavaScript
    secure: true, // Cookies are sent only over HTTPS
  };

  // Clear both authentication cookies from the user's browser
  // and send a success response.
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get the refresh token either from cookies or the request body
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  // If no refresh token is provided, the user is not authorized
  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    // Verify that the refresh token is valid and hasn't been tampered with.
    // jwt.verify() returns the decoded payload if successful.
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Find the user whose _id is stored inside the refresh token
    const user = await User.findById(decodedToken?._id);

    // If no user exists, the refresh token is invalid
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Compare the incoming refresh token with the one stored in the database.
    // This prevents the use of old, revoked, or stolen refresh tokens.
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    // Cookie options for storing the new tokens
    const options = {
      httpOnly: true, // Cannot be accessed by client-side JavaScript
      secure: true, // Sent only over HTTPS
    };

    // Generate a new Access Token and Refresh Token
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    // Send the new tokens back to the client and replace the old cookies
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed"
        )
      );
  } catch (error) {
    // Handles invalid, expired, or malformed refresh tokens
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
