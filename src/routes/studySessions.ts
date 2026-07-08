import { Router } from 'express';
import { db } from '../db';
import { studySessions, profiles } from '../db/schema';
import { eq, and, gte, asc, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { clampInt, DAY_RE } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all study sessions for the user (last 7 days)
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const from7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const sessions = await db.select().from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.day, from7)))
    .orderBy(asc(studySessions.day));
  res.json(sessions);
});

// Bump study session for today + update streak
router.post('/bump', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const day = req.body.day;
  if (typeof day !== 'string' || !DAY_RE.test(day)) {
    return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
  }
  // Solo incrementos razonables: sin negativos ni valores absurdos que
  // corrompan estadísticas o el streak.
  const reviews = clampInt(req.body.reviews, 0, 10000, 0);
  const wordsAdded = clampInt(req.body.wordsAdded, 0, 10000, 0);
  const readingMinutes = clampInt(req.body.readingMinutes, 0, 1440, 0);

  // Upsert atómico sobre unique(userId, day): elimina la carrera del viejo
  // select-then-insert y no descarga el historial completo.
  await db.insert(studySessions)
    .values({ id: uuidv4(), userId, day, reviews, wordsAdded, readingMinutes })
    .onConflictDoUpdate({
      target: [studySessions.userId, studySessions.day],
      set: {
        reviews: sql`${studySessions.reviews} + ${reviews}`,
        wordsAdded: sql`${studySessions.wordsAdded} + ${wordsAdded}`,
        readingMinutes: sql`${studySessions.readingMinutes} + ${readingMinutes}`,
      },
    });

  // Update streak in profile
  const profileRes = await db.select().from(profiles).where(eq(profiles.id, userId));
  const profile = profileRes[0];
  if (profile && profile.lastStudyDate !== day) {
    // "Ayer" relativo al día reportado (día local del cliente), no al reloj
    // UTC del servidor: si no, estudiar pasada la medianoche UTC rompe rachas.
    const yesterday = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
    const streak = profile.lastStudyDate === yesterday ? (profile.streakCurrent ?? 0) + 1 : 1;
    await db.update(profiles).set({
      streakCurrent: streak,
      streakLongest: Math.max(profile.streakLongest ?? 0, streak),
      lastStudyDate: day,
    }).where(eq(profiles.id, userId));
  }

  res.json({ success: true });
});

export default router;
