import { PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Regras de visibilidade e propriedade do catalogo (instrumentos -> cursos -> modulos -> aulas
 * -> materiais) e de qualquer outro recurso com o mesmo formato de propriedade (ex. live_sessions,
 * FASE 9). Centralizadas aqui para que cada recurso aplique exatamente a mesma regra: admin ve
 * tudo; o professor dono do recurso ve/gerencia em qualquer status; todo o resto (aluno, outro
 * professor) so ve a cadeia inteira publicada.
 */

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.roles.includes('admin');
}

export function isTeacher(user: AuthenticatedUser): boolean {
  return user.roles.includes('teacher');
}

/** admin sempre; senao, so quem e o `teacherId` dono do recurso (curso, live session, etc.). */
export function isOwnerOrAdmin(
  user: AuthenticatedUser,
  resource: { teacherId: string | null },
): boolean {
  return isAdmin(user) || resource.teacherId === user.id;
}

export function isInstrumentPublished(instrument: { status: PublishStatus }): boolean {
  return instrument.status === PublishStatus.PUBLISHED;
}

export function isCoursePublished(course: {
  status: PublishStatus;
  instrument: { status: PublishStatus };
}): boolean {
  return course.status === PublishStatus.PUBLISHED && isInstrumentPublished(course.instrument);
}

export function isModulePublished(courseModule: {
  status: PublishStatus;
  course: { status: PublishStatus; instrument: { status: PublishStatus } };
}): boolean {
  return courseModule.status === PublishStatus.PUBLISHED && isCoursePublished(courseModule.course);
}

export function isLessonPublished(lesson: {
  status: PublishStatus;
  module: {
    status: PublishStatus;
    course: { status: PublishStatus; instrument: { status: PublishStatus } };
  };
}): boolean {
  return lesson.status === PublishStatus.PUBLISHED && isModulePublished(lesson.module);
}
