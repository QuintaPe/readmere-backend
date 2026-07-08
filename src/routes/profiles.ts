import { Router } from 'express';
import { db } from '../db';
import { profiles, studySessions } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { clampInt } from '../lib/validation';

const router = Router();

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const userProfile = await db.select().from(profiles).where(eq(profiles.id, userId));

  if (userProfile.length === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(userProfile[0]);
});

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { displayName, targetLanguage, nativeLanguage, dailyGoal, newCardsPerDay, theme } = req.body;

  // Only set fields the client actually sent; validate the numeric ones.
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (displayName !== undefined) patch.displayName = String(displayName).slice(0, 100);
  if (targetLanguage !== undefined) patch.targetLanguage = String(targetLanguage).slice(0, 10);
  if (nativeLanguage !== undefined) patch.nativeLanguage = String(nativeLanguage).slice(0, 10);
  if (dailyGoal !== undefined) patch.dailyGoal = clampInt(dailyGoal, 1, 1000, 20);
  if (newCardsPerDay !== undefined) patch.newCardsPerDay = clampInt(newCardsPerDay, 0, 1000, 10);
  if (theme !== undefined && ['dark', 'light', 'system'].includes(theme)) patch.theme = theme;

  await db.update(profiles).set(patch).where(eq(profiles.id, userId));

  res.json({ success: true });
});

router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const sessions = await db.select().from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.day, dateStr)));
  res.json(sessions);
});

export default router;
