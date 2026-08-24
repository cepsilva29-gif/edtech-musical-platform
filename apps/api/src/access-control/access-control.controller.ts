import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { AccessControlService } from './access-control.service';

@ApiTags('access-control')
@ApiBearerAuth()
@Controller('access')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ hasActiveEntitlement: boolean }> {
    const hasActiveEntitlement = await this.accessControlService.hasActiveEntitlement(user.id);
    return { hasActiveEntitlement };
  }
}
