import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(error, req, res, _next) {
  let err = error;
  if (err?.type === 'entity.too.large') err = new AppError('Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
  if (err instanceof SyntaxError && err?.status === 400 && 'body' in err) err = new AppError('Request body contains invalid JSON', 400, 'INVALID_JSON');
  if (err?.name === 'ValidationError') err = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  if (err?.name === 'CastError') err = new AppError('Invalid resource identifier', 400, 'INVALID_ID');
  if (err?.name === 'ZodError') err = new AppError('AI returned data in an unexpected format. Please retry.', 502, 'AI_INVALID_OUTPUT');
  if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err?.name)) err = new AppError('Authentication token is invalid or expired', 401, 'INVALID_TOKEN');
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  if (statusCode >= 500) logger.error('Request failed', { method: req.method, path: req.path, message: err.message });
  const body = { success: false, error: { message: statusCode === 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message, code } };
  if (err.details !== undefined) body.error.details = err.details;
  res.status(statusCode).json(body);
}
