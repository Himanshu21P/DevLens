/**
 * Middleware factory that validates request body against a Joi schema.
 * Formats errors to match the standardized API error payload contract.
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against
 * @returns {Function} Express middleware function
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const formattedErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''), // Strip quotes from Joi messages
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: formattedErrors,
        error: {
          message: 'Validation Error',
          code: 'BAD_REQUEST',
          details: formattedErrors
        }
      });
    }

    next();
  };
};

export default validateBody;
