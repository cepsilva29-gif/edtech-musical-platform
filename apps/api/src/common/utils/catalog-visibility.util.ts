import { PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Regras de visibilidade e propriedade do catalogo (instrumentos -> cursos -> modulos -> aulas
 * -> materiais). Centralizadas aqui para que cada nivel da hierarquia aplique exatamente a mesma
 * regra: admin ve tudo; o professor dono do curso ve o proprio conteudo em qualquer status; todo
 * o resto (aluno, outro professor) so ve a cadeia inteira publicada.
 */

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.roles.includes('admin');
}

export function isTeacher(user: AuthenticatedUser): boolean {
  return user.roles.includes('teacher');
}

export function canManageCourse(
  user: AuthenticatedUser,
  course: { teacherId: string | null },
): boolean {
  return isAdmin(user) || course.teacherId === user.id;
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
