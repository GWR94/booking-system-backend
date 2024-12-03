import { User } from "../controllers/userController";

const jwt = require("jsonwebtoken");

const generateTokens = (user: User) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" } // Short lifetime
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // Longer lifetime
  );

  return { accessToken, refreshToken };
};

export default generateTokens;
