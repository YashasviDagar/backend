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
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

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

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Extract the old password and the new password from the request body
  const { oldPassword, newPassword } = req.body;

  // Get the currently logged-in user's details from the database
  const user = await User.findById(req.user?._id);

  // Verify that the entered old password matches the current password
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  // If the old password is incorrect, don't allow the password change
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  // Set the new password.
  // The pre("save") middleware will automatically hash it before saving.
  user.password = newPassword;

  // Save the updated password to the database.
  // Skip other validations since only the password is being updated.
  await user.save({ validateBeforeSave: false });

  // Send a success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // req.user is added by the verifyJWT middleware after
  // successfully verifying the user's access token.
  // It contains the authenticated user's information.
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // Extract the updated account details from the request body
  const { fullName, email } = req.body;

  // Ensure both fields are provided
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Find the currently logged-in user and update the provided fields.
  // $set updates only the specified fields without affecting the others.
  // { new: true } returns the updated document instead of the old one.
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  )
    // Exclude the password before sending the updated user back
    .select("-password");

  // Send the updated user details in the response
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Get the local path of the uploaded avatar image from multer
  const avatarLocalPath = req.file?.path;

  // Ensure an avatar image was uploaded
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //TODO: delete old image - assignment

  // Upload the new avatar image to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // Check if the upload was successful
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  // Update the user's avatar URL in the database.
  // { new: true } returns the updated user document.
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  )
    // Exclude the password before sending the updated user data
    .select("-password");

  // Return the updated user details
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // Get the local path of the uploaded cover image from multer
  const coverImageLocalPath = req.file?.path;

  // Ensure a cover image was uploaded
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  //TODO: delete old image - assignment

  // Upload the new cover image to Cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // Check if the upload was successful
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  // Update the user's cover image URL in the database.
  // { new: true } returns the updated user document.
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  )
    // Exclude the password before sending the updated user data
    .select("-password");

  // Return the updated user details
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  // Get the username from the URL parameters
  const { username } = req.params;

  // Ensure a username was provided
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  // Aggregate data to build a complete channel profile
  const channel = await User.aggregate([
    // Stage 1: Filter documents
    // Only keep the user whose username matches the requested username.
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },

    // Stage 2: Join (similar to SQL JOIN)
    // Fetch all documents from the "subscriptions" collection
    // where this user's _id appears in the "channel" field.
    // These are the people who have subscribed to this channel.
    {
      $lookup: {
        // Collection to join with
        from: "subscriptions",

        // Field from the current (User) collection
        localField: "_id",

        // Field in the subscriptions collection to compare with localField -- foreign field khn present h
        foreignField: "channel",

        // Store the matched documents inside a new array called "subscribers"
        as: "subscribers",
      },
    },

    // Stage 3: Another Join
    // Fetch all subscriptions where this user is the subscriber.
    // These are the channels this user has subscribed to.
    {
      $lookup: {
        // Join with subscriptions collection again
        from: "subscriptions",

        // Current user's _id
        localField: "_id",

        // Match against subscriber field this time -- ek channel ne kitto ko subscribe kr rakha h
        foreignField: "subscriber",

        // Store matched documents in subscribedTo array
        as: "subscribedTo",
      },
    },

    // Stage 4: Create new computed fields
    {
      $addFields: {
        // Count total subscribers
        subscribersCount: {
          $size: "$subscribers",
        },

        // Count how many channels this user has subscribed to
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },

        // Check whether the currently logged-in user
        // is present in the subscribers array.
        isSubscribed: {
          $cond: {
            // If req.user._id exists inside
            // subscribers[].subscriber
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },

            // Then current user is subscribed
            then: true,

            // Otherwise not subscribed
            else: false,
          },
        },
      },
    },

    // Stage 5: Return only the fields we want
    {
      $project: {
        // 1 means include this field
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,

        // Any field not listed here won't be returned.
      },
    },
  ]);

  // If no matching channel is found, return an error
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  // Return the first (and only) matching channel profile
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  // Aggregate data for the currently logged-in user
  const user = await User.aggregate([
    // Stage 1: Find the logged-in user.
    // Aggregation requires ObjectId, so convert req.user._id into an ObjectId.
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },

    // Stage 2: First (Outer) $lookup
    // Join the "videos" collection with the current user.
    // The watchHistory array contains video IDs, and this lookup
    // replaces those IDs with the actual video documents.
    {
      $lookup: {
        // Collection to join with
        from: "videos",

        // Field from the current (User) collection
        // Contains an array of watched video IDs
        localField: "watchHistory",

        // Field in the Videos collection to compare with localField
        foreignField: "_id",

        // Store the matched video documents in the watchHistory field
        as: "watchHistory",

        // Run additional aggregation on every matched video document
        pipeline: [
          // Nested (Inner) $lookup
          // For each video, fetch the owner's details
          {
            $lookup: {
              // Join with the users collection
              from: "users",

              // owner field inside each Video document
              localField: "owner",

              // Match it with the user's _id
              foreignField: "_id",

              // Store the matched owner document in an array called owner
              as: "owner",

              // Additional pipeline for the nested lookup
              // Return only the required owner fields
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },

          // Since every video has only one owner,
          // convert the owner array into a single object.
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  // Return only the populated watch history
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
