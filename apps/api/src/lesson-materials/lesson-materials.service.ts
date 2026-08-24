import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LessonMaterial, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { LessonsService, LessonWithModule } from '../lessons/lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonMaterialDto } from './dto/create-lesson-material.dto';
import { ListLessonMaterialsQueryDto } from './dto/list-lesson-materials-query.dto';
import { UpdateLessonMaterialDto } from './dto/update-lesson-material.dto';

export type LessonMaterialWithLesson = LessonMaterial & { lesson: LessonWithModule };

const withLesson = {
  include: {
    lesson: { include: { module: { include: { course: { include: { instrument: true } } } } } },
  },
} as const;

@Injectable()
export class LessonMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonsService: LessonsService,
  ) {}

  async list(
    user: AuthenticatedUser,
    lessonId: string,
    query: ListLessonMaterialsQueryDto,
  ): Promise<PaginatedResult<LessonMaterial>> {
    const lesson = await this.lessonsService.findWithModuleOrThrow(lessonId);
    this.lessonsService.assertViewable(user, lesson);

    const where: Prisma.LessonMaterialWhereInput = { lessonId, type: query.type };

    const [items, total] = await Promise.all([
      this.prisma.lessonMaterial.findMany({
        where,
        orderBy: { order: 'asc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.lessonMaterial.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<LessonMaterial> {
    const material = await this.findWithLessonOrThrow(id);
    this.lessonsService.assertViewable(user, material.lesson);
    return material;
  }

  async create(
    user: AuthenticatedUser,
    lessonId: string,
    dto: CreateLessonMaterialDto,
  ): Promise<LessonMaterial> {
    const lesson = await this.lessonsService.findWithModuleOrThrow(lessonId);
    this.assertManageable(user, lesson);

    return this.prisma.lessonMaterial.create({
      data: {
        lessonId,
        type: dto.type,
        title: dto.title,
        storageKey: dto.storageKey,
        order: dto.order ?? 0,
      },
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateLessonMaterialDto,
  ): Promise<LessonMaterial> {
    const material = await this.findWithLessonOrThrow(id);
    this.assertManageable(user, material.lesson);

    return this.prisma.lessonMaterial.update({ where: { id }, data: dto });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const material = await this.findWithLessonOrThrow(id);
    this.assertManageable(user, material.lesson);

    await this.prisma.lessonMaterial.delete({ where: { id } });
  }

  private assertManageable(user: AuthenticatedUser, lesson: LessonWithModule): void {
    if (!this.lessonsService.canManage(user, lesson)) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar este material.');
    }
  }

  private async findWithLessonOrThrow(id: string): Promise<LessonMaterialWithLesson> {
    const material = await this.prisma.lessonMaterial.findUnique({ where: { id }, ...withLesson });
    if (!material) {
      throw new NotFoundException('Material nao encontrado.');
    }
    return material;
  }
}
