import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

// requireAuth consulta esto en cada request para que suspender o borrar una
// cuenta surta efecto inmediato (antes el JWT seguía valiendo hasta 7 días).
// Se cachea 60s por usuario para no pagar una query extra en ráfagas; las
// acciones de admin llaman a invalidateUserAccess() para saltarse el caché.

export interface UserAccess {
  active: boolean;
  role: string;
  email: string;
}

const TTL_MS = 60_000;
const cache = new Map<string, { value: UserAccess | null; at: number }>();

export async function getUserAccess(userId: string): Promise<UserAccess | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const rows = await db
    .select({ status: users.status, role: users.role, email: users.email })
    .from(users)
    .where(eq(users.id, userId));

  const value = rows.length > 0
    ? { active: rows[0].status === 'active', role: rows[0].role, email: rows[0].email }
    : null;
  cache.set(userId, { value, at: Date.now() });
  return value;
}

export function invalidateUserAccess(userId: string) {
  cache.delete(userId);
}
