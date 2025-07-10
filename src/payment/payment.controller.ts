import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentType } from './payment.entity';

export class InitiatePaymentDto {
  type: PaymentType;
  adId?: number;
}

export class ProcessPaymentDto {
  transactionId: string;
  gatewayResponse?: string;
}

export class VerifyPaymentDto {
  authority: string;
}

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  @Get('stats')
  getPaymentStats() {
    return this.paymentService.getPaymentStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/my-payments')
  getUserPayments(@Request() req) {
    return this.paymentService.findByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiatePayment(
    @Body() initiatePaymentDto: InitiatePaymentDto,
    @Request() req,
  ) {
    const payment = await this.paymentService.initiatePayment(
      req.user.id,
      initiatePaymentDto.type,
      initiatePaymentDto.adId,
    );

    const paymentUrl = await this.paymentService.generatePaymentUrl(payment.id);

    return {
      payment,
      paymentUrl,
    };
  }

  @Post(':id/process')
  processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() processPaymentDto: ProcessPaymentDto,
  ) {
    return this.paymentService.processPayment(
      id,
      processPaymentDto.transactionId,
      processPaymentDto.gatewayResponse,
    );
  }

  @Post(':id/fail')
  failPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { gatewayResponse?: string },
  ) {
    return this.paymentService.failPayment(id, body.gatewayResponse);
  }

  @Post(':id/verify')
  verifyPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() verifyPaymentDto: VerifyPaymentDto,
  ) {
    return this.paymentService.verifyPayment(id, verifyPaymentDto.authority);
  }

  @Get(':id/url')
  async getPaymentUrl(@Param('id', ParseIntPipe) id: number) {
    const paymentUrl = await this.paymentService.generatePaymentUrl(id);
    return { paymentUrl };
  }

  // Webhook endpoint for payment gateway callbacks
  @Post('webhook')
  async handleWebhook(@Body() webhookData: any, @Query() query: any) {
    // This would handle payment gateway webhooks
    // Implementation depends on the specific payment gateway being used
    console.log('Payment webhook received:', webhookData, query);

    // Example implementation for a generic webhook
    if (webhookData.status === 'success' && webhookData.paymentId) {
      await this.paymentService.processPayment(
        webhookData.paymentId,
        webhookData.transactionId,
        JSON.stringify(webhookData),
      );
    } else if (webhookData.status === 'failed' && webhookData.paymentId) {
      await this.paymentService.failPayment(
        webhookData.paymentId,
        JSON.stringify(webhookData),
      );
    }

    return { status: 'ok' };
  }
}
