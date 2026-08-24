import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiExcludeController()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(): Promise<{ status: 'ready' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
  }
}
