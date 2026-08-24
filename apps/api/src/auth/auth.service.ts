import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus, VerificationTokenType } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { UsersService, UserWithRoles } from '../users/users.service';
import { IssuedTokens, RequestMetadata, TokenService } from './token.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const PASSWORD_SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  private hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthenticatedUser(user: UserWithRoles): AuthenticatedUser {
    return { id: user.id, email: user.email, roles: UsersService.toRoleNames(user) };
  }

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<{ user: AuthenticatedUser } & IssuedTokens> {
    const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.usersService.createStudent({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    await this.sendEmailVerification(user.id, user.email);
    await this.auditService.record({
      userId: user.id,
      action: 'user.register',
      entity: 'user',
      entityId: user.id,
      ip: metadata.ip,
    });

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.tokenService.issueTokenPair(authenticatedUser, metadata);

    return { user: authenticatedUser, ...tokens };
  }

  async login(
    dto: LoginDto,
    metadata: RequestMetadata,
  ): Promise<{ user: AuthenticatedUser } & IssuedTokens> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha invalidos.');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Usuario bloqueado. Entre em contato com o suporte.');
    }

    await this.usersService.updateLastLogin(user.id);
    await this.auditService.record({
      userId: user.id,
      action: 'user.login',
      entity: 'user',
      entityId: user.id,
      ip: metadata.ip,
    });

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.tokenService.issueTokenPair(authenticatedUser, metadata);

    return { user: authenticatedUser, ...tokens };
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<IssuedTokens> {
    const userId = await this.tokenService.rotateRefreshToken(refreshToken, metadata);
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    return this.tokenService.issueTokenPair(authenticatedUser, metadata);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenService.revokeAllRefreshTokens(userId);
    await this.auditService.record({
      userId,
      action: 'user.logout_all',
      entity: 'user',
      entityId: userId,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !(await compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const passwordHash = await hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.usersService.updatePasswordHash(userId, passwordHash);
    await this.tokenService.revokeAllRefreshTokens(userId);
    await this.auditService.record({
      userId,
      action: 'user.change_password',
      entity: 'user',
      entityId: userId,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Nao revelar se o e-mail existe ou nao (evita enumeracao de usuarios).
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: VerificationTokenType.PASSWORD_RESET,
        tokenHash: this.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    });

    await this.mailService.send({
      to: user.email,
      subject: 'Redefinicao de senha',
      text: `Use este token para redefinir sua senha (valido por ${PASSWORD_RESET_TTL_MINUTES} minutos): ${rawToken}`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const verificationToken = await this.consumeVerificationToken(
      rawToken,
      VerificationTokenType.PASSWORD_RESET,
    );
    const passwordHash = await hash(newPassword, PASSWORD_SALT_ROUNDS);

    await this.usersService.updatePasswordHash(verificationToken.userId, passwordHash);
    await this.tokenService.revokeAllRefreshTokens(verificationToken.userId);
    await this.auditService.record({
      userId: verificationToken.userId,
      action: 'user.reset_password',
      entity: 'user',
      entityId: verificationToken.userId,
    });
  }

  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        tokenHash: this.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60_000),
      },
    });

    await this.mailService.send({
      to: email,
      subject: 'Confirme seu e-mail',
      text: `Use este token para confirmar seu e-mail (valido por ${EMAIL_VERIFICATION_TTL_HOURS}h): ${rawToken}`,
    });
  }

  async confirmEmail(rawToken: string): Promise<void> {
    const verificationToken = await this.consumeVerificationToken(
      rawToken,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    await this.usersService.markEmailVerified(verificationToken.userId);
    await this.auditService.record({
      userId: verificationToken.userId,
      action: 'user.confirm_email',
      entity: 'user',
      entityId: verificationToken.userId,
    });
  }

  private async consumeVerificationToken(rawToken: string, type: VerificationTokenType) {
    const tokenHash = this.hashOpaqueToken(rawToken);
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !verificationToken ||
      verificationToken.type !== type ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Token invalido ou expirado.');
    }

    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return verificationToken;
  }
}
