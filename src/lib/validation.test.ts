import { describe, it, expect } from 'vitest';
import { clampInt, pickDefined } from './validation';

describe('clampInt', () => {
  it('clamps below the minimum', () => {
    expect(clampInt(-5, 0, 100, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clampInt(9999, 0, 100, 10)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(clampInt(3.7, 0, 100, 10)).toBe(4);
  });

  it('accepts numeric strings (form input)', () => {
    expect(clampInt('20', 1, 1000, 5)).toBe(20);
  });

  it('falls back on non-numeric input', () => {
    expect(clampInt('abc', 1, 1000, 10)).toBe(10);
    expect(clampInt(undefined, 1, 1000, 10)).toBe(10);
    expect(clampInt(null, 0, 100, 7)).toBe(7);
  });
});

describe('pickDefined', () => {
  const allowed = ['title', 'author', 'progress'] as const;

  it('keeps only whitelisted, defined keys', () => {
    const body = { title: 'Dune', author: 'Herbert', progress: undefined };
    expect(pickDefined(body, allowed)).toEqual({ title: 'Dune', author: 'Herbert' });
  });

  it('drops keys outside the whitelist (mass-assignment guard)', () => {
    const body = { title: 'Dune', userId: 'attacker', id: 'x', filePath: '/etc' };
    const out = pickDefined(body, allowed);
    expect(out).toEqual({ title: 'Dune' });
    expect('userId' in out).toBe(false);
    expect('filePath' in out).toBe(false);
  });

  it('returns an empty object when nothing matches', () => {
    expect(pickDefined({ foo: 1 }, allowed)).toEqual({});
  });
});
