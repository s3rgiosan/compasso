import { Router } from 'express';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  updateProfile,
  changePassword,
  SESSION_DURATION_DAYS,
} from '../services/authService.js';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService.js';

const router = Router();

function setSessionCookie(res: import('express').Response, sessionId: string): void {
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  });
}

// POST /api/auth/register
router.post('/register', validate({ body: registerSchema }), asyncHandler((req, res) => {
  const { username, password, email, displayName, locale } = req.body;
  const result = registerUser({ username, password, email, displayName, locale });

  setSessionCookie(res, result.sessionId);

  res.status(201).json({
    success: true,
    data: {
      user: result.user,
      sessionId: result.sessionId,
    },
  });
}));

// POST /api/auth/login
router.post('/login', validate({ body: loginSchema }), asyncHandler((req, res) => {
  const { username, password } = req.body;
  const result = loginUser({ username, password });

  setSessionCookie(res, result.sessionId);

  res.json({
    success: true,
    data: {
      user: result.user,
      sessionId: result.sessionId,
    },
  });
}));

// POST /api/auth/logout
router.post('/logout', authMiddleware, asyncHandler((req, res) => {
  if (req.sessionId) {
    logoutUser(req.sessionId);
  }
  res.clearCookie('session_id');
  res.json({ success: true });
}));

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, validate({ body: updateProfileSchema }), asyncHandler((req, res) => {
  const { displayName, email, locale } = req.body;
  const user = updateProfile(req.user!.id, { displayName, email, locale });
  res.json({ success: true, data: user });
}));

// PUT /api/auth/password
router.put('/password', authMiddleware, validate({ body: changePasswordSchema }), asyncHandler((req, res) => {
  const { currentPassword, newPassword } = req.body;
  changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ success: true });
}));

// POST /api/auth/forgot-password
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  const { email } = req.body;
  const origin = `${req.protocol}://${req.get('host')}`;
  await requestPasswordReset(email, origin);

  res.json({
    success: true,
    data: { message: 'If an account with that email exists, we sent a password reset link.' },
  });
}));

// POST /api/auth/reset-password
router.post('/reset-password', validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  resetPassword(token, newPassword);

  res.json({
    success: true,
    data: { message: 'Password has been reset successfully.' },
  });
}));

export default router;
