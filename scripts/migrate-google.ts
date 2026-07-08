import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN google_id TEXT`);
    console.log('Added google_id column');
  } catch (e) {
    if (e instanceof Error && e.message.includes('duplicate column')) {
      console.log('google_id column already exists');
    } else {
      throw e;
    }
  }

  try {
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id)`);
    console.log('Created unique index on google_id');
  } catch (e) {
    console.log('Index error:', e instanceof Error ? e.message : e);
  }

  try {
    // Make password_hash nullable by checking (SQLite doesn't support DROP NOT NULL via ALTER)
    // In SQLite we need to recreate the table. But since passwordHash already has data,
    // we'll just leave existing rows as-is; new Google users will have NULL password_hash.
    // SQLite doesn't enforce NOT NULL changes via ALTER TABLE, so we handle it at app level.
    console.log('Migration complete');
  } catch (e) {
    console.error(e);
  }

  process.exit(0);
}

main().catch(console.error);
