import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PaginationQueryDto } from '../common/utils/pagination';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Webhook publico por gateway. Nesta fase, o FakePaymentGateway nunca chama esta rota via HTTP -
   * ele alimenta PaymentsService.processWebhookEvent diretamente em processo (ver
   * SubscriptionsService). Esta rota fica pronta para quando um gateway real existir.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook/:gateway')
  async webhook(
    @Param('gateway') gateway: string,
    @Body() body: unknown,
    @Headers('x-webhook-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    await this.paymentsService.processWebhookEvent(gateway, JSON.stringify(body ?? {}), signature);
    return { received: true };
  }

  @ApiBearerAuth()
  @Get('invoices/me')
  getMyInvoices(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.paymentsService.getInvoicesForUser(user.id, query);
  }
}
