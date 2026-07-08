import { Router } from 'express';
import { db } from '../db';
import { books } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ownedRow, pickDefined } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const allBooks = await db.select().from(books).where(eq(books.userId, userId));
  res.json(allBooks);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { filePath, title, author, language, coverPath, synopsis, genre, publishedYear } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required' });
  }

  const bookId = uuidv4();

  await db.insert(books).values({
    id: bookId,
    userId,
    title: title || 'Sin título',
    author,
    language: language || 'en',
    filePath,
    coverPath,
    synopsis,
    genre,
    publishedYear: publishedYear ? parseInt(publishedYear) : undefined,
  });

  res.json({ success: true, id: bookId, filePath });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const bookId = String(req.params.id);
  const book = ownedRow(
    await db.select().from(books).where(eq(books.id, bookId)),
    userId,
  );
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// Columns a user is allowed to change on their own book.
const BOOK_UPDATABLE = [
  'title', 'author', 'language', 'coverPath', 'synopsis', 'genre',
  'publishedYear', 'currentCfi', 'progress', 'lastOpenedAt',
] as const;

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const bookId = String(req.params.id);

  const book = ownedRow(
    await db.select().from(books).where(eq(books.id, bookId)),
    userId,
  );
  if (!book) return res.status(404).json({ error: 'Book not found' });

  // Whitelist: never let the client touch id, userId, filePath or createdAt.
  const patch: Record<string, unknown> = pickDefined(req.body, BOOK_UPDATABLE);
  if (patch.publishedYear !== undefined) {
    const n = parseInt(String(patch.publishedYear), 10);
    patch.publishedYear = Number.isNaN(n) ? null : n;
  }
  if (patch.progress !== undefined) {
    const n = Number(patch.progress);
    patch.progress = Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n));
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  await db.update(books)
    .set(patch)
    .where(eq(books.id, bookId));

  res.json({ success: true });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const bookId = String(req.params.id);

  const book = ownedRow(
    await db.select().from(books).where(eq(books.id, bookId)),
    userId,
  );
  if (!book) return res.status(404).json({ error: 'Book not found' });

  await db.delete(books).where(eq(books.id, bookId));
  res.json({ success: true });
});

export default router;
