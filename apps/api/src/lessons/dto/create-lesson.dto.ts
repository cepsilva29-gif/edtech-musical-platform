import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Aula 1 - Postura e afinacao' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    required: false,
    description:
      'Identificador do provedor de video (ex.: mux, aws-ivs, youtube). Resolucao da URL fica para a FASE 7.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  videoProvider?: string;

  @ApiProperty({ required: false, description: 'Referencia externa do video no provedor.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoRef?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

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
