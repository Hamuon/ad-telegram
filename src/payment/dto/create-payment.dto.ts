import { IsNumber, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentType } from '../payment.entity';

export class CreatePaymentDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsOptional()
  @IsNumber()
  adId?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
