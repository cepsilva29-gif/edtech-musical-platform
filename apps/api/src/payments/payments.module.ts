import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FakePaymentGateway } from './fake-payment-gateway.service';
import { PaymentGateway } from './payment-gateway.interface';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    {
      provide: PaymentGateway,
      useFactory: (config: ConfigService): PaymentGateway => {
        const provider = config.get<string>('PAYMENT_PROVIDER', 'fake');
        if (provider !== 'fake') {
          throw new Error(
            `PAYMENT_PROVIDER="${provider}" nao tem implementacao ainda. Somente "fake" (dev) ` +
              'esta disponivel nesta fase - ver docs/ARCHITECTURE.md.',
          );
        }
        const secret = config.get<string>('FAKE_PAYMENT_GATEWAY_SECRET', 'dev-fake-gateway-secret');
        return new FakePaymentGateway(secret);
      },
      inject: [ConfigService],
    },
    PaymentsService,
  ],
  exports: [PaymentGateway, PaymentsService],
})
export class PaymentsModule {}
