import { Router } from 'express';
import { db } from '../db';
import { words } from '../db/schema';
import { eq, and, gt, lte, asc, ne } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ownedRow, pickDefined } from '../lib/validation';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Debe coincidir con KNOWN_INTERVAL_DAYS en frontend/src/lib/srs.ts: es el
// intervalo a partir del cual una tarjeta cuenta como dominada ("madura" en
// Anki). Si cambias uno, cambia el otro.
const KNOWN_INTERVAL_DAYS = 21;

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  // ?language= evita descargar todo el vocabulario cuando solo interesa el
  // idioma del libro abierto (el lector lo usa para resaltar).
  const language = typeof req.query.language === 'string' && req.query.language
    ? req.query.language
    : undefined;
  const rows = await db.select().from(words).where(
    language
      ? and(eq(words.userId, userId), eq(words.language, language))
      : eq(words.userId, userId),
  );
  res.json(rows);
});

// Cards for a flashcard session: reviews already due + up to `newLimit` new
// ones. Uses the (user_id, srs_due) index instead of shipping the whole vocab.
router.get('/due', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const newLimit = Math.min(1000, Math.max(0, parseInt(String(req.query.newLimit)) || 0));
  const now = new Date().toISOString();
  // Filtrar ignoradas en SQL, no después del LIMIT: si no, la sesión recibe
  // menos tarjetas nuevas de las pedidas cuando hay ignoradas por medio.
  const notIgnored = ne(words.status, 'ignored');

  const dueReviews = await db.select().from(words)
    .where(and(eq(words.userId, userId), gt(words.srsReps, 0), lte(words.srsDue, now), notIgnored))
    .orderBy(asc(words.srsDue));

  const newCards = newLimit > 0
    ? await db.select().from(words)
        .where(and(eq(words.userId, userId), eq(words.srsReps, 0), notIgnored))
        .orderBy(asc(words.srsDue))
        .limit(newLimit)
    : [];

  res.json([...dueReviews, ...newCards]);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { term, translation, definition, example, language, sourceBookId, source, phonetic, partOfSpeech, synonyms, lemma, difficulty } = req.body;
  if (!term?.trim()) return res.status(400).json({ error: 'term is required' });

  const wordId = uuidv4();
  try {
    await db.insert(words).values({
      id: wordId,
      userId,
      term: term.trim(),
      translation: translation?.trim() || null,
      definition: definition?.trim() || null,
      example: example?.trim() || null,
      language: language || 'en',
      source: source || null,
      sourceBookId: sourceBookId || null,
      phonetic: phonetic || null,
      partOfSpeech: partOfSpeech || null,
      synonyms: synonyms || null,
      lemma: lemma || null,
      difficulty: difficulty || null,
      srsDue: new Date().toISOString(),
    });
  } catch (error) {
    // Unique constraint → word already exists for this user/language
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Word already exists' });
    }
    throw error;
  }

  res.json({ success: true, id: wordId });
});

// Importación en lote (CSV): una sola request en vez de una por fila. Los
// duplicados (userId+language+term) se saltan silenciosamente.
router.post('/batch', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const items: unknown[] = Array.isArray(req.body?.words) ? req.body.words : [];
  const now = new Date().toISOString();

  const rows = items
    .filter((w): w is Record<string, unknown> =>
      typeof w === 'object' && w !== null && typeof (w as Record<string, unknown>).term === 'string' && String((w as Record<string, unknown>).term).trim().length > 0)
    .slice(0, 1000)
    .map((w) => ({
      id: uuidv4(),
      userId,
      term: String(w.term).trim(),
      translation: typeof w.translation === 'string' && w.translation.trim() ? w.translation.trim() : null,
      definition: typeof w.definition === 'string' && w.definition.trim() ? w.definition.trim() : null,
      example: typeof w.example === 'string' && w.example.trim() ? w.example.trim() : null,
      language: typeof w.language === 'string' && w.language ? w.language : 'en',
      source: 'import',
      srsDue: now,
    }));

  if (rows.length === 0) return res.status(400).json({ error: 'No valid words' });

  await db.insert(words).values(rows).onConflictDoNothing();
  res.json({ success: true, imported: rows.length });
});

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const wordId = String(req.params.id);

  const existing = ownedRow(
    await db.select().from(words).where(eq(words.id, wordId)),
    userId,
  );
  if (!existing) return res.status(404).json({ error: 'Word not found' });

  // Whitelist anti mass-assignment: solo estas columnas puede tocar el cliente.
  const WORD_UPDATABLE = [
    'srsInterval', 'srsEase', 'srsReps', 'srsLapses', 'srsDue',
    'lastReviewedAt', 'translation', 'definition', 'example', 'language',
    'phonetic', 'partOfSpeech', 'synonyms', 'lemma', 'difficulty',
  ] as const;
  const SRS_NUMERIC = ['srsInterval', 'srsEase', 'srsReps', 'srsLapses'] as const;

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    ...pickDefined(req.body, WORD_UPDATABLE),
  };
  for (const key of SRS_NUMERIC) {
    if (patch[key] !== undefined) patch[key] = Number(patch[key]);
  }

  // Derive status from SRS data when SRS fields are present; otherwise use explicit status
  if (patch.srsReps !== undefined && patch.srsInterval !== undefined) {
    patch.status =
      (patch.srsInterval as number) >= KNOWN_INTERVAL_DAYS ? 'known' :
      patch.srsReps === 0                                  ? 'new'   : 'learning';
  } else if (req.body.status !== undefined) {
    patch.status = req.body.status;
  }

  await db.update(words).set(patch).where(eq(words.id, wordId));
  res.json({ success: true });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const wordId = String(req.params.id);

  const existing = ownedRow(
    await db.select().from(words).where(eq(words.id, wordId)),
    userId,
  );
  if (!existing) return res.status(404).json({ error: 'Word not found' });

  await db.delete(words).where(eq(words.id, wordId));
  res.json({ success: true });
});

export default router;
