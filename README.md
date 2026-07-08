# Readmere — Backend

API Express + TypeScript con Drizzle ORM sobre SQLite (Turso/libsql).

## Requisitos

Node 20+. Variables de entorno en `.env` (no se versiona):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `TURSO_DATABASE_URL` | sí (o usa `file:./local.db`) | URL de la base Turso/libsql |
| `TURSO_AUTH_TOKEN` | con Turso | Token de la base |
| `JWT_SECRET` | en producción | Secreto de firma de JWT (falla el arranque si falta con `NODE_ENV=production`) |
| `FRONTEND_URL` | en producción | Origen permitido por CORS y destino de los redirects de OAuth (def: `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Login con Google; sin ellas la ruta responde 503 |
| `GOOGLE_CALLBACK_URL` | no | Def: `http://localhost:3000/api/auth/google/callback` |
| `ADMIN_SECRET` | no | Si el signup incluye `admin_secret` igual a este valor, la cuenta se crea como admin |
| `PORT` | no | Def: 3000 |

## Scripts

```bash
npm run dev        # desarrollo (tsx watch)
npm run build      # compila a dist/
npm start          # producción (node dist/index.js)
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

## Migraciones

Schema en `src/db/schema.ts`; migraciones con `npx drizzle-kit push`.

> ⚠️ `drizzle-kit push` tiene un bug con índices en libsql: intenta hacer
> DROP antes de CREATE. Si toca un índice, aplicar el SQL a mano (ver
> `drizzle/*.sql`) y dejar que push reconcilie después.

Scripts puntuales en `scripts/`:

```bash
npx tsx scripts/make-admin.ts <email>   # promociona un usuario a admin
```

## Notas de diseño

- Auth por JWT (7 días) con renovación silenciosa (`POST /auth/refresh`).
  `requireAuth` verifica en BD que la cuenta siga activa (caché 60s), así una
  suspensión expulsa al usuario de inmediato.
- Errores: los handlers async no llevan try/catch; cualquier rejection cae en
  el manejador central de `src/index.ts`, que loguea y responde 500.
- Ownership: recurso inexistente y recurso ajeno responden ambos 404.
- El umbral de tarjeta "dominada" (`KNOWN_INTERVAL_DAYS = 21` en
  `src/routes/words.ts`) debe coincidir con `frontend/src/lib/srs.ts`.
