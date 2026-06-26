import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// Create a new Express router instance
const router = Router();

console.log("user.routes.js loaded");

// Register a new user
router.route("/register").post(
  // Multer middleware to handle file uploads.
  // Accepts one avatar image and one cover image from the request.
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),

  // Controller that handles user registration
  registerUser
);

//after this register is called it goes to this registerUser method

// Login an existing user
router.route("/login").post(loginUser);

//SECURED routes

// Logout route.
// verifyJWT middleware first checks whether the user is authenticated.
// If the JWT is valid, the request proceeds to logoutUser.
router.route("/logout").post(verifyJWT, logoutUser);

// Export the router so it can be used in app.js
export default router;
