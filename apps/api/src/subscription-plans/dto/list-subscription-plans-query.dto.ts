import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListSubscriptionPlansQueryDto extends PaginationQueryDto {
  @ApiProperty({
    enum: PublishStatus,
    required: false,
    description: 'Apenas admin pode filtrar por status; demais papeis so veem PUBLISHED.',
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
