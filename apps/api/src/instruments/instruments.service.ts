import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Instrument, Prisma, PublishStatus } from '@prisma/client';
import { isAdmin } from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { slugify } from '../common/utils/slugify';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { ListInstrumentsQueryDto } from './dto/list-instruments-query.dto';
import { UpdateInstrumentDto } from './dto/update-instrument.dto';

@Injectable()
export class InstrumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthenticatedUser,
    query: ListInstrumentsQueryDto,
  ): Promise<PaginatedResult<Instrument>> {
    const where: Prisma.InstrumentWhereInput = isAdmin(user)
      ? query.status
        ? { status: query.status }
        : {}
      : { status: PublishStatus.PUBLISHED };

    const [items, total] = await Promise.all([
      this.prisma.instrument.findMany({
        where,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.instrument.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findVisibleById(user: AuthenticatedUser, id: string): Promise<Instrument> {
    const instrument = await this.prisma.instrument.findUnique({ where: { id } });
    return this.assertVisible(user, instrument);
  }

  async findVisibleBySlug(user: AuthenticatedUser, slug: string): Promise<Instrument> {
    const instrument = await this.prisma.instrument.findUnique({ where: { slug } });
    return this.assertVisible(user, instrument);
  }

  /** Uso interno de outros modulos (ex.: CoursesService valida instrumentId ignorando status). */
  async findByIdOrThrow(id: string): Promise<Instrument> {
    const instrument = await this.prisma.instrument.findUnique({ where: { id } });
    if (!instrument) {
      throw new NotFoundException('Instrumento nao encontrado.');
    }
    return instrument;
  }

  async create(dto: CreateInstrumentDto): Promise<Instrument> {
    const slug = dto.slug?.trim() || slugify(dto.name);
    await this.assertSlugAvailable(slug);

    return this.prisma.instrument.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        iconUrl: dto.iconUrl,
        status: dto.status ?? PublishStatus.DRAFT,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateInstrumentDto): Promise<Instrument> {
    await this.findByIdOrThrow(id);
    if (dto.slug) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    return this.prisma.instrument.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const coursesCount = await this.prisma.course.count({ where: { instrumentId: id } });
    if (coursesCount > 0) {
      throw new ConflictException('Nao e possivel excluir um instrumento com cursos vinculados.');
    }

    await this.prisma.instrument.delete({ where: { id } });
  }

  private assertVisible(user: AuthenticatedUser, instrument: Instrument | null): Instrument {
    if (!instrument || (instrument.status !== PublishStatus.PUBLISHED && !isAdmin(user))) {
      throw new NotFoundException('Instrumento nao encontrado.');
    }
    return instrument;
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.instrument.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`O slug "${slug}" ja esta em uso.`);
    }
  }
}
