import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
