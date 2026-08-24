import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInstrumentDto {
  @ApiProperty({ example: 'Cordas' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 'cordas',
    required: false,
    description: 'Gerado a partir do nome se omitido.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug deve conter apenas letras minusculas, numeros e hifens.',
  })
  slug?: string;

  @ApiProperty({ example: 'Violao e guitarra', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

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
