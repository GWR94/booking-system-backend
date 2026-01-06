import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { validateRecaptcha } from "./recaptcha-validation";

// Auto-mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Recaptcha Validation Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.resetAllMocks();
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
  });

  it("should call next() if recaptcha verification succeeds", async () => {
    req.body = { recaptchaToken: "valid-token" };

    // axios.post resolves successfully
    mockedAxios.post.mockResolvedValue({ data: { success: true } });

    await validateRecaptcha(req as Request, res as Response, next);

    expect(mockedAxios.post).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should return 400 if token is missing", async () => {
    req.body = {}; // No token

    await validateRecaptcha(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if google verification fails", async () => {
    req.body = { recaptchaToken: "invalid-token" };
    mockedAxios.post.mockResolvedValue({ data: { success: false } });

    await validateRecaptcha(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
