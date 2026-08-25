import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Course, Instrument, Prisma, PublishStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import {
  isAdmin,
  isCoursePublished,
  isOwnerOrAdmin,
} from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { slugify } from '../common/utils/slugify';
import { InstrumentsService } from '../instruments/instruments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export type CourseWithInstrument = Course & { instrument: Instrument };

const withInstrument = { include: { instrument: true } } as const;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instrumentsService: InstrumentsService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: ListCoursesQueryDto,
  ): Promise<PaginatedResult<CourseWithInstrument>> {
    const filters: Prisma.CourseWhereInput = {
      instrumentId: query.instrumentId,
      teacherId: query.teacherId,
      level: query.level,
      title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };

    const where: Prisma.CourseWhereInput = {
      AND: [filters, this.visibilityWhere(user, query.status)],
    };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        ...withInstrument,
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.course.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<CourseWithInstrument> {
    const course = await this.findWithInstrumentOrThrow(id);
    return this.assertViewable(user, course);
  }

  async findBySlug(user: AuthenticatedUser, slug: string): Promise<CourseWithInstrument> {
    const course = await this.prisma.course.findUnique({ where: { slug }, ...withInstrument });
    if (!course) {
      throw new NotFoundException('Curso nao encontrado.');
    }
    return this.assertViewable(user, course);
  }

  async create(user: AuthenticatedUser, dto: CreateCourseDto): Promise<CourseWithInstrument> {
    await this.instrumentsService.findByIdOrThrow(dto.instrumentId);

    if (!isAdmin(user) && dto.teacherId && dto.teacherId !== user.id) {
      throw new ForbiddenException('Professores so podem criar cursos atribuidos a si mesmos.');
    }
    const teacherId = isAdmin(user) ? (dto.teacherId ?? null) : user.id;

    const slug = dto.slug?.trim() || slugify(dto.title);
    await this.assertSlugAvailable(slug);

    return this.prisma.course.create({
      data: {
        instrumentId: dto.instrumentId,
        teacherId,
        title: dto.title,
        slug,
        description: dto.description,
        level: dto.level,
        imageUrl: dto.imageUrl,
        status: dto.status ?? PublishStatus.DRAFT,
        order: dto.order ?? 0,
      },
      ...withInstrument,
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCourseDto,
  ): Promise<CourseWithInstrument> {
    const course = await this.findWithInstrumentOrThrow(id);
    this.assertManageable(user, course);

    if (dto.teacherId !== undefined && !isAdmin(user)) {
      throw new ForbiddenException('Somente admin pode reatribuir o professor de um curso.');
    }
    if (dto.instrumentId) {
      await this.instrumentsService.findByIdOrThrow(dto.instrumentId);
    }
    if (dto.slug) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    return this.prisma.course.update({ where: { id }, data: dto, ...withInstrument });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const course = await this.findWithInstrumentOrThrow(id);
    this.assertManageable(user, course);

    if (course.status === PublishStatus.PUBLISHED) {
      throw new ConflictException(
        'Nao e possivel excluir um curso publicado. Arquive-o (status ARCHIVED) antes de excluir.',
      );
    }

    await this.prisma.course.delete({ where: { id } });
  }

  /** Uso interno: modulos/aulas precisam do curso (com instrumento) para checar propriedade/visibilidade. */
  async findWithInstrumentOrThrow(id: string): Promise<CourseWithInstrument> {
    const course = await this.prisma.course.findUnique({ where: { id }, ...withInstrument });
    if (!course) {
      throw new NotFoundException('Curso nao encontrado.');
    }
    return course;
  }

  canManage(user: AuthenticatedUser, course: { teacherId: string | null }): boolean {
    return isOwnerOrAdmin(user, course);
  }

  assertViewable(user: AuthenticatedUser, course: CourseWithInstrument): CourseWithInstrument {
    if (this.canManage(user, course) || isCoursePublished(course)) {
      return course;
    }
    throw new NotFoundException('Curso nao encontrado.');
  }

  assertManageable(user: AuthenticatedUser, course: { teacherId: string | null }): void {
    if (!this.canManage(user, course)) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar este curso.');
    }
  }

  private visibilityWhere(
    user: AuthenticatedUser,
    status?: PublishStatus,
  ): Prisma.CourseWhereInput {
    if (isAdmin(user)) {
      return status ? { status } : {};
    }

    const publishedClause: Prisma.CourseWhereInput = {
      status: PublishStatus.PUBLISHED,
      instrument: { status: PublishStatus.PUBLISHED },
    };

    return { OR: [publishedClause, { teacherId: user.id }] };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.course.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`O slug "${slug}" ja esta em uso.`);
    }
  }
}
