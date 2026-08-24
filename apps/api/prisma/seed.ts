import { PrismaClient, PublishStatus, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// Senha de DESENVOLVIMENTO apenas — nunca usar em homologação/produção.
const DEV_PASSWORD = 'Dev@12345';

const INSTRUMENTS = [
  { name: 'Cordas', slug: 'cordas', description: 'Violão e guitarra' },
  { name: 'Teclado/Piano', slug: 'teclado-piano', description: 'Teclado e piano' },
  { name: 'Bateria', slug: 'bateria', description: 'Bateria' },
];

async function main() {
  const [studentRole, teacherRole, adminRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'student' }, update: {}, create: { name: 'student' } }),
    prisma.role.upsert({ where: { name: 'teacher' }, update: {}, create: { name: 'teacher' } }),
    prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } }),
  ]);

  for (const [index, instrument] of INSTRUMENTS.entries()) {
    await prisma.instrument.upsert({
      where: { slug: instrument.slug },
      update: {},
      create: { ...instrument, status: PublishStatus.PUBLISHED, order: index },
    });
  }

  const passwordHash = await hash(DEV_PASSWORD, 10);

  const testUsers = [
    { name: '[DEV] Aluno Teste', email: 'aluno.dev@example.com', roleId: studentRole.id },
    { name: '[DEV] Professor Teste', email: 'professor.dev@example.com', roleId: teacherRole.id },
    { name: '[DEV] Administrador Teste', email: 'admin.dev@example.com', roleId: adminRole.id },
  ];

  for (const testUser of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: testUser.email },
      update: {},
      create: {
        name: testUser.name,
        email: testUser.email,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: testUser.roleId } },
      update: {},
      create: { userId: user.id, roleId: testUser.roleId },
    });
  }

  console.log('Seed concluído.');
  console.log('Usuários de DESENVOLVIMENTO criados (NÃO usar em homologação/produção):');
  for (const testUser of testUsers) {
    console.log(`  - ${testUser.email} / senha: ${DEV_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
