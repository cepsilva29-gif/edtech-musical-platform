import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListLessonMaterialsQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: MaterialType, required: false })
  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;
}
