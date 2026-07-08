import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN google_id TEXT`);
    console.log('Added google_id column');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('google_id column already exists');
    } else {
      throw e;
    }
  }

  try {
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL`);
    console.log('Created unique index on google_id');
  } catch (e) {
    console.log('Index:', e instanceof Error ? e.message : e);
  }

  console.log('Migration complete');
  process.exit(0);
}

main().catch(console.error);
