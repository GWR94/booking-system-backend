export default {
  USER_NOT_FOUND: { message: "User not found", error: "USER_NOT_FOUND" },
  NOT_AUTHENTICATED: {
    message: "User not authenticated",
    error: "NOT_AUTHENTICATED",
  },
  NO_ACCESS_TOKEN: { message: "No access token", error: "NO_ACCESS_TOKEN" },
  WRONG_AUTH_METHOD: {
    message: `Try signing in with OAuth`,
    error: "WRONG_AUTH_METHOD",
  },
  INCORRECT_INPUT: {
    message: "Invalid email and password combination",
    error: "INCORRECT_INPUT",
  },
  INVALID_TOKEN: {
    message: "Invalid or expired refresh token",
    error: "INVALID_TOKEN",
  },
  DUPLICATE_USER: {
    message: "User with this email exists",
    error: "DUPLICATE_USER",
  },
  NO_REFRESH_TOKEN: {
    message: "No refresh token provided",
    error: "NO_REFRESH_TOKEN",
  },
};
