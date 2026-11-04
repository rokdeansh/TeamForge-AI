import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!parsed.success) return next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))));
    req.validated = parsed.data;
    next();
  };
}
