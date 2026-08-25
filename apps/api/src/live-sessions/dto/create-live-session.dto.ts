import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateLiveSessionDto {
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

  @ApiProperty({ example: 'Aula ao vivo - repertorio de iniciantes' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-09-01T19:00:00.000Z' })
  @IsISO8601()
  scheduledAt!: string;
}
