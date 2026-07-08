// Small, dependency-free validation helpers shared across write routes.

/** Round to an integer and clamp into [min, max]; return `fallback` if not a number. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  // null/undefined/'' coerce to 0 via Number(), so treat them as "no value".
  if (value === null || value === undefined || value === '') return fallback;
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Copy only the whitelisted keys whose value is defined. Guards against
 * mass-assignment (e.g. a client trying to overwrite id/userId on update).
 */
export function pickDefined<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  keys: readonly (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) {
    const v = source[key as string];
    if (v !== undefined) out[key] = v as T[keyof T];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email normalizado (trim + minúsculas) o null si no tiene pinta de email. */
export function normalizeEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  return EMAIL_RE.test(s) ? s : null;
}

/** Día en formato YYYY-MM-DD (el que usan studySessions y el streak). */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Primera fila si existe y pertenece al usuario; null si no. Los handlers
 * responden 404 en ambos casos ("no existe" y "no es tuyo" deben ser
 * indistinguibles para no confirmar la existencia de recursos ajenos).
 */
export function ownedRow<T extends { userId: string }>(rows: T[], userId: string): T | null {
  return rows.length > 0 && rows[0].userId === userId ? rows[0] : null;
}
