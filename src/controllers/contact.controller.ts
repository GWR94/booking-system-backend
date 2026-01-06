import { Request, Response, NextFunction } from "express";
import { handleSendEmail } from "../utils/email";
import ERRORS from "../utils/errors";

export const sendContactMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, email, phone, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    res.status(400).json({ message: "Missing required fields" });
    return;
  }

  try {
    // Determine the recipient - likely the admin or info email
    // For now, using the configured EMAIL_FROM or a specific env if you have one
    const recipientEmail =
      process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || "info@example.com";

    await handleSendEmail({
      recipientEmail,
      subject: `New Contact Form: ${subject}`,
      templateName: "contact-form",
      templateContext: {
        name,
        email,
        phone,
        subject,
        message,
        baseUrl: process.env.FRONT_END || "http://localhost:3000",
        logoUrl: process.env.LOGO_URL || "",
        year: new Date().getFullYear(),
      },
    });

    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    next(error);
  }
};
