import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/lib/db/seed';

const prisma = new PrismaClient();

async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding database for Nexora Multi-Tenant Platform...');

  const result = await seedDatabase(prisma);

  // eslint-disable-next-line no-console
  console.log('✅ Database seeded successfully!');
  // eslint-disable-next-line no-console
  console.log(`   - Acme Admin: ${result.acmeAdminEmail}`);
  // eslint-disable-next-line no-console
  console.log(`   - Acme Member: ${result.acmeMemberEmail}`);
  // eslint-disable-next-line no-console
  console.log(`   - Globex Owner: ${result.globexOwnerEmail}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
