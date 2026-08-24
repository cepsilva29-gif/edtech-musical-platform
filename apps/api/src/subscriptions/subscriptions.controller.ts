import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CheckoutDto } from './dto/checkout.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @HttpCode(HttpStatus.OK)
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.subscriptionsService.checkout(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cancel')
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancel(user);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMine(user);
  }
}
