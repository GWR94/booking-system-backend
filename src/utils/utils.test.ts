import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import calculateBasketCost from "./calculate-basket-cost";
import generateTokens from "./generate-tokens";
import { groupSlotsByBay } from "./group-slots";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

// --- Mocks ---
jest.mock("jsonwebtoken");
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

describe("Utilities", () => {
  describe("calculateBasketCost", () => {
    it("should sum up prices correctly", () => {
      // 3 items, each with 1 slot. Total 3 slots.
      // 3 * 4500 = 13500
      const basket = [
        { slotIds: [1] },
        { slotIds: [2] },
        { slotIds: [3] },
      ] as any;
      const total = calculateBasketCost(basket);
      expect(total).toBe(13500);
    });

    it("should handle multiple slots in one item", () => {
      // 1 item with 2 slots.
      // 2 * 4500 = 9000
      const basket = [{ slotIds: [1, 2] }] as any;
      expect(calculateBasketCost(basket)).toBe(9000);
    });

    it("should return 0 for empty basket", () => {
      expect(calculateBasketCost([])).toBe(0);
    });
  });

  describe("generateTokens", () => {
    it("should generate access and refresh tokens", () => {
      const mockUser = { id: 1, email: "test@test.com", role: "USER" } as any;
      (jwt.sign as jest.Mock).mockReturnValue("mock_token");

      const tokens = generateTokens(mockUser);

      expect(tokens).toEqual({
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe("groupSlotsByBay", () => {
    it("should group slots by bay ID", () => {
      const slots = [
        {
          id: 1,
          bayId: 101,
          startTime: new Date(),
          bay: { id: 101, name: "Bay 1" },
        },
        {
          id: 2,
          bayId: 102,
          startTime: new Date(),
          bay: { id: 102, name: "Bay 2" },
        },
        {
          id: 3,
          bayId: 101,
          startTime: new Date(),
          bay: { id: 101, name: "Bay 1" },
        },
      ] as any;

      const grouped = groupSlotsByBay(slots);

      expect(grouped).toBeInstanceOf(Array);
      expect(grouped).toHaveLength(2);

      const bay1Group = grouped.find((g) => g.bayId === 101);
      const bay2Group = grouped.find((g) => g.bayId === 102);

      expect(bay1Group).toBeDefined();
      expect(bay1Group!.slotIds).toHaveLength(2);
      expect(bay2Group).toBeDefined();
      expect(bay2Group!.slotIds).toHaveLength(1);
    });
  });

  describe("handleSendEmail", () => {
    let sendMailMock: jest.Mock;

    beforeEach(() => {
      sendMailMock = jest.fn(() => Promise.resolve(true));
      // Re-setup the mock implementation for createTransport to return fresh spy
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
      // Need to re-mock this too as resetModules clears strict mocks
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
});
