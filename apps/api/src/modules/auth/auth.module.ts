import { Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CartModule } from '../cart/cart.module';
import { AdminRouteAuditor } from './admin-route-auditor';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { PrincipalService } from './principal.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), DiscoveryModule, CartModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    PrincipalService,
    SessionService,
    LoginAttemptsService,
    AdminRouteAuditor,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, PasswordService, PrincipalService, SessionService, TokenService],
})
export class AuthModule {}
