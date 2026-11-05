import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { protect } from '../middleware/protect.js';
import { validate } from '../middleware/validate.js';
import { authRateLimit } from '../middleware/rateLimits.js';
import { registerSchema, registrationEmailSchema, registrationVerifySchema, loginSchema, updateProfileSchema } from '../validators/auth.validators.js';

const router = Router();
router.post('/register', authRateLimit, validate(registerSchema), controller.register);
router.post('/register/verify', authRateLimit, validate(registrationVerifySchema), controller.verifyRegistration);
router.post('/register/resend', authRateLimit, validate(registrationEmailSchema), controller.resendRegistrationOtp);
router.post('/login', authRateLimit, validate(loginSchema), controller.login);
router.post('/logout', controller.logout);
router.get('/me', protect, controller.me);
router.patch('/me', protect, validate(updateProfileSchema), controller.updateMe);
export default router;
