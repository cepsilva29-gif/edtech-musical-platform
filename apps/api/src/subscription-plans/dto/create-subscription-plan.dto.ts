import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Plano Mensal' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 4990, description: 'Preco em centavos.' })
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiProperty({ example: 'BRL', required: false, default: 'BRL' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ enum: ['month', 'year'] })
  @IsIn(['month', 'year'])
  interval!: 'month' | 'year';

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiProperty({ enum: PublishStatus, required: false, default: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({
    required: false,
    description:
      'Identificador do preco no gateway (ex.: price_xxx da Stripe). Nao usado pelo FakePaymentGateway.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  gatewayPriceId?: string;
}
