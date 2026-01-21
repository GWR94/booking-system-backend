import { Request, Response, NextFunction } from "express";
import { handleSendEmail } from "../utils/email";
import Joi from "joi";

export const sendContactMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, phone, subject, message } = req.body;

  /* 
    Schema Validation 
    - Name: Required, min 2 chars
    - Email: Required, valid email format
    - Phone: Optional, allow empty string
    - Subject: Required, min 3 chars
    - Message: Required, min 10 chars
  */
  const schema = Joi.object({
    name: Joi.string().min(2).required().messages({
      "string.empty": "Name is required",
      "any.required": "Name is required",
      "string.min": "Name must be at least 2 characters",
    }),
    email: Joi.string().email().required().messages({
      "string.empty": "Email is required",
      "any.required": "Email is required",
      "string.email": "Invalid email address",
    }),
    phone: Joi.string().allow("").optional(),
    subject: Joi.string().min(3).required().messages({
      "string.empty": "Subject is required",
      "any.required": "Subject is required",
      "string.min": "Subject must be at least 3 characters",
    }),
    message: Joi.string().min(10).required().messages({
      "string.empty": "Message is required",
      "any.required": "Message is required",
      "string.min": "Message must be at least 10 characters",
    }),
  });

  const { error } = schema.validate({ name, email, phone, subject, message });

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
