import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { ListInstrumentsQueryDto } from './dto/list-instruments-query.dto';
import { UpdateInstrumentDto } from './dto/update-instrument.dto';
import { InstrumentsService } from './instruments.service';

@ApiTags('instruments')
@ApiBearerAuth()
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInstrumentsQueryDto) {
    return this.instrumentsService.list(user, query);
  }

  @Get('slug/:slug')
  findBySlug(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.instrumentsService.findVisibleBySlug(user, slug);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.instrumentsService.findVisibleById(user, id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateInstrumentDto) {
    return this.instrumentsService.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstrumentDto) {
    return this.instrumentsService.update(id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.instrumentsService.remove(id);
  }
}
