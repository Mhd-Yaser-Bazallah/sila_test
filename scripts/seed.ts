import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/shared/auth/constants/auth.constants';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the seed script');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const superAdmin = {
  email: 'admin@sila.local',
  password: 'Admin123456!',
  fullName: 'Sila Super Admin',
};

async function main() {
  const passwordHash = await bcrypt.hash(
    superAdmin.password,
    BCRYPT_SALT_ROUNDS,
  );

  await prisma.user.upsert({
    where: { email: superAdmin.email },
    update: {
      passwordHash,
      fullName: superAdmin.fullName,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      email: superAdmin.email,
      passwordHash,
      fullName: superAdmin.fullName,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Seeded SUPER_ADMIN user: ${superAdmin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
