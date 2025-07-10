import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { MulterModule } from '@nestjs/platform-express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AdModule } from './ad/ad.module';
import { SettingModule } from './setting/setting.module';
import { TelegramModule } from './telegram/telegram.module';
import { PaymentModule } from './payment/payment.module';
import { S3Module } from './s3/s3.module';
import { User } from './user/user.entity';
import { Ad } from './ad/ad.entity';
import { AdImage } from './ad/ad-image.entity';
import { Payment } from './payment/payment.entity';
import { Setting } from './setting/setting.entity';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Module
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'telegram_ad_bot',
      entities: [User, Ad, AdImage, Payment, Setting],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),

    // Telegram Bot Module
    TelegrafModule.forRoot({
      token: (() => {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
          throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
        }
        return process.env.TELEGRAM_BOT_TOKEN;
      })(),
    }),

    // Multer Module for file uploads
    MulterModule.register({
      dest: './uploads',
    }),

    // Application Modules
    UserModule,
    AuthModule,
    AdModule,
    SettingModule,
    TelegramModule,
    PaymentModule,
    S3Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
