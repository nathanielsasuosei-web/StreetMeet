import express from "express";

import {
getMessages
} from "../controllers/chatController.js";


const router=express.Router();


router.get(
"/:userId",
getMessages
);


export default router;