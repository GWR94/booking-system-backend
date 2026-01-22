import { describe, it, expect, jest } from "@jest/globals";
import generateTokens from "./generate-tokens";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

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
