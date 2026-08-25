import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({ example: ['teacher'], description: 'Substitui integralmente os papeis do usuario.' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roles!: string[];
}
