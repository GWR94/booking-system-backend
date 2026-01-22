import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import nodemailer from "nodemailer";

// --- Mocks ---
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
    use: jest.fn(),
  }),
}));
jest.mock("nodemailer-express-handlebars", () => () => (_: any) => {});
jest.mock("./logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Email Utility", () => {
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    sendMailMock = jest.fn(() => Promise.resolve(true));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
      use: jest.fn(),
    });
  });

  it("should send an email successfully", async () => {
    // Reset modules to ensure fresh require uses the mock setup above
    jest.resetModules();
    jest.doMock("nodemailer", () => ({
      createTransport: jest.fn().mockReturnValue({
        sendMail: sendMailMock,
        use: jest.fn(),
      }),
    }));
    jest.doMock("nodemailer-express-handlebars", () => () => (_: any) => {});

    const { handleSendEmail: handler } = require("./email");

    await handler({
      recipientEmail: "test@test.com",
      senderPrefix: "no-reply",
      subject: "Subject",
      templateName: "confirmation",
      templateContext: {} as any,
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        subject: "Subject",
        template: "confirmation",
      }),
    );
  });

  it("should log error if sending fails", async () => {
    const loggerErrorSpy = jest.fn();
    jest.doMock("./logger", () => ({
      logger: {
        info: jest.fn(),
        error: loggerErrorSpy,
      },
    }));

    const error = new Error("SMTP Error");
    sendMailMock.mockImplementation(() => Promise.reject(error));

    jest.resetModules();
    jest.doMock("nodemailer", () => ({
      createTransport: jest.fn().mockReturnValue({
        sendMail: sendMailMock,
        use: jest.fn(),
      }),
    }));
    jest.doMock("nodemailer-express-handlebars", () => () => (_: any) => {});
    jest.doMock("./logger", () => ({
      logger: {
        info: jest.fn(),
        error: loggerErrorSpy,
      },
    }));

    const { handleSendEmail: handler } = require("./email");

    await handler({
      recipientEmail: "fail@test.com",
      senderPrefix: "no-reply",
      subject: "Subject",
      templateName: "confirmation",
      templateContext: {} as any,
    });

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `Error sending confirmation email: ${error}`,
    );
  });
});
