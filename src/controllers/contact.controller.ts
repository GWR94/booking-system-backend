import { Request, Response, NextFunction } from "express";
import { handleSendEmail } from "../utils/email";
import { contactSchema } from "@middleware";

export const sendContactMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, phone, subject, message } = req.body;

  const { error } = contactSchema.validate({
    name,
    email,
    phone,
    subject,
    message,
  });

  if (error) {
    res.status(400).json({ message: error.details[0].message });
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
