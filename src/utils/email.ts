import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

type EmailTemplateName = "confirmation" | "password-reset" | "contact-form";

interface ConfirmationEmailContext extends HeaderContext, FooterContext {
  booking: {
    id: number;
    slots: {
      startTime: string;
      endTime: string;
      date: string;
    }[];
  };
  payment: {
    intentId: string;
    amount: string;
  };
}

interface ContactFormEmailContext extends HeaderContext, FooterContext {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

interface HeaderContext {
  baseUrl: string;
}

interface FooterContext {
  logoUrl: string;
  year: number;
}

interface PasswordResetEmailContext extends HeaderContext, FooterContext {
  name: string;
  resetUrl: string;
}

interface TemplateContextMap {
  confirmation: ConfirmationEmailContext;
  "password-reset": PasswordResetEmailContext;
  "contact-form": ContactFormEmailContext;
}

export interface SendConfirmProps<T extends EmailTemplateName> {
  recipientEmail: string;
  subject: string;
  templateName: T;
  templateContext: TemplateContextMap[T];
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

import path from "path";

transporter.use(
  "compile",
  hbs({
    viewEngine: {
      extname: ".hbs",
      partialsDir: path.resolve(__dirname, "../templates/partials"),
      layoutsDir: path.resolve(__dirname, "../templates/emails"),
      defaultLayout: false,
    },
    viewPath: path.resolve(__dirname, "../templates/emails"),
    extName: ".hbs",
  })
);

export const handleSendEmail = async <T extends EmailTemplateName>({
  recipientEmail,
  subject,
  templateName,
  templateContext,
}: SendConfirmProps<T>) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject: subject,
      template: templateName,
      context: templateContext,
    };

    await transporter.sendMail(mailOptions);
    console.log("Confirmation email sent successfully to:", recipientEmail);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
};
