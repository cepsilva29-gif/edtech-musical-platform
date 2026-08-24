import { ForbiddenException, Injectable } from '@nestjs/common';
import { PublishStatus, StudentProgress } from '@prisma/client';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CoursesService } from '../courses/courses.service';
import { LessonsService, LessonWithModule } from '../lessons/lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

const COMPLETE_WATCH_RATIO = 0.9;

export interface LessonProgressView {
  lessonId: string;
  watchedSeconds: number;
  lastPositionSeconds: number;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface LessonProgressSummary {
  lessonId: string;
  title: string;
  durationSeconds: number;
  watchedSeconds: number;
  isCompleted: boolean;
}

export interface ModuleProgressSummary {
  moduleId: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  lessons: LessonProgressSummary[];
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  modules: ModuleProgressSummary[];
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonsService: LessonsService,
    private readonly coursesService: CoursesService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async getLessonProgress(user: AuthenticatedUser, lessonId: string): Promise<LessonProgressView> {
    await this.lessonsService.findOne(user, lessonId);

    const progress = await this.findExisting(user.id, lessonId);
    return this.toView(lessonId, progress);
  }

  async upsertLessonProgress(
    user: AuthenticatedUser,
    lessonId: string,
    dto: UpdateLessonProgressDto,
  ): Promise<LessonProgressView> {
    const lesson = await this.lessonsService.findOne(user, lessonId);
    await this.assertCanConsume(user, lesson);

    const existing = await this.findExisting(user.id, lessonId);
    const watchedSeconds = Math.max(existing?.watchedSeconds ?? 0, dto.watchedSeconds);
    const shouldComplete =
      !existing?.isCompleted &&
      lesson.durationSeconds > 0 &&
      watchedSeconds >= lesson.durationSeconds * COMPLETE_WATCH_RATIO;

    const progress = await this.prisma.studentProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: {
        userId: user.id,
        lessonId,
        watchedSeconds,
        lastPositionSeconds: dto.lastPositionSeconds,
        isCompleted: shouldComplete,
        completedAt: shouldComplete ? new Date() : null,
      },
      update: {
        watchedSeconds,
        lastPositionSeconds: dto.lastPositionSeconds,
        ...(shouldComplete ? { isCompleted: true, completedAt: new Date() } : {}),
      },
    });

    return this.toView(lessonId, progress);
  }

  async completeLesson(user: AuthenticatedUser, lessonId: string): Promise<LessonProgressView> {
    const lesson = await this.lessonsService.findOne(user, lessonId);
    await this.assertCanConsume(user, lesson);

    const existing = await this.findExisting(user.id, lessonId);
    const progress = await this.prisma.studentProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, isCompleted: true, completedAt: new Date() },
      update: { isCompleted: true, completedAt: existing?.completedAt ?? new Date() },
    });

    return this.toView(lessonId, progress);
  }

  async getCourseProgress(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<CourseProgressSummary> {
    const course = await this.coursesService.findOne(user, courseId);
    const manager = this.coursesService.canManage(user, course);

    const modules = await this.prisma.module.findMany({
      where: { courseId, status: manager ? undefined : PublishStatus.PUBLISHED },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          where: manager ? {} : { status: PublishStatus.PUBLISHED },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId: user.id } } },
        },
      },
    });

    const moduleSummaries: ModuleProgressSummary[] = modules.map((courseModule) => {
      const lessons: LessonProgressSummary[] = courseModule.lessons.map((lesson) => {
        const progress = lesson.progress[0];
        return {
          lessonId: lesson.id,
          title: lesson.title,
          durationSeconds: lesson.durationSeconds,
          watchedSeconds: progress?.watchedSeconds ?? 0,
          isCompleted: progress?.isCompleted ?? false,
        };
      });

      return {
        moduleId: courseModule.id,
        title: courseModule.title,
        totalLessons: lessons.length,
        completedLessons: lessons.filter((lesson) => lesson.isCompleted).length,
        lessons,
      };
    });

    const totalLessons = moduleSummaries.reduce((sum, m) => sum + m.totalLessons, 0);
    const completedLessons = moduleSummaries.reduce((sum, m) => sum + m.completedLessons, 0);

    return {
      courseId,
      totalLessons,
      completedLessons,
      percentComplete: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      modules: moduleSummaries,
    };
  }

  private async assertCanConsume(user: AuthenticatedUser, lesson: LessonWithModule): Promise<void> {
    if (this.lessonsService.canManage(user, lesson)) {
      return;
    }

    const hasAccess = await this.accessControlService.hasActiveEntitlement(user.id);
    if (!hasAccess) {
      throw new ForbiddenException(
        'Assinatura ativa necessaria para registrar progresso nesta aula.',
      );
    }
  }

  private findExisting(userId: string, lessonId: string): Promise<StudentProgress | null> {
    return this.prisma.studentProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  private toView(lessonId: string, progress: StudentProgress | null): LessonProgressView {
    return {
      lessonId,
      watchedSeconds: progress?.watchedSeconds ?? 0,
      lastPositionSeconds: progress?.lastPositionSeconds ?? 0,
      isCompleted: progress?.isCompleted ?? false,
      completedAt: progress?.completedAt ?? null,
    };
  }
}
