import { drizzle } from 'drizzle-orm/mysql2';
import { int, mysqlTable, varchar, text, boolean, decimal, timestamp, mysqlEnum } from 'drizzle-orm/mysql-core';
import dotenv from 'dotenv';
dotenv.config();

const packages = mysqlTable('packages', {
  id: int('id').autoincrement().primaryKey(),
  status: varchar('status', { length: 32 }),
  title: text('title'),
  country: varchar('country', { length: 64 }),
});

const db = drizzle(process.env.DATABASE_URL);
const rows = await db.select().from(packages);
console.log('packages count:', rows.length);
console.log(JSON.stringify(rows, null, 2));
