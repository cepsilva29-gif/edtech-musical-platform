import {
  CourseLevel,
  PrismaClient,
  PublishStatus,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
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

  const instrumentsBySlug = new Map<string, { id: string }>();
  for (const [index, instrument] of INSTRUMENTS.entries()) {
    const created = await prisma.instrument.upsert({
      where: { slug: instrument.slug },
      update: {},
      create: { ...instrument, status: PublishStatus.PUBLISHED, order: index },
    });
    instrumentsBySlug.set(instrument.slug, created);
  }

  const passwordHash = await hash(DEV_PASSWORD, 10);

  const testUsers = [
    { name: '[DEV] Aluno Teste', email: 'aluno.dev@example.com', roleId: studentRole.id },
    { name: '[DEV] Professor Teste', email: 'professor.dev@example.com', roleId: teacherRole.id },
    { name: '[DEV] Administrador Teste', email: 'admin.dev@example.com', roleId: adminRole.id },
  ];

  const usersByEmail = new Map<string, { id: string }>();
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
    usersByEmail.set(testUser.email, user);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: testUser.roleId } },
      update: {},
      create: { userId: user.id, roleId: testUser.roleId },
    });
  }

  const student = usersByEmail.get('aluno.dev@example.com')!;
  const teacher = usersByEmail.get('professor.dev@example.com')!;

  // FASE 6 ainda nao existe (gateway/checkout real) — este plano e esta assinatura sao so para
  // exercitar o controle de acesso da FASE 5 manualmente enquanto o checkout nao chega.
  const plan = await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '[DEV] Plano Mensal',
      description: 'Plano de desenvolvimento — acesso a todo o catalogo publicado.',
      priceCents: 4990,
      currency: 'BRL',
      interval: 'month',
      trialDays: 0,
      status: PublishStatus.PUBLISHED,
    },
  });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.userSubscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      userId: student.id,
      planId: plan.id,
      gateway: 'seed',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  // Curso de exemplo publicado, para exercitar catalogo (FASE 4) e progresso (FASE 5) fim a fim.
  const cordas = instrumentsBySlug.get('cordas')!;
  const course = await prisma.course.upsert({
    where: { slug: 'violao-para-iniciantes' },
    update: {},
    create: {
      instrumentId: cordas.id,
      teacherId: teacher.id,
      title: '[DEV] Violão para iniciantes',
      slug: 'violao-para-iniciantes',
      description: 'Curso de exemplo criado pelo seed.',
      level: CourseLevel.INICIANTE,
      status: PublishStatus.PUBLISHED,
      order: 0,
    },
  });

  const courseModule = await prisma.module.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      courseId: course.id,
      title: 'Módulo 1 - Primeiros passos',
      status: PublishStatus.PUBLISHED,
      order: 0,
    },
  });

  const lessons = [
    { id: '00000000-0000-0000-0000-000000000004', title: 'Aula 1 - Postura e afinação', order: 0 },
    { id: '00000000-0000-0000-0000-000000000005', title: 'Aula 2 - Primeiros acordes', order: 1 },
  ];
  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: { id: lesson.id },
      update: {},
      create: {
        id: lesson.id,
        moduleId: courseModule.id,
        title: lesson.title,
        durationSeconds: 600,
        status: PublishStatus.PUBLISHED,
        order: lesson.order,
      },
    });
  }

  console.log('Seed concluído.');
  console.log('Usuários de DESENVOLVIMENTO criados (NÃO usar em homologação/produção):');
  for (const testUser of testUsers) {
    console.log(`  - ${testUser.email} / senha: ${DEV_PASSWORD}`);
  }
  console.log(
    `Assinatura ACTIVE de desenvolvimento atribuída a ${student.id} (aluno.dev@example.com) até ${periodEnd.toISOString()}.`,
  );
  console.log(`Curso de exemplo publicado: /courses/slug/${course.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
