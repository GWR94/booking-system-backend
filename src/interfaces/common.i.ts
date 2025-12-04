import { Request } from "express";
import { UserPayload } from "./user.i";

export interface Error {
  message: string;
  error: string;
}
export interface AuthenticatedRequest extends Request {
  currentUser?: UserPayload;
}
