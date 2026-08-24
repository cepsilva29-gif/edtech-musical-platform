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

export class UpdateSubscriptionPlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ enum: ['month', 'year'], required: false })
  @IsOptional()
  @IsIn(['month', 'year'])
  interval?: 'month' | 'year';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiProperty({ enum: PublishStatus, required: false })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  gatewayPriceId?: string;
}
