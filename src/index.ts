import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';

dotenv.config();

import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import wordRoutes from './routes/words';
import deckRoutes from './routes/decks';
import bookRoutes from './routes/books';
import sessionRoutes from './routes/studySessions';
import adminRoutes from './routes/admin';
import bookmarkRoutes from './routes/bookmarks';
import googleAuthRoutes from './routes/googleAuth';
import reviewLogRoutes from './routes/reviewLogs';

const app = express();
const port = process.env.PORT || 3000;

// Trust the first proxy hop so rate-limiting keys on the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
// Solo el frontend puede llamar a la API desde un navegador; en producción
// FRONTEND_URL debe apuntar al dominio real.
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8080' }));
app.use(express.json());
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/words', wordRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/study-sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/review-logs', reviewLogRoutes);
app.use('/api/auth', googleAuthRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Manejador central de errores: Express 5 propaga aquí cualquier rejection de
// un handler async, así las rutas no necesitan try/catch y ningún error se
// pierde sin loguear.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${req.method} ${req.path}]`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
