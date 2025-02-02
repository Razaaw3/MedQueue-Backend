import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.config.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import tokenRoutes from "./routes/tokens.routes.js";
import timeSlotRoutes from "./routes/timeSlots.routes.js";
import cron from "node-cron";
import { Server } from "socket.io";
import { createMonthlyTimeSlots } from "./utils/timeSlotUtils.js";
import http from "http";
import cors from "cors";

dotenv.config();

const app = express();

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

connectDB();

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
// app.use("/api/guest", guestRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/timeslots", timeSlotRoutes);

app.get("/home", (req, res) => {
  res.json({ message: "API is running..." });
});

// cron job to automate time slot generation
const AUTO_GENERATION_OPENING_TIME = "13:00";
const AUTO_GENERATION_CLOSING_TIME = "16:00";

// use "0 0 1 * *" for running the cron job at the start of every month
// use "* * * * *" for running the cron job every minute (for testing)
cron.schedule("0 0 1 * *", async () => {
  //generate time slots at the start of every month
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  try {
    console.log("Starting automated time slot generation for the month...");
    const generatedSlots = await createMonthlyTimeSlots(
      currentMonth,
      currentYear,
      AUTO_GENERATION_OPENING_TIME,
      AUTO_GENERATION_CLOSING_TIME
    );

    console.log(
      `Time slots generated successfully for ${generatedSlots.length} days.`
    );
  } catch (error) {
    console.error("Error in automated time slot generation:", error);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
