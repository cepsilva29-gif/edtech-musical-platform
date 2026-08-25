import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiveSession, LiveStatus, Prisma } from '@prisma/client';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { isAdmin, isOwnerOrAdmin } from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { InstrumentsService } from '../instruments/instruments.service';
import { LiveProvider } from '../live-provider/live-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { ListLiveSessionsQueryDto } from './dto/list-live-sessions-query.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';
import { assertValidLiveStatusTransition } from './live-status-transition.util';

export interface PlaybackUrlResponse {
  status: LiveStatus;
  url: string;
  expiresAt: Date | null;
}

@Injectable()
export class LiveSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instrumentsService: InstrumentsService,
    private readonly accessControlService: AccessControlService,
    private readonly liveProvider: LiveProvider,
  ) {}

  async list(query: ListLiveSessionsQueryDto): Promise<PaginatedResult<LiveSession>> {
    const where: Prisma.LiveSessionWhereInput = {
      instrumentId: query.instrumentId,
      teacherId: query.teacherId,
      status: query.status,
    };

    const [items, total] = await Promise.all([
      this.prisma.liveSession.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.liveSession.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<LiveSession> {
    return this.findByIdOrThrow(id);
  }

  async create(user: AuthenticatedUser, dto: CreateLiveSessionDto): Promise<LiveSession> {
    await this.instrumentsService.findByIdOrThrow(dto.instrumentId);

    if (!isAdmin(user) && dto.teacherId && dto.teacherId !== user.id) {
      throw new ForbiddenException('Professores so podem criar lives atribuidas a si mesmos.');
    }
    const teacherId = isAdmin(user) ? (dto.teacherId ?? null) : user.id;

    return this.prisma.liveSession.create({
      data: {
        instrumentId: dto.instrumentId,
        teacherId,
        title: dto.title,
        description: dto.description,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateLiveSessionDto,
  ): Promise<LiveSession> {
    const liveSession = await this.findByIdOrThrow(id);
    this.assertManageable(user, liveSession);

    if (dto.teacherId !== undefined && !isAdmin(user)) {
      throw new ForbiddenException('Somente admin pode reatribuir o professor de uma live.');
    }
    if (dto.instrumentId) {
      await this.instrumentsService.findByIdOrThrow(dto.instrumentId);
    }

    return this.prisma.liveSession.update({
      where: { id },
      data: {
        instrumentId: dto.instrumentId,
        teacherId: dto.teacherId,
        title: dto.title,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const liveSession = await this.findByIdOrThrow(id);
    this.assertManageable(user, liveSession);

    if (liveSession.status === LiveStatus.LIVE || liveSession.status === LiveStatus.FINISHED) {
      throw new ConflictException(
        'Nao e possivel excluir uma live ao vivo ou ja encerrada (com possivel gravacao vinculada).',
      );
    }

    await this.prisma.liveSession.delete({ where: { id } });
  }

  async goLive(user: AuthenticatedUser, id: string): Promise<LiveSession> {
    const liveSession = await this.findByIdOrThrow(id);
    this.assertManageable(user, liveSession);
    assertValidLiveStatusTransition(liveSession.status, LiveStatus.LIVE);

    const stream = await this.liveProvider.createLiveStream({
      liveSessionId: liveSession.id,
      title: liveSession.title,
    });

    const updated = await this.prisma.liveSession.update({
      where: { id },
      data: {
        status: LiveStatus.LIVE,
        streamProvider: this.liveProvider.name,
        streamRef: stream.streamRef,
        playbackUrl: stream.playbackUrl,
      },
    });

    await this.drainSimulatedEvents();

    return updated;
  }

  async endLive(user: AuthenticatedUser, id: string): Promise<LiveSession> {
    const liveSession = await this.findByIdOrThrow(id);
    this.assertManageable(user, liveSession);
    assertValidLiveStatusTransition(liveSession.status, LiveStatus.FINISHED);

    if (!liveSession.streamRef) {
      throw new ConflictException('Esta live nao tem um stream ativo para encerrar.');
    }

    await this.liveProvider.endLiveStream({ streamRef: liveSession.streamRef });

    const updated = await this.prisma.liveSession.update({
      where: { id },
      data: { status: LiveStatus.FINISHED },
    });

    await this.drainSimulatedEvents();

    return updated;
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<LiveSession> {
    const liveSession = await this.findByIdOrThrow(id);
    this.assertManageable(user, liveSession);
    assertValidLiveStatusTransition(liveSession.status, LiveStatus.CANCELED);

    return this.prisma.liveSession.update({
      where: { id },
      data: { status: LiveStatus.CANCELED },
    });
  }

  async resolvePlayback(user: AuthenticatedUser, id: string): Promise<PlaybackUrlResponse> {
    const liveSession = await this.findByIdOrThrow(id);
    await this.accessControlService.assertEntitled(user.id, isOwnerOrAdmin(user, liveSession));

    switch (liveSession.status) {
      case LiveStatus.LIVE: {
        if (!liveSession.playbackUrl) {
          throw new ConflictException('Esta live nao tem uma URL de reproducao disponivel.');
        }
        return { status: liveSession.status, url: liveSession.playbackUrl, expiresAt: null };
      }
      case LiveStatus.FINISHED: {
        if (!liveSession.recordingRef) {
          throw new ConflictException('A gravacao desta live ainda nao esta disponivel.');
        }
        const result = await this.liveProvider.resolveRecordingPlaybackUrl({
          streamProvider: liveSession.streamProvider,
          recordingRef: liveSession.recordingRef,
        });
        return { status: liveSession.status, url: result.url, expiresAt: result.expiresAt };
      }
      case LiveStatus.SCHEDULED:
        throw new ConflictException('Esta live ainda nao comecou.');
      case LiveStatus.CANCELED:
        throw new ConflictException('Esta live foi cancelada.');
    }
  }

  private assertManageable(user: AuthenticatedUser, liveSession: LiveSession): void {
    if (!isOwnerOrAdmin(user, liveSession)) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar esta live.');
    }
  }

  private async findByIdOrThrow(id: string): Promise<LiveSession> {
    const liveSession = await this.prisma.liveSession.findUnique({ where: { id } });
    if (!liveSession) {
      throw new NotFoundException('Live nao encontrada.');
    }
    return liveSession;
  }

  private async drainSimulatedEvents(): Promise<void> {
    if (!this.liveProvider.drainSimulatedEvents) {
      return;
    }

    const events = this.liveProvider.drainSimulatedEvents();
    for (const event of events) {
      await this.processRecordingWebhook(this.liveProvider.name, event.rawBody, event.signature);
    }
  }

  async processRecordingWebhook(
    providerName: string,
    rawBody: string,
    signature: string | undefined,
  ): Promise<void> {
    if (providerName !== this.liveProvider.name) {
      throw new ConflictException(
        `Provedor "${providerName}" nao e o provedor de live configurado (LIVE_PROVIDER).`,
      );
    }
    if (!this.liveProvider.verifySignature(rawBody, signature)) {
      throw new ForbiddenException('Assinatura de webhook invalida.');
    }

    const event = this.liveProvider.mapWebhookEvent(rawBody);

    const liveSession = await this.prisma.liveSession.findUnique({
      where: { streamRef: event.streamRef },
    });
    if (!liveSession) {
      throw new NotFoundException(`Live com streamRef "${event.streamRef}" nao encontrada.`);
    }

    await this.prisma.liveSession.update({
      where: { id: liveSession.id },
      data: { recordingRef: event.recordingRef },
    });
  }
}
