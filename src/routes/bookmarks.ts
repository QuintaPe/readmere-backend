import { Router } from 'express';
import { db } from '../db';
import { bookmarks, books } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ownedRow } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const bookId = req.query.bookId;
  if (typeof bookId !== 'string' || !bookId) {
    return res.status(400).json({ error: 'bookId required' });
  }
  const rows = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)));
  res.json(rows);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { bookId, cfi, chapter, note, phrase, excerpt } = req.body;
  if (typeof bookId !== 'string' || !bookId || typeof cfi !== 'string' || !cfi) {
    return res.status(400).json({ error: 'bookId and cfi required' });
  }

  // El libro debe ser del usuario; evita marcar libros ajenos por id.
  const book = ownedRow(
    await db.select().from(books).where(eq(books.id, bookId)),
    userId,
  );
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const id = uuidv4();
  await db.insert(bookmarks).values({ id, userId, bookId, cfi, chapter, note, phrase, excerpt });
  res.json({ success: true, id });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const bookmark = ownedRow(
    await db.select().from(bookmarks).where(eq(bookmarks.id, id)),
    userId,
  );
  if (!bookmark) return res.status(404).json({ error: 'Not found' });

  await db.delete(bookmarks).where(eq(bookmarks.id, id));
  res.json({ success: true });
});

export default router;
