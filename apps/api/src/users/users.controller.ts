import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.usersService.findById(user.id);
    if (!found) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return {
      id: found.id,
      name: found.name,
      email: found.email,
      status: found.status,
      roles: UsersService.toRoleNames(found),
      emailVerifiedAt: found.emailVerifiedAt,
      createdAt: found.createdAt,
    };
  }
}
