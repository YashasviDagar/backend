import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// Middleware to verify whether the incoming request contains a valid JWT
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // Get the access token either from cookies or the Authorization header.
    // If coming from the header, remove the "Bearer " prefix.
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    // console.log(token);

    // If no token is found, the user is not authenticated.
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    // Verify the token using the access token secret.
    // If the token is invalid or expired, jwt.verify() throws an error.
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Find the user using the _id stored inside the decoded token.
    // Exclude password and refreshToken before sending the user object.
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    // If the user no longer exists in the database,
    // treat the token as invalid.
    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    // Attach the authenticated user's data to the request object
    // so it can be accessed in the next middleware/controller.
    req.user = user;

    // Pass control to the next middleware or route handler.
    next();
  } catch (error) {
    // Handle any JWT verification or authentication errors.
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

/**
 * Client sends request
        │
        ▼
Extract token
(from Cookie or Authorization Header)
        │
        ▼
Token exists?
   │           │
  No          Yes
   │           │
401 Error      ▼
          Verify JWT
               │
               ▼
       Token valid?
         │         │
        No        Yes
         │         │
   401 Error      ▼
          Find user in DB
               │
               ▼
          User exists?
         │          │
        No         Yes
         │          │
   401 Error        ▼
            req.user = user
                   │
                   ▼
                 next()
 */
