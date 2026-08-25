import { PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';
import {
  isOwnerOrAdmin,
  isCoursePublished,
  isLessonPublished,
  isModulePublished,
} from './catalog-visibility.util';

const admin: AuthenticatedUser = { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] };
const teacherOwner: AuthenticatedUser = {
  id: 'teacher-1',
  email: 'prof@example.com',
  roles: ['teacher'],
};
const otherTeacher: AuthenticatedUser = {
  id: 'teacher-2',
  email: 'outro@example.com',
  roles: ['teacher'],
};
const student: AuthenticatedUser = {
  id: 'student-1',
  email: 'aluno@example.com',
  roles: ['student'],
};

describe('isOwnerOrAdmin', () => {
  it('allows admin regardless of ownership', () => {
    expect(isOwnerOrAdmin(admin, { teacherId: teacherOwner.id })).toBe(true);
  });

  it('allows the owning teacher', () => {
    expect(isOwnerOrAdmin(teacherOwner, { teacherId: teacherOwner.id })).toBe(true);
  });

  it('denies a teacher who does not own the course', () => {
    expect(isOwnerOrAdmin(otherTeacher, { teacherId: teacherOwner.id })).toBe(false);
  });

  it('denies a student', () => {
    expect(isOwnerOrAdmin(student, { teacherId: teacherOwner.id })).toBe(false);
  });
});

const publishedInstrument = { status: PublishStatus.PUBLISHED };
const draftInstrument = { status: PublishStatus.DRAFT };

describe('isCoursePublished', () => {
  it('is true only when both the course and its instrument are published', () => {
    expect(
      isCoursePublished({ status: PublishStatus.PUBLISHED, instrument: publishedInstrument }),
    ).toBe(true);
    expect(
      isCoursePublished({ status: PublishStatus.DRAFT, instrument: publishedInstrument }),
    ).toBe(false);
    expect(
      isCoursePublished({ status: PublishStatus.PUBLISHED, instrument: draftInstrument }),
    ).toBe(false);
  });
});

describe('isModulePublished', () => {
  const publishedCourse = { status: PublishStatus.PUBLISHED, instrument: publishedInstrument };

  it('requires the module and the whole parent chain to be published', () => {
    expect(isModulePublished({ status: PublishStatus.PUBLISHED, course: publishedCourse })).toBe(
      true,
    );
    expect(isModulePublished({ status: PublishStatus.DRAFT, course: publishedCourse })).toBe(false);
    expect(
      isModulePublished({
        status: PublishStatus.PUBLISHED,
        course: { status: PublishStatus.DRAFT, instrument: publishedInstrument },
      }),
    ).toBe(false);
  });
});

describe('isLessonPublished', () => {
  const publishedCourse = { status: PublishStatus.PUBLISHED, instrument: publishedInstrument };
  const publishedModule = { status: PublishStatus.PUBLISHED, course: publishedCourse };

  it('requires the lesson and the whole parent chain to be published', () => {
    expect(isLessonPublished({ status: PublishStatus.PUBLISHED, module: publishedModule })).toBe(
      true,
    );
    expect(isLessonPublished({ status: PublishStatus.DRAFT, module: publishedModule })).toBe(false);
    expect(
      isLessonPublished({
        status: PublishStatus.PUBLISHED,
        module: { status: PublishStatus.DRAFT, course: publishedCourse },
      }),
    ).toBe(false);
  });
});
