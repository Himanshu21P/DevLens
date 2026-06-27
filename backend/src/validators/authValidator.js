import Joi from 'joi';
import { validatePasswordStrength } from '../utils/auth.js';

// Custom validator reusing our password strength utility
const strongPassword = (value, helpers) => {
  const result = validatePasswordStrength(value);
  if (!result.isValid) {
    return helpers.message(result.message);
  }
  return value;
};

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().required().custom(strongPassword).messages({
    'any.required': 'Password is required.',
  }),
  name: Joi.string().min(2).max(50).optional().messages({
    'string.min': 'Name must be at least 2 characters.',
    'string.max': 'Name cannot exceed 50 characters.',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address.',
    'any.required': 'Email is required.',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required.',
  }),
  password: Joi.string().required().custom(strongPassword).messages({
    'any.required': 'New password is required.',
  }),
});
