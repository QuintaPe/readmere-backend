import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Response } from "express";

// requireAuth consulta el estado vigente del usuario en BD (vía user-access);
// aquí se mockea ese módulo para no depender de Turso.
const access = new Map<string, { active: boolean; role: string; email: string } | null>([
  ["u1", { active: true, role: "user", email: "a@b.com" }],
  ["u2", { active: true, role: "admin", email: "admin@b.com" }],
  ["u3", { active: false, role: "user", email: "banned@b.com" }],
]);

vi.mock("../lib/user-access", () => ({
  getUserAccess: vi.fn(async (id: string) => access.get(id) ?? null),
  invalidateUserAccess: vi.fn(),
}));

import { requireAuth, requireAdmin, AuthRequest } from "./auth";
import { JWT_SECRET } from "../config";

function mockRes() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function reqWithAuth(header?: string): AuthRequest {
  return { headers: header ? { authorization: header } : {} } as AuthRequest;
}

const userPayload = { id: "u1", email: "a@b.com", role: "user" };
const adminPayload = { id: "u2", email: "admin@b.com", role: "admin" };
const suspendedPayload = { id: "u3", email: "banned@b.com", role: "user" };

describe("requireAuth", () => {
  it("rejects requests without Authorization header", async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects non-Bearer headers", async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth("Basic abc"), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects invalid tokens", async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth("Bearer not-a-jwt"), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects tokens signed with another secret", async () => {
    const forged = jwt.sign(userPayload, "wrong-secret");
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth(`Bearer ${forged}`), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a valid token whose user is suspended", async () => {
    const token = jwt.sign(suspendedPayload, JWT_SECRET);
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth(`Bearer ${token}`), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const token = jwt.sign({ id: "ghost", email: "x@b.com", role: "user" }, JWT_SECRET);
    const res = mockRes();
    const next = vi.fn();
    await requireAuth(reqWithAuth(`Bearer ${token}`), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts a valid token and attaches the user (role from DB)", async () => {
    const token = jwt.sign(userPayload, JWT_SECRET);
    const req = reqWithAuth(`Bearer ${token}`);
    const next = vi.fn();
    await requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject(userPayload);
  });

  it("uses the CURRENT role from DB, not the one baked into the token", async () => {
    // Token viejo dice admin, pero en BD el usuario ya es 'user'.
    const staleAdmin = jwt.sign({ id: "u1", email: "a@b.com", role: "admin" }, JWT_SECRET);
    const req = reqWithAuth(`Bearer ${staleAdmin}`);
    const next = vi.fn();
    await requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.role).toBe("user");
  });
});

describe("requireAdmin", () => {
  it("rejects a valid token whose role is not admin", async () => {
    const token = jwt.sign(userPayload, JWT_SECRET);
    const res = mockRes();
    const next = vi.fn();
    await requireAdmin(reqWithAuth(`Bearer ${token}`), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts an admin token", async () => {
    const token = jwt.sign(adminPayload, JWT_SECRET);
    const next = vi.fn();
    await requireAdmin(reqWithAuth(`Bearer ${token}`), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
