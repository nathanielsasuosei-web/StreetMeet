import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";

import authMiddleware from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    app: "Street Meet API",
    status: "Running"
  });
});

app.use("/api/auth", authRoutes);

app.use(
  "/api/profile",
  authMiddleware,
  profileRoutes
);

app.use(
  "/api/matches",
  authMiddleware,
  matchRoutes
);

app.use(
  "/api/chat",
  authMiddleware,
  chatRoutes
);

app.use(
  "/api/status",
  authMiddleware,
  statusRoutes
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});import paymentRoutes from "./routes/paymentRoutes.js";


app.use(
"/api/payment",
authMiddleware,
paymentRoutes
);
app.use(helmet());


const limiter = rateLimit({

windowMs: 15 * 60 * 1000,

max: 100,

message:
"Too many requests, please try again later."

});


app.use(limiter);