import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from './payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UserService } from '../user/user.service';
import { AdService } from '../ad/ad.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private userService: UserService,
    private adService: AdService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepository.create(createPaymentDto);
    return await this.paymentRepository.save(payment);
  }

  async findAll(): Promise<Payment[]> {
    return await this.paymentRepository.find({
      relations: ['user', 'ad'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user', 'ad'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByUserId(userId: number): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { userId },
      relations: ['ad'],
      order: { createdAt: 'DESC' },
    });
  }

  async createAdFeaturedPayment(
    userId: number,
    adId: number,
    duration: number = 7,
  ): Promise<Payment> {
    const amount = this.calculateFeaturedPrice(duration);

    const createPaymentDto: CreatePaymentDto = {
      userId,
      type: PaymentType.AD_FEATURED,
      amount,
      adId,
    };

    return await this.create(createPaymentDto);
  }

  async createAdBoostPayment(
    userId: number,
    adId: number,
    duration: number = 3,
  ): Promise<Payment> {
    const amount = this.calculateBoostPrice(duration);

    const createPaymentDto: CreatePaymentDto = {
      userId,
      type: PaymentType.AD_BOOST,
      amount,
      adId,
    };

    return await this.create(createPaymentDto);
  }

  async createPremiumSubscriptionPayment(
    userId: number,
    duration: number = 30,
  ): Promise<Payment> {
    const amount = this.calculatePremiumPrice(duration);

    const createPaymentDto: CreatePaymentDto = {
      userId,
      type: PaymentType.PREMIUM_SUBSCRIPTION,
      amount,
    };

    return await this.create(createPaymentDto);
  }

  async createExtraAdPayment(userId: number): Promise<Payment> {
    const amount = this.calculateExtraAdPrice();

    const createPaymentDto: CreatePaymentDto = {
      userId,
      type: PaymentType.EXTRA_AD,
      amount,
    };

    return await this.create(createPaymentDto);
  }

  async processPayment(
    paymentId: number,
    transactionId: string,
    gatewayResponse?: string,
  ): Promise<Payment> {
    const payment = await this.findOne(paymentId);

    payment.status = PaymentStatus.COMPLETED;
    payment.transactionId = transactionId;
    payment.gatewayResponse = gatewayResponse || '';

    const updatedPayment = await this.paymentRepository.save(payment);

    // Apply payment effects
    await this.applyPaymentEffects(updatedPayment);

    return updatedPayment;
  }

  async failPayment(
    paymentId: number,
    gatewayResponse?: string,
  ): Promise<Payment> {
    const payment = await this.findOne(paymentId);

    payment.status = PaymentStatus.FAILED;
    payment.gatewayResponse = gatewayResponse || '';

    return await this.paymentRepository.save(payment);
  }

  private async applyPaymentEffects(payment: Payment): Promise<void> {
    switch (payment.type) {
      case PaymentType.AD_FEATURED:
        if (payment.adId) {
          await this.adService.makeFeatured(payment.adId, 7); // Default 7 days
        }
        break;

      case PaymentType.AD_BOOST:
        if (payment.adId) {
          await this.adService.boost(payment.adId, 3); // Default 3 days
        }
        break;

      case PaymentType.PREMIUM_SUBSCRIPTION:
        // Implement premium subscription logic
        break;

      case PaymentType.EXTRA_AD:
        // Increment user's free ads count
        break;
    }
  }

  private calculateFeaturedPrice(duration: number): number {
    return duration * 10000; // 10,000 تومان per day
  }

  private calculateBoostPrice(duration: number): number {
    return duration * 5000; // 5,000 تومان per day
  }

  private calculatePremiumPrice(duration: number): number {
    return duration * 2000; // 2,000 تومان per day
  }

  private calculateExtraAdPrice(): number {
    return 15000; // 15,000 تومان per extra ad
  }

  async getPaymentStats(): Promise<any> {
    const totalPayments = await this.paymentRepository.count();
    const completedPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.COMPLETED },
    });

    const totalRevenue = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    return {
      totalPayments,
      completedPayments,
      totalRevenue: totalRevenue.total || 0,
    };
  }
}
