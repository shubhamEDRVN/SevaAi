const express = require("express");
const {
  registerUser,
  loginUser,
  adminLoginUser,
  logoutUser,
  getMe,
} = require("../controllers/authController");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/admin-login", adminLoginUser);
router.post("/logout", logoutUser); // Changed to POST for better security
router.get("/me", getMe);

module.exports = router;
