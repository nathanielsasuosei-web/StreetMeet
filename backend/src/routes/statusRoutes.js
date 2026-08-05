import express from "express";

import {
createStatus,
getStatuses
}
from "../controllers/statusController.js";


const router =
express.Router();


router.post(
"/create",
createStatus
);


router.get(
"/",
getStatuses
);


export default router;