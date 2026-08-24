import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';

/**
 * @nestjs/jwt tipa `expiresIn` como `number | StringValue` (do pacote `ms`), nao `string` puro.
 * O valor vem de env (sempre string, ex. "15m"), entao a conversao de tipo aqui e segura -
 * `ms` aceita esse formato em runtime.
 */
function asExpiresIn(value: string | undefined): JwtSignOptions['expiresIn'] {
  return value as JwtSignOptions['expiresIn'];
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  signAccessToken(user: AuthenticatedUser): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, roles: user.roles },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: asExpiresIn(this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')),
      },
    );
  }

  async issueRefreshToken(userId: string, metadata: RequestMetadata): Promise<string> {
    const jti = randomUUID();

    const refreshToken = this.jwtService.sign(
      { sub: userId, jti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: asExpiresIn(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')),
      },
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        userAgent: metadata.userAgent ?? null,
        ip: metadata.ip ?? null,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return refreshToken;
  }

  async issueTokenPair(user: AuthenticatedUser, metadata: RequestMetadata): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, metadata);

    return { accessToken, refreshToken };
  }

  /**
   * Verifica a assinatura/expiracao do refresh token E confere que ele ainda esta ativo no
   * banco (nao revogado nem expirado ali), depois marca-o como revogado (rotacao: cada refresh
   * token so pode ser usado uma vez). Retorna o userId para quem chamar emitir um novo par.
   */
  async rotateRefreshToken(rawToken: string, _metadata: RequestMetadata): Promise<string> {
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify(rawToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    const tokenHash = this.hash(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.userId !== payload.sub
    ) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return stored.userId;
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
