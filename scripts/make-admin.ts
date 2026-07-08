import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx make-admin.ts <email>');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await client.execute({
    sql: `UPDATE users SET role = 'admin' WHERE email = ?`,
    args: [email],
  });
  if (result.rowsAffected === 0) {
    console.error(`No user found with email: ${email}`);
  } else {
    console.log(`✓ ${email} is now admin`);
  }
  process.exit(0);
}

main();
