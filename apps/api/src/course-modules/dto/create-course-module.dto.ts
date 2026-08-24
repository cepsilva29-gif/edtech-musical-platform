import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateCourseModuleDto {
  @ApiProperty({ example: 'Modulo 1 - Primeiros acordes' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: PublishStatus, required: false, default: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
