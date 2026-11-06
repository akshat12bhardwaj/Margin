import nodemailer from 'nodemailer';
import { config } from '../config.js';

export async function sendPasswordReset(email, link) {
  if (!config.smtpUrl) {
    // Never log a live reset link in production.
    if (config.isProd) return console.error('SMTP_URL is not set: password reset email not sent');
    return console.info(`[dev] Password reset link for ${email}: ${link}`);
  }
  await nodemailer.createTransport(config.smtpUrl).sendMail({
    from: config.mailFrom,
    to: email,
    subject: 'Reset your Academic Book Marketplace password',
    text: `Reset your password using this link (valid for 1 hour):\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}
