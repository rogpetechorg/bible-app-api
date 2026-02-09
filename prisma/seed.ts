import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create admin user
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@bible.hyno.io' },
  });

  if (!adminExists) {
    console.log('👤 Criando usuário admin...');
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    await prisma.user.create({
      data: {
        email: 'admin@bible.hyno.io',
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log('✅ Admin criado: admin@bible.hyno.io / Admin@123\n');
  } else {
    console.log('👤 Admin já existe\n');
  }

  // Note: Billing plans are created by stripe:setup script
  console.log('💡 Execute "pnpm stripe:setup" para criar os planos de assinatura\n');

  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
