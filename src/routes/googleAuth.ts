import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db';
import { users, profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { signUserToken } from '../lib/tokens';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Sin credenciales de Google el servidor debe arrancar igualmente (p. ej. en
// local sin OAuth); la ruta responde 503 en vez de tirar el proceso al boot.
const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

if (googleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) return done(new Error('No email from Google'));

      // Find by googleId first, then by email
      let userResult = await db.select().from(users).where(eq(users.googleId, profile.id));

      if (userResult.length === 0 && email) {
        userResult = await db.select().from(users).where(eq(users.email, email));
      }

      if (userResult.length > 0) {
        const user = userResult[0];
        // Link Google ID if not already linked
        if (!user.googleId) {
          await db.update(users).set({ googleId: profile.id }).where(eq(users.id, user.id));
        }
        return done(null, user);
      }

      // Create new user
      const userId = uuidv4();
      const displayName = profile.displayName || email.split('@')[0];

      await db.insert(users).values({ id: userId, email, googleId: profile.id });
      await db.insert(profiles).values({ id: userId, displayName });

      const newUser = { id: userId, email, googleId: profile.id, role: 'user' };
      return done(null, newUser as Express.User);
    } catch (err) {
      return done(err as Error);
    }
  }));
}

router.get('/google', (req, res, next) => {
  if (!googleConfigured) {
    return res.status(503).json({ error: 'Google OAuth no está configurado en este servidor' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/auth?error=google` }),
  (req, res) => {
    const user = req.user as Express.User;
    const token = signUserToken({ id: user.id, email: user.email, role: user.role || 'user' });
    // Fragment (#) en vez de query (?): el token no llega a logs de servidores,
    // historial compartible ni cabeceras Referer.
    res.redirect(`${FRONTEND_URL}/auth/callback#token=${encodeURIComponent(token)}`);
  }
);

export default router;
