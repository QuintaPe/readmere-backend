import { Router } from 'express';
import { db } from '../db';
import { decks, deckWords, words } from '../db/schema';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ownedRow } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

async function getOwnedDeck(deckId: string, userId: string) {
  return ownedRow(
    await db.select().from(decks).where(eq(decks.id, deckId)),
    userId,
  );
}

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [allDecks, wordCounts] = await Promise.all([
    db.select().from(decks).where(eq(decks.userId, userId)),
    db.select({ deckId: deckWords.deckId, count: count() })
      .from(deckWords)
      .where(eq(deckWords.userId, userId))
      .groupBy(deckWords.deckId),
  ]);

  const countMap = new Map(wordCounts.map((r) => [r.deckId, r.count]));
  const result = allDecks.map((d) => ({
    ...d,
    wordCount: countMap.get(d.id) ?? 0,
  }));

  res.json(result);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { name, description, color } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const deckId = uuidv4();
  await db.insert(decks).values({
    id: deckId,
    userId,
    name: name.trim().slice(0, 100),
    description: typeof description === 'string' ? description.slice(0, 500) : null,
    color: typeof color === 'string' && color ? color.slice(0, 30) : undefined,
  });

  res.json({ success: true, id: deckId });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const deckId = String(req.params.id);

  const deck = await getOwnedDeck(deckId, userId);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  await db.delete(decks).where(eq(decks.id, deckId));
  res.json({ success: true });
});

router.get('/:id/words', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const deckId = String(req.params.id);

  const deck = await getOwnedDeck(deckId, userId);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  // JOIN en vez de descargar todo el vocabulario del usuario y cruzarlo en JS.
  const rows = await db
    .select({ word: words })
    .from(deckWords)
    .innerJoin(words, eq(deckWords.wordId, words.id))
    .where(eq(deckWords.deckId, deckId));

  res.json(rows);
});

router.post('/:id/words', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const deckId = String(req.params.id);
  const { wordId } = req.body;

  if (typeof wordId !== 'string' || !wordId) {
    return res.status(400).json({ error: 'wordId is required' });
  }

  const deck = await getOwnedDeck(deckId, userId);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  // La palabra también debe ser del usuario: sin esto se podrían colgar
  // palabras ajenas (por id) de un mazo propio.
  const word = ownedRow(
    await db.select().from(words).where(eq(words.id, wordId)),
    userId,
  );
  if (!word) return res.status(404).json({ error: 'Word not found' });

  await db.insert(deckWords).values({ deckId, wordId, userId }).onConflictDoNothing();
  res.json({ success: true });
});

router.delete('/:id/words/:wordId', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const deckId = String(req.params.id);
  const wordId = String(req.params.wordId);

  const deck = await getOwnedDeck(deckId, userId);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  await db.delete(deckWords).where(and(eq(deckWords.deckId, deckId), eq(deckWords.wordId, wordId)));
  res.json({ success: true });
});

export default router;
