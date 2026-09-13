import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SEED_USERS = [
  {
    name: 'Admin',
    email: 'admin@axeleration.ai',
    password: 'Admin123!',
    role: 'ADMIN' as const,
  },
  {
    name: 'Demo User',
    email: 'user@axeleration.ai',
    password: 'User123!',
    role: 'USER' as const,
  },
];

async function main() {
  for (const seedUser of SEED_USERS) {
    const hashedPassword = await bcrypt.hash(seedUser.password, 10);

    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        name: seedUser.name,
        password: hashedPassword,
        role: seedUser.role,
      },
      create: {
        name: seedUser.name,
        email: seedUser.email,
        password: hashedPassword,
        role: seedUser.role,
        emailVerified: new Date(),
      },
    });

    console.log(`Seeded user: ${user.email} (${user.role})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
