import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CheckoutDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}
