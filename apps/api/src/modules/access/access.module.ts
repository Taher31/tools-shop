import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesController, StaffUsersController } from './access.controller';
import { RolesService } from './roles.service';
import { StaffUsersService } from './staff-users.service';

@Module({
  imports: [AuthModule],
  controllers: [RolesController, StaffUsersController],
  providers: [RolesService, StaffUsersService],
})
export class AccessModule {}
