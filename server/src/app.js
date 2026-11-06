import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { UPLOAD_DIR } from './lib/storage.js';
import { loadUser } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/error.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { booksRouter } from './routes/books.js';
import { conversationsRouter } from './routes/conversations.js';
import { notificationsRouter } from './routes/notifications.js';
import { reportsRouter } from './routes/reports.js';
import { requestsRouter } from './routes/requests.js';
import { usersRouter } from './routes/users.js';
import { wishlistRouter } from './routes/wishlist.js';

const CLIENT_DIST = path.resolve(import.meta.dirname, '../../client/dist');

export function createApp({ authLimit } = {}) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'], upgradeInsecureRequests: null },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));

  const api = express.Router();
  api.use(loadUser);
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter({ authLimit }));
  api.use('/users', usersRouter);
  api.use('/books', booksRouter);
  api.use('/wishlist', wishlistRouter);
  api.use('/requests', requestsRouter);
  api.use('/conversations', conversationsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/reports', reportsRouter);
  api.use('/admin', adminRouter);
  api.use(apiNotFound);
  app.use('/api', api);

  // In production the API also serves the built client; unknown paths go to React Router.
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res, next) => res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => err && next()));
  app.use(apiNotFound);
  app.use(errorHandler);
  return app;
}
