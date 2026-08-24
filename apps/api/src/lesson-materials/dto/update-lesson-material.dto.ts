import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class UpdateLessonMaterialDto {
  @ApiProperty({ enum: MaterialType, required: false })
  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  storageKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
