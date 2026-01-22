import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Response, NextFunction } from "express";
import { sendContactMessage } from "./contact.controller";
import { handleSendEmail } from "@utils/email";

jest.mock("@utils/email", () => ({
  handleSendEmail: jest.fn(),
}));

describe("Contact Controller", () => {
  let req: any;
  let res: any;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it("should return 400 if required fields are missing", async () => {
    req.body = { name: "John" }; // missing email

    await sendContactMessage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email is required",
    });
    expect(handleSendEmail).not.toHaveBeenCalled();
  });

  it("should send an email successfully when all fields are provided", async () => {
    req.body = {
      name: "John Doe",
      email: "john@example.com",
      phone: "123456789",
      subject: "Hello",
      message: "Test message",
    };

    (handleSendEmail as any).mockResolvedValue(undefined);

    await sendContactMessage(req, res, next);

    expect(handleSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "contact@jamesgower.dev",
        replyTo: "john@example.com",
        subject: "New Contact Form: Hello",
        templateName: "contact-form",
        templateContext: expect.objectContaining({
          name: "John Doe",
          email: "john@example.com",
          message: "Test message",
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Message sent successfully",
    });
  });

  it("should handle email sending errors by calling next", async () => {
    req.body = {
      name: "John Doe",
      email: "john@example.com",
      subject: "Hello",
      message: "Test message",
    };

    const error = new Error("SMTP Error");
    (handleSendEmail as any).mockRejectedValue(error);

    await sendContactMessage(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
