import express from "express";

import {
getUsers,
verifyUser
}
from "../controllers/adminController.js";


const router =
express.Router();


router.get(
"/users",
getUsers
);


router.put(
"/verify/:id",
verifyUser
);


export default router;