import { Injectable } from '@nestjs/common';
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { PrincipalService } from './principal.service';
import { type ClientInfo, type IssuedTokens, SessionService } from './session.service';

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

const USER_SELECT = {
  id: true,
  type: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  nationalCode: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly principals: PrincipalService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ mobile: input.mobile }, ...(input.email ? [{ email: input.email }] : [])] },
      select: { mobile: true },
    });
    if (duplicate) {
      const field = duplicate.mobile === input.mobile ? 'mobile' : 'email';
      throw AppException.conflict('با این اطلاعات قبلاً حساب کاربری ساخته شده است. لطفاً وارد شوید.', [
        { path: field, message: field === 'mobile' ? 'این شماره موبایل قبلاً ثبت شده است.' : 'این ایمیل قبلاً ثبت شده است.' },
      ]);
    }
    const user = await this.prisma.user.create({
      data: {
        type: 'customer',
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
        email: input.email ?? null,
        passwordHash: await this.passwords.hash(input.password),
        lastLoginAt: new Date(),
      },
      select: { id: true, type: true },
    });
    const tokens = await this.sessions.create(user, client);
    return { user: await this.getAuthUser(user.id), tokens };
  }

  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    await this.attempts.assertNotLocked(input.identifier);
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ mobile: input.identifier }, { email: input.identifier }] },
      select: { id: true, type: true, isActive: true, passwordHash: true },
    });
    const valid = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !valid) {
      await this.attempts.recordFailure(input.identifier);
      throw new AppException('INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw new AppException('ACCOUNT_DISABLED');

    await this.attempts.reset(input.identifier);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.sessions.create(user, client);
    return { user: await this.getAuthUser(user.id), tokens };
  }

  refresh(refreshToken: string, client: ClientInfo): Promise<IssuedTokens> {
    return this.sessions.rotate(refreshToken, client);
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId);
    else if (refreshToken) await this.sessions.revokeByRefreshToken(refreshToken);
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    const principal = await this.principals.load(userId);
    if (!user || !principal) throw new AppException('UNAUTHENTICATED');
    return {
      ...user,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      roles: principal.roles,
      permissions: principal.permissions,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    if (input.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: input.email, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw AppException.conflict('این ایمیل قبلاً ثبت شده است.', [{ path: 'email', message: 'تکراری' }]);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        nationalCode: input.nationalCode,
      },
    });
    await this.principals.invalidate(userId);
    return this.getAuthUser(userId);
  }

  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw AppException.validation([{ path: 'currentPassword', message: 'رمز عبور فعلی اشتباه است.' }]);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.sessions.revokeAllForUser(userId, sessionId);
  }
}
