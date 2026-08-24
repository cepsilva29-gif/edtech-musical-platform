import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Module as CourseModuleRecord, Prisma, PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { isModulePublished } from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { CoursesService, CourseWithInstrument } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { ListCourseModulesQueryDto } from './dto/list-course-modules-query.dto';
import { UpdateCourseModuleDto } from './dto/update-course-module.dto';

export type CourseModuleWithCourse = CourseModuleRecord & { course: CourseWithInstrument };

const withCourse = { include: { course: { include: { instrument: true } } } } as const;

@Injectable()
export class CourseModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async list(
    user: AuthenticatedUser,
    courseId: string,
    query: ListCourseModulesQueryDto,
  ): Promise<PaginatedResult<CourseModuleRecord>> {
    const course = await this.coursesService.findWithInstrumentOrThrow(courseId);
    this.coursesService.assertViewable(user, course);
    const manager = this.coursesService.canManage(user, course);

    const where: Prisma.ModuleWhereInput = {
      courseId,
      status: manager ? query.status : PublishStatus.PUBLISHED,
    };

    const [items, total] = await Promise.all([
      this.prisma.module.findMany({
        where,
        orderBy: { order: 'asc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.module.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<CourseModuleWithCourse> {
    const courseModule = await this.findWithCourseOrThrow(id);
    return this.assertViewable(user, courseModule);
  }

  async create(
    user: AuthenticatedUser,
    courseId: string,
    dto: CreateCourseModuleDto,
  ): Promise<CourseModuleRecord> {
    const course = await this.coursesService.findWithInstrumentOrThrow(courseId);
    this.coursesService.assertManageable(user, course);

    return this.prisma.module.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? PublishStatus.DRAFT,
        order: dto.order ?? 0,
      },
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCourseModuleDto,
  ): Promise<CourseModuleRecord> {
    const courseModule = await this.findWithCourseOrThrow(id);
    this.coursesService.assertManageable(user, courseModule.course);

    return this.prisma.module.update({ where: { id }, data: dto });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const courseModule = await this.findWithCourseOrThrow(id);
    this.coursesService.assertManageable(user, courseModule.course);

    if (courseModule.status === PublishStatus.PUBLISHED) {
      throw new ConflictException(
        'Nao e possivel excluir um modulo publicado. Arquive-o antes de excluir.',
      );
    }

    await this.prisma.module.delete({ where: { id } });
  }

  /** Uso interno: LessonsService precisa do modulo (com curso+instrumento) para checar acesso. */
  async findWithCourseOrThrow(id: string): Promise<CourseModuleWithCourse> {
    const courseModule = await this.prisma.module.findUnique({ where: { id }, ...withCourse });
    if (!courseModule) {
      throw new NotFoundException('Modulo nao encontrado.');
    }
    return courseModule;
  }

  canManage(user: AuthenticatedUser, courseModule: CourseModuleWithCourse): boolean {
    return this.coursesService.canManage(user, courseModule.course);
  }

  assertManageable(user: AuthenticatedUser, courseModule: CourseModuleWithCourse): void {
    this.coursesService.assertManageable(user, courseModule.course);
  }

  assertViewable(
    user: AuthenticatedUser,
    courseModule: CourseModuleWithCourse,
  ): CourseModuleWithCourse {
    if (this.canManage(user, courseModule) || isModulePublished(courseModule)) {
      return courseModule;
    }
    throw new NotFoundException('Modulo nao encontrado.');
  }
}
