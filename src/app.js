import express from "express"
import cors from 'cors'
import cookieParser from "cookie-parser"
import userRouter from './routes/user.routes.js'   // ✅ TOP of file

const app = express()

console.log("app.js loaded")

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())

// DEBUG
app.use((req, res, next) => {
    console.log("REQUEST RECEIVED:", req.method, req.url)
    next()
})

// TEST ROUTE
app.post("/test", (req, res) => {
    console.log("TEST ROUTE HIT")
    res.status(200).json({ message: "test route works" })
})

// MAIN ROUTES
app.use("/api/v1/users", userRouter)

export { app }