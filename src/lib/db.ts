import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// En Netlify la base de datos la provisiona Netlify Database (NETLIFY_DB_URL)
const datasourceUrl = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;

export const db = globalForPrisma.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
