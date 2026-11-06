if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

export const config = {
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT || 5000),
  isProd: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT || 20),
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  smtpUrl: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'Academic Book Marketplace <no-reply@example.com>',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
};
