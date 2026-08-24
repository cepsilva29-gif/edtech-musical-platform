import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestMetadata } from './token.service';

function extractMetadata(req: Request): RequestMetadata {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, extractMetadata(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, extractMetadata(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, extractMetadata(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<{ loggedOut: true }> {
    await this.authService.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<{ loggedOut: true }> {
    await this.authService.logoutAll(user.id);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { changed: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Se o e-mail existir, um link de redefinicao foi enviado.' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ reset: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { reset: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('confirm-email')
  async confirmEmail(@Query('token') token: string): Promise<{ confirmed: true }> {
    await this.authService.confirmEmail(token);
    return { confirmed: true };
  }
}
