import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: UserStatus, required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ required: false, example: 'teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  role?: string;

  @ApiProperty({
    required: false,
    description: 'Busca por nome/e-mail (contains, case-insensitive).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}
