import { Router } from 'express';
import { db } from '../db';
import { reviewLogs, words } from '../db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ownedRow } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { wordId, rating } = req.body;
  const r = Number(rating);
  if (typeof wordId !== 'string' || !wordId || !Number.isInteger(r) || r < 0 || r > 3) {
    return res.status(400).json({ error: 'wordId and rating (0-3) are required' });
  }

  // La palabra debe ser del usuario: sin esto se pueden insertar repasos
  // sobre palabras ajenas y contaminar la métrica de retención de otros.
  const word = ownedRow(
    await db.select().from(words).where(eq(words.id, wordId)),
    userId,
  );
  if (!word) return res.status(404).json({ error: 'Word not found' });

  await db.insert(reviewLogs).values({
    id: uuidv4(),
    userId,
    wordId,
    rating: r,
    reviewedAt: new Date().toISOString(),
  });
  res.json({ success: true });
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days)) || 30));
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await db.select().from(reviewLogs)
    .where(and(eq(reviewLogs.userId, userId), gte(reviewLogs.reviewedAt, from)));
  res.json(rows);
});

export default router;
