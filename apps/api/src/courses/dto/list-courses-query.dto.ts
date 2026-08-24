import { ApiProperty } from '@nestjs/swagger';
import { CourseLevel, PublishStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListCoursesQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ enum: CourseLevel, required: false })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiProperty({
    enum: PublishStatus,
    required: false,
    description: 'Ignorado para quem nao e admin/dono do curso (sempre ve PUBLISHED).',
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({ required: false, description: 'Busca por titulo (contains, case-insensitive).' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
