import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class UpdateCourseModuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: PublishStatus, required: false })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
