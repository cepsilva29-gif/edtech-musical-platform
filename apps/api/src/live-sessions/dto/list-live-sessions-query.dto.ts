import { ApiProperty } from '@nestjs/swagger';
import { LiveStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListLiveSessionsQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ enum: LiveStatus, required: false })
  @IsOptional()
  @IsEnum(LiveStatus)
  status?: LiveStatus;
}
