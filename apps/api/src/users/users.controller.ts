import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.usersService.findByIdOrThrow(user.id);
    return UsersService.toAdminView(found);
  }

  @Roles('admin')
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.listAdmin(query);
  }

  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const found = await this.usersService.findByIdOrThrow(id);
    return UsersService.toAdminView(found);
  }

  @Roles('admin')
  @Patch(':id/roles')
  async updateRoles(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @Req() req: Request,
  ) {
    const updated = await this.usersService.setRoles(actor, id, dto.roles, req.ip);
    return UsersService.toAdminView(updated);
  }

  @Roles('admin')
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    const updated = await this.usersService.setStatus(actor, id, dto.status, req.ip);
    return UsersService.toAdminView(updated);
  }
}
