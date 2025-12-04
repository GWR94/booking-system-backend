import { sign } from "jsonwebtoken";
import { UserPayload } from "../interfaces/user.i";

const generateTokens = (user: UserPayload) => {
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    ...(user.facebookId && { facebookId: user.facebookId }),
    ...(user.googleId && { googleId: user.googleId }),
    ...(user.appleId && { appleId: user.appleId }),
  };

  const accessToken = sign(payload, process.env.ACCESS_TOKEN_SECRET as string, {
    expiresIn: "15m",
  });

  const refreshToken = sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: "7d" } // Longer lifetime
  );

  return { accessToken, refreshToken };
};

export default generateTokens;
