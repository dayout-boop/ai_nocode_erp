import { getDb } from '../server/db.ts';
import { adminAccounts } from '../drizzle/schema.ts';

const db = await getDb();
const rows = await db.select({
  id: adminAccounts.id,
  username: adminAccounts.username,
  role: adminAccounts.role,
  isActive: adminAccounts.isActive
}).from(adminAccounts);
console.log('admin_accounts:', JSON.stringify(rows, null, 2));
process.exit(0);
