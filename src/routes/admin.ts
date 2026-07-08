import { Router, Request } from 'express';
import { db } from '../db';
import { users, profiles, books, words, decks, deckWords, studySessions } from '../db/schema';
import { eq, count, like, or, desc, sql } from 'drizzle-orm';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { normalizeEmail } from '../lib/validation';
import { invalidateUserAccess } from '../lib/user-access';
import { signUserToken } from '../lib/tokens';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function paginate(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const offset = (page - 1) * limit;
  const search = (typeof req.query.search === 'string' ? req.query.search : '').trim();
  return { page, limit, offset, search };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, async (_req, res) => {
  const [[u], [b], [w], [d]] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(books),
    db.select({ count: count() }).from(words),
    db.select({ count: count() }).from(decks),
  ]);
  res.json({ users: u.count, books: b.count, words: w.count, decks: d.count });
});

router.get('/stats/timeline', requireAdmin, async (_req, res) => {
  const [newUsers, newWords, newBooks] = await Promise.all([
    db.all(sql`
      SELECT strftime('%Y-%m-%d', created_at) as day, count(*) as count
      FROM users WHERE created_at >= date('now', '-30 days')
      GROUP BY day ORDER BY day
    `),
    db.all(sql`
      SELECT strftime('%Y-%m-%d', created_at) as day, count(*) as count
      FROM words WHERE created_at >= date('now', '-30 days')
      GROUP BY day ORDER BY day
    `),
    db.all(sql`
      SELECT strftime('%Y-%m-%d', created_at) as day, count(*) as count
      FROM books WHERE created_at >= date('now', '-30 days')
      GROUP BY day ORDER BY day
    `),
  ]);
  res.json({ newUsers, newWords, newBooks });
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
  const { page, limit, offset, search } = paginate(req);
  const condition = search
    ? or(like(users.email, `%${search}%`), like(profiles.displayName, `%${search}%`))
    : undefined;

  const [data, [{ total }]] = await Promise.all([
    db.select({
      id: users.id, email: users.email, role: users.role,
      status: users.status, createdAt: users.createdAt,
      displayName: profiles.displayName, targetLanguage: profiles.targetLanguage,
    })
      .from(users).leftJoin(profiles, eq(users.id, profiles.id))
      .where(condition).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(users)
      .leftJoin(profiles, eq(users.id, profiles.id)).where(condition),
  ]);

  res.json({ data, total, page, limit });
});

router.post('/users', requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, role = 'user' } = req.body;
  // camelCase es el formato actual; display_name se acepta por clientes antiguos.
  const displayName = req.body.displayName ?? req.body.display_name;
  if (!email) return res.status(400).json({ error: 'Email no válido' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) return res.status(400).json({ error: 'User already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  await db.insert(users).values({ id, email, passwordHash, role });
  await db.insert(profiles).values({
    id,
    displayName: String(displayName || email.split('@')[0]).slice(0, 100),
  });

  res.json({ success: true, id });
});

router.get('/users/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const [user] = await db.select({
    id: users.id, email: users.email, role: users.role,
    status: users.status, createdAt: users.createdAt,
    displayName: profiles.displayName, targetLanguage: profiles.targetLanguage,
    nativeLanguage: profiles.nativeLanguage, dailyGoal: profiles.dailyGoal,
    streakCurrent: profiles.streakCurrent, streakLongest: profiles.streakLongest,
  }).from(users).leftJoin(profiles, eq(users.id, profiles.id)).where(eq(users.id, id));

  if (!user) return res.status(404).json({ error: 'User not found' });

  const [[{ booksCount }], [{ wordsCount }], [{ decksCount }], wordsByStatus, recentSessions] = await Promise.all([
    db.select({ booksCount: count() }).from(books).where(eq(books.userId, id)),
    db.select({ wordsCount: count() }).from(words).where(eq(words.userId, id)),
    db.select({ decksCount: count() }).from(decks).where(eq(decks.userId, id)),
    db.all(sql`SELECT status, count(*) as count FROM words WHERE user_id = ${id} GROUP BY status`),
    db.select().from(studySessions).where(eq(studySessions.userId, id))
      .orderBy(desc(studySessions.day)).limit(10),
  ]);

  res.json({ ...user, booksCount, wordsCount, decksCount, wordsByStatus, recentSessions });
});

router.patch('/users/:id/role', requireAdmin, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (id === req.user!.id && role !== 'admin') return res.status(400).json({ error: 'Cannot remove your own admin role' });
  await db.update(users).set({ role }).where(eq(users.id, id));
  invalidateUserAccess(id); // el nuevo rol aplica en el siguiente request
  res.json({ success: true });
});

router.patch('/users/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (id === req.user!.id) return res.status(400).json({ error: 'Cannot suspend yourself' });
  await db.update(users).set({ status }).where(eq(users.id, id));
  invalidateUserAccess(id); // una suspensión expulsa al usuario de inmediato
  res.json({ success: true });
});

router.delete('/users/:id', requireAdmin, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  await db.delete(users).where(eq(users.id, id));
  invalidateUserAccess(id);
  res.json({ success: true });
});

router.post('/users/:id/impersonate', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status === 'suspended') return res.status(400).json({ error: 'User is suspended' });
  // Vida corta: la sesión de impersonación no debe sobrevivir a la tarea de soporte.
  const token = signUserToken(user, '2h');
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// ─── Books ────────────────────────────────────────────────────────────────────

router.get('/books', requireAdmin, async (req, res) => {
  const { page, limit, offset, search } = paginate(req);
  const condition = search
    ? or(like(books.title, `%${search}%`), like(books.author, `%${search}%`), like(users.email, `%${search}%`))
    : undefined;

  const [data, [{ total }]] = await Promise.all([
    db.select({
      id: books.id, title: books.title, author: books.author,
      language: books.language, progress: books.progress, createdAt: books.createdAt,
      ownerEmail: users.email, ownerId: users.id,
    }).from(books).leftJoin(users, eq(books.userId, users.id))
      .where(condition).orderBy(desc(books.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(books).leftJoin(users, eq(books.userId, users.id)).where(condition),
  ]);

  res.json({ data, total, page, limit });
});

router.delete('/books/:id', requireAdmin, async (req, res) => {
  await db.delete(books).where(eq(books.id, String(req.params.id)));
  res.json({ success: true });
});

// ─── Decks ────────────────────────────────────────────────────────────────────

router.get('/decks', requireAdmin, async (req, res) => {
  const { page, limit, offset, search } = paginate(req);
  const condition = search
    ? or(like(decks.name, `%${search}%`), like(users.email, `%${search}%`))
    : undefined;

  const [allDecks, [{ total }], wordCounts] = await Promise.all([
    db.select({
      id: decks.id, name: decks.name, description: decks.description,
      color: decks.color, createdAt: decks.createdAt,
      ownerEmail: users.email, ownerId: users.id,
    }).from(decks).leftJoin(users, eq(decks.userId, users.id))
      .where(condition).orderBy(desc(decks.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(decks).leftJoin(users, eq(decks.userId, users.id)).where(condition),
    db.select({ deckId: deckWords.deckId, count: count() }).from(deckWords).groupBy(deckWords.deckId),
  ]);

  const countMap = Object.fromEntries(wordCounts.map(r => [r.deckId, r.count]));
  res.json({ data: allDecks.map(d => ({ ...d, wordCount: countMap[d.id] ?? 0 })), total, page, limit });
});

router.delete('/decks/:id', requireAdmin, async (req, res) => {
  await db.delete(decks).where(eq(decks.id, String(req.params.id)));
  res.json({ success: true });
});

// ─── Words ────────────────────────────────────────────────────────────────────

router.get('/words', requireAdmin, async (req, res) => {
  const { page, limit, offset, search } = paginate(req);
  const condition = search
    ? or(like(words.term, `%${search}%`), like(words.translation, `%${search}%`), like(users.email, `%${search}%`))
    : undefined;

  const [data, [{ total }]] = await Promise.all([
    db.select({
      id: words.id, term: words.term, translation: words.translation,
      language: words.language, status: words.status, createdAt: words.createdAt,
      ownerEmail: users.email, ownerId: users.id,
    }).from(words).leftJoin(users, eq(words.userId, users.id))
      .where(condition).orderBy(desc(words.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(words).leftJoin(users, eq(words.userId, users.id)).where(condition),
  ]);

  res.json({ data, total, page, limit });
});

router.delete('/words/:id', requireAdmin, async (req, res) => {
  await db.delete(words).where(eq(words.id, String(req.params.id)));
  res.json({ success: true });
});

export default router;
