import { ApiProperty } from '@nestjs/swagger';
import { CourseLevel, PublishStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty()
  @IsUUID()
  instrumentId!: string;

  @ApiProperty({
    required: false,
    description: 'Somente admin pode atribuir a outro professor; professor sempre vira o dono.',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ example: 'Violao para iniciantes' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ required: false, description: 'Gerado a partir do titulo se omitido.' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug deve conter apenas letras minusculas, numeros e hifens.',
  })
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: CourseLevel })
  @IsEnum(CourseLevel)
  level!: CourseLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

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
