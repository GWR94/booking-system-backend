import { Request, Response, NextFunction } from "express";
import axios from "axios";

export const validateRecaptcha = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { recaptchaToken } = req.body;

  if (!recaptchaToken) {
    return res.status(400).json({ message: "reCAPTCHA token is missing." });
  }

  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    );

    const { success } = response.data;

    if (success) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "reCAPTCHA verification failed." });
    }
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(500).json({
      message: "Internal server error during reCAPTCHA verification.",
    });
  }
};
