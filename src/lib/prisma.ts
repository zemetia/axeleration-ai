import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // `'query'` logging writes every statement to stdout. Console writes to a Windows
    // terminal are synchronous and block the event loop, so a page issuing a dozen queries
    // pays for a dozen blocking writes on the request path. Opt in with PRISMA_LOG_QUERIES=1
    // when actually debugging SQL.
    log:
      process.env.NODE_ENV === 'development' && process.env['PRISMA_LOG_QUERIES'] === '1'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
