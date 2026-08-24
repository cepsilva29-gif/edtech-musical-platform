import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SenhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'A senha deve conter pelo menos uma letra e um numero.',
  })
  password!: string;
}
