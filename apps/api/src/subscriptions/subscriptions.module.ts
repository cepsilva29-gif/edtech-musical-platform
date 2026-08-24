import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [SubscriptionPlansModule, PaymentsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
