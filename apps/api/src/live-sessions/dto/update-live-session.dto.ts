import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Status nao e editavel aqui de proposito - transicoes de estado tem efeito colateral (chamam o
 * LiveProvider) e por isso vivem em endpoints de acao dedicados (go-live/end/cancel), nao num
 * PATCH generico.
 */
export class UpdateLiveSessionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiProperty({ required: false, description: 'Somente admin pode reatribuir o professor.' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
