import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateLessonProgressDto {
  @ApiProperty({ example: 120, description: 'Total de segundos assistidos (cumulativo).' })
  @IsInt()
  @Min(0)
  watchedSeconds!: number;

  @ApiProperty({ example: 118, description: 'Posicao atual do player, em segundos.' })
  @IsInt()
  @Min(0)
  lastPositionSeconds!: number;
}
