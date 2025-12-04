import { Request, Response, NextFunction } from "express";
import Joi from "joi";

// Define registration validation schema
const registrationSchema = Joi.object({
  email: Joi.string()
    .email({
      tlds: { allow: false },
    })
    .required()
    .messages({
      "string.email": "Please enter a valid email address",
      "string.empty": "Email is required",
    }),
  name: Joi.string()
    .pattern(/^[A-Za-z\s]+$/)
    .min(5)
    .max(50)
    .required()
    .messages({
      "string.empty": "Name is required",
      "string.pattern.base": "Name can only contain letters and spaces.",
      "string.min": "Name must be at least 5 characters",
      "string.max": "Name must not be more than 50 characters",
    }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp("(?=.*[A-Z])(?=.*[!@#$&*])"))
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain an uppercase letter and a special character",
      "string.empty": "Password is required",
    }),
});

// Define login validation schema
const loginSchema = Joi.object({
  email: Joi.string()
    .email({
      tlds: { allow: false },
    })
    .required()
    .messages({
      "string.email": "Please enter a valid email address",
      "string.empty": "Email is required",
    }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp("(?=.*[A-Z])(?=.*[!@#$&*])"))
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain an uppercase letter and a special character",
      "string.empty": "Password is required",
    }),
});

// Middleware for validating registration
export const validateRegistration = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(req.body);
  const { error } = registrationSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};

// Middleware for validating login
export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    res.status(400).json({ message: error.details[0].message });
    return;
  }
  next();
};
