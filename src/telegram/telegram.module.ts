import { Module, forwardRef } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotUpdate } from './telegram-bot.update';
import { UserModule } from '../user/user.module';
import { AdModule } from '../ad/ad.module';
import { SettingModule } from '../setting/setting.module';
import { S3Module } from '../s3/s3.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    forwardRef(() => AdModule), // اضافه کردن forwardRef برای جلوگیری از circular dependency
    SettingModule,
    S3Module,
  ],
  providers: [
    TelegramBotService,
    TelegramBotUpdate,
    {
      provide: 'TelegramBotService',
      useExisting: TelegramBotService,
    },
  ],
  exports: [TelegramBotService, 'TelegramBotService'],
})
export class TelegramModule {}
