import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  InsertPartner,
  InsertPartnerSchedule,
  users,
  partners,
  partnerSchedules,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// PARTNER HELPERS - 파트너(거래처) 관리
// ============================================================

export async function getPartners(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return await db.select().from(partners).where(
      or(
        like(partners.companyName, `%${search}%`),
        like(partners.contactName, `%${search}%`),
        like(partners.contactPhone, `%${search}%`)
      )
    ).orderBy(desc(partners.createdAt));
  }
  return await db.select().from(partners).orderBy(desc(partners.createdAt));
}

export async function getPartnerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPartner(data: InsertPartner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partners).values(data);
  // mysql2 결과의 insertId 반환 (없으면 0)
  const insertId = Number((result as unknown as { insertId?: number }[])[0]?.insertId ?? 0);
  return { insertId };
}

export async function updatePartner(id: number, data: Partial<InsertPartner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partners).set(data).where(eq(partners.id, id));
}

export async function deletePartner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(partners).where(eq(partners.id, id));
}

// ============================================================
// PARTNER SCHEDULE HELPERS - 파트너 일정 관리
// ============================================================

export async function getPartnerSchedules(opts?: {
  partnerId?: number;
  year?: number;
  month?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts?.partnerId) conditions.push(eq(partnerSchedules.partnerId, opts.partnerId));
  if (opts?.year !== undefined && opts?.month !== undefined) {
    const startOfMonth = new Date(opts.year, opts.month - 1, 1);
    const endOfMonth = new Date(opts.year, opts.month, 0, 23, 59, 59);
    conditions.push(gte(partnerSchedules.startDate, startOfMonth) as any);
    conditions.push(lte(partnerSchedules.endDate, endOfMonth) as any);
  }
  if (conditions.length > 0) {
    return await db.select().from(partnerSchedules).where(and(...conditions)).orderBy(partnerSchedules.startDate);
  }
  return await db.select().from(partnerSchedules).orderBy(partnerSchedules.startDate);
}

export async function createPartnerSchedule(data: InsertPartnerSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partnerSchedules).values(data);
  return result[0];
}

export async function updatePartnerSchedule(id: number, data: Partial<InsertPartnerSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnerSchedules).set(data).where(eq(partnerSchedules.id, id));
}

export async function deletePartnerSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(partnerSchedules).where(eq(partnerSchedules.id, id));
}

/** 이번 주 일정 조회 (월~일) */
export async function getWeeklyPartnerSchedules() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일, 1=월 ...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return await db
    .select()
    .from(partnerSchedules)
    .where(
      and(
        gte(partnerSchedules.startDate, monday),
        lte(partnerSchedules.startDate, sunday)
      )
    )
    .orderBy(partnerSchedules.startDate);
}
