import express from "express";

import {
discoverUsers,
likeUser
} from "../controllers/matchController.js";


const router=express.Router();


router.get(
"/discover",
discoverUsers
);


router.post(
"/like/:id",
likeUser
);


export default router;