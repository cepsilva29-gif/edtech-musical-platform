import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListLessonsQueryDto extends PaginationQueryDto {
  @ApiProperty({
    enum: PublishStatus,
    required: false,
    description: 'Ignorado para quem nao pode gerenciar o curso (sempre ve PUBLISHED).',
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
