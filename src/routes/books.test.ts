import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

// La base real es Turso; aquí solo interesa la lógica de la ruta, así que se
// mockea el cliente drizzle con cadenas select/update mínimas.
const selectWhere = vi.fn();
const updateSet = vi.fn();

vi.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhere }) }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        updateSet(patch);
        return { where: async () => undefined };
      },
    }),
  },
}));

// requireAuth valida el estado del usuario contra BD; se mockea para que las
// queries de la ruta (selectWhere) no se mezclen con la del middleware.
vi.mock("../lib/user-access", () => ({
  getUserAccess: vi.fn(async () => ({ active: true, role: "user", email: "a@b.com" })),
  invalidateUserAccess: vi.fn(),
}));

import booksRouter from "./books";

const app = express();
app.use(express.json());
app.use("/books", booksRouter);
// Igual que en index.ts: los errores async acaban en el manejador central.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "Internal server error" });
});

const token = jwt.sign(
  { id: "u1", email: "a@b.com", role: "user" },
  JWT_SECRET,
);
const ownBook = { id: "b1", userId: "u1", title: "Old", filePath: "path" };

beforeEach(() => {
  selectWhere.mockReset();
  updateSet.mockReset();
});

describe("PUT /books/:id", () => {
  it("requires auth", async () => {
    const res = await request(app).put("/books/b1").send({ title: "X" });
    expect(res.status).toBe(401);
  });

  it("responds 404 for someone else's book (indistinguishable from missing)", async () => {
    selectWhere.mockResolvedValue([{ ...ownBook, userId: "other" }]);
    const res = await request(app)
      .put("/books/b1")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "X" });
    expect(res.status).toBe(404);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("only applies whitelisted fields (mass-assignment guard)", async () => {
    selectWhere.mockResolvedValue([ownBook]);
    const res = await request(app)
      .put("/books/b1")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Nuevo título",
        userId: "hacker",
        filePath: "evil://path",
        id: "b999",
        createdAt: "1970-01-01",
      });
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledTimes(1);
    const patch = updateSet.mock.calls[0][0];
    expect(patch).toEqual({ title: "Nuevo título" });
  });

  it("clamps progress to [0, 1] and parses publishedYear", async () => {
    selectWhere.mockResolvedValue([ownBook]);
    await request(app)
      .put("/books/b1")
      .set("Authorization", `Bearer ${token}`)
      .send({ progress: 7, publishedYear: "1984" });
    const patch = updateSet.mock.calls[0][0];
    expect(patch.progress).toBe(1);
    expect(patch.publishedYear).toBe(1984);
  });

  it("returns 400 when no updatable field is provided", async () => {
    selectWhere.mockResolvedValue([ownBook]);
    const res = await request(app)
      .put("/books/b1")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: "hacker" });
    expect(res.status).toBe(400);
    expect(updateSet).not.toHaveBeenCalled();
  });
});
