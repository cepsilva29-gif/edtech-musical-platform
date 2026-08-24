import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Lesson, Prisma, PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { isLessonPublished } from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import {
  CourseModulesService,
  CourseModuleWithCourse,
} from '../course-modules/course-modules.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

export type LessonWithModule = Lesson & { module: CourseModuleWithCourse };

const withModule = {
  include: { module: { include: { course: { include: { instrument: true } } } } },
} as const;

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseModulesService: CourseModulesService,
  ) {}

  async list(
    user: AuthenticatedUser,
    moduleId: string,
    query: ListLessonsQueryDto,
  ): Promise<PaginatedResult<Lesson>> {
    const courseModule = await this.courseModulesService.findWithCourseOrThrow(moduleId);
    this.courseModulesService.assertViewable(user, courseModule);
    const manager = this.courseModulesService.canManage(user, courseModule);

    const where: Prisma.LessonWhereInput = {
      moduleId,
      status: manager ? query.status : PublishStatus.PUBLISHED,
    };

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        orderBy: { order: 'asc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<LessonWithModule> {
    const lesson = await this.findWithModuleOrThrow(id);
    return this.assertViewable(user, lesson);
  }

  async create(user: AuthenticatedUser, moduleId: string, dto: CreateLessonDto): Promise<Lesson> {
    const courseModule = await this.courseModulesService.findWithCourseOrThrow(moduleId);
    this.courseModulesService.assertManageable(user, courseModule);

    return this.prisma.lesson.create({
      data: {
        moduleId,
        title: dto.title,
        description: dto.description,
        videoProvider: dto.videoProvider,
        videoRef: dto.videoRef,
        durationSeconds: dto.durationSeconds ?? 0,
        status: dto.status ?? PublishStatus.DRAFT,
        order: dto.order ?? 0,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.findWithModuleOrThrow(id);
    this.courseModulesService.assertManageable(user, lesson.module);

    return this.prisma.lesson.update({ where: { id }, data: dto });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const lesson = await this.findWithModuleOrThrow(id);
    this.courseModulesService.assertManageable(user, lesson.module);

    if (lesson.status === PublishStatus.PUBLISHED) {
      throw new ConflictException(
        'Nao e possivel excluir uma aula publicada. Arquive-a antes de excluir.',
      );
    }

    await this.prisma.lesson.delete({ where: { id } });
  }

  /** Uso interno: LessonMaterialsService precisa da aula (com cadeia completa) para checar acesso. */
  async findWithModuleOrThrow(id: string): Promise<LessonWithModule> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id }, ...withModule });
    if (!lesson) {
      throw new NotFoundException('Aula nao encontrada.');
    }
    return lesson;
  }

  canManage(user: AuthenticatedUser, lesson: LessonWithModule): boolean {
    return this.courseModulesService.canManage(user, lesson.module);
  }

  assertViewable(user: AuthenticatedUser, lesson: LessonWithModule): LessonWithModule {
    if (this.canManage(user, lesson) || isLessonPublished(lesson)) {
      return lesson;
    }
    throw new NotFoundException('Aula nao encontrada.');
  }
}
