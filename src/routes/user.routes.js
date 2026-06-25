import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";

const router = Router()
console.log("user.routes.js loaded");

router.route("/register").post(registerUser)
//after this register is called it goes to this registerUser method

export default router