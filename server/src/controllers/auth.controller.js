import * as service from '../services/auth.service.js';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookies.js';

export async function register(req, res) {
  const result = await service.beginRegistration(req.validated.body);
  res.status(202).json({ success: true, data: { verificationRequired: true, email: result.email } });
}
export async function verifyRegistration(req, res) {
  const result = await service.verifyRegistration(req.validated.body);
  setAuthCookie(res, result.token);
  res.status(201).json({ success: true, data: { user: result.user } });
}
export async function resendRegistrationOtp(req, res) {
  const result = await service.resendRegistrationOtp(req.validated.body);
  res.json({ success: true, data: { sent: true, email: result.email } });
}
export async function login(req, res) {
  const result = await service.login(req.validated.body);
  setAuthCookie(res, result.token);
  res.json({ success: true, data: { user: result.user } });
}
export function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ success: true, data: { loggedOut: true } });
}
export async function me(req, res) { res.json({ success: true, data: { user: await service.getProfile(req.user.id) } }); }
export async function updateMe(req, res) { res.json({ success: true, data: { user: await service.updateProfile(req.user.id, req.validated.body) } }); }
