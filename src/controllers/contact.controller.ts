import { Request, Response, NextFunction } from "express";
import { handleSendEmail } from "../utils/email";

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
    await handleSendEmail({
      recipientEmail: "contact@jamesgower.dev",
      senderPrefix: "contact",
      replyTo: email,
      subject: `New Contact Form: ${subject}`,
      templateName: "contact-form",
      templateContext: {
        name,
        email,
        phone,
        subject,
        message,
        baseUrl: process.env.FRONT_END as string,
        logoUrl: process.env.LOGO_URL || "",
        year: new Date().getFullYear(),
      },
    });

    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    next(error);
  }
};
