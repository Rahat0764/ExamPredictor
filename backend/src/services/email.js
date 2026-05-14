const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_NAME = process.env.APP_NAME || 'ExamPredictor';
const BACKEND_URL = process.env.BACKEND_URL || '';

async function sendVerificationEmail(email, name, token) {
  const url = `${BACKEND_URL}/auth/verify-email?token=${token}`;
  try {
    await resend.emails.send({
      from: `${APP_NAME} <verify@anorr.com>`,
      to: email,
      subject: `Verify your ${APP_NAME} account`,
      html: `
        <div style="font-family: Sora, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0d0d14; color: #f0eeff; border-radius: 16px;">
          <h2 style="color: #a78bfa; margin-bottom: 8px;">Welcome to ${APP_NAME}! 🎯</h2>
          <p style="color: #8b85a8; margin-bottom: 24px;">Hi ${name || 'there'}, please verify your email to get started.</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
            ✅ Verify Email
          </a>
          <p style="color: #8b85a8; font-size: 13px;">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email send error:', e.message);
  }
}

async function sendPasswordResetEmail(email, name, token) {
  const FRONTEND_URL = process.env.FRONTEND_URL || '';
  const url = `${FRONTEND_URL}/reset-password?token=${token}`;
  try {
    await resend.emails.send({
      from: `${APP_NAME} <reset@anorr.com>`,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <div style="font-family: Sora, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0d0d14; color: #f0eeff; border-radius: 16px;">
          <h2 style="color: #a78bfa; margin-bottom: 8px;">Password Reset 🔑</h2>
          <p style="color: #8b85a8; margin-bottom: 24px;">Hi ${name || 'there'}, click below to reset your password.</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
            🔑 Reset Password
          </a>
          <p style="color: #8b85a8; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email send error:', e.message);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };