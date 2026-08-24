import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateLessonMaterialDto {
  @ApiProperty({ enum: MaterialType })
  @IsEnum(MaterialType)
  type!: MaterialType;

  @ApiProperty({ example: 'Cifra - Aula 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    example: 'materials/lessons/aula-1/cifra.pdf',
    description: 'Chave no storage S3-compativel. Nunca uma URL publica direta.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  storageKey!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
