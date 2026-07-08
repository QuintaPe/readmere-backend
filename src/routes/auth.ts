import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { users, profiles } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { signUserToken } from '../lib/tokens';
import { normalizeEmail } from '../lib/validation';

const router = Router();

// Throttle credential endpoints to blunt brute-force / credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, inténtalo más tarde' },
});

// Cuentas antiguas pueden tener el email con mayúsculas: comparar siempre en
// minúsculas en vez de confiar en que el dato guardado esté normalizado.
function findByEmail(email: string) {
  return db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
}

router.post('/signup', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  // camelCase es el formato actual; display_name se acepta por clientes antiguos.
  const displayName = req.body.displayName ?? req.body.display_name;

  if (!email) return res.status(400).json({ error: 'Email no válido' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const existing = await findByEmail(email);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const adminSecret = process.env.ADMIN_SECRET;
  const role = (adminSecret && req.body.admin_secret === adminSecret) ? 'admin' : 'user';

  await db.insert(users).values({ id: userId, email, passwordHash, role });
  await db.insert(profiles).values({
    id: userId,
    displayName: String(displayName || email.split('@')[0]).slice(0, 100),
  });

  const token = signUserToken({ id: userId, email, role });
  res.json({ token, user: { id: userId, email, role } });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  // Entrada malformada = credenciales inválidas; sin pistas extra.
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const userResult = await findByEmail(email);
  if (userResult.length === 0) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const user = userResult[0];

  if (!user.passwordHash) {
    return res.status(400).json({ error: 'Esta cuenta usa Google para iniciar sesión' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const token = signUserToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get('/session', requireAuth, async (req: AuthRequest, res) => {
  // requireAuth ya refresca role/status desde la BD, así que esto es fiable.
  res.json({ user: req.user });
});

// Renovación silenciosa: emite un token fresco si el actual sigue siendo
// válido y el usuario existe y está activo. El cliente lo llama cuando a su
// token le queda poca vida, así una cuenta activa nunca caduca de golpe.
router.post('/refresh', requireAuth, async (req: AuthRequest, res) => {
  const current = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (current.length === 0 || current[0].status !== 'active') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const u = current[0];
  const token = signUserToken(u);
  res.json({ token });
});

router.post('/logout', requireAuth, (req, res) => {
  res.json({ success: true });
});

export default router;
