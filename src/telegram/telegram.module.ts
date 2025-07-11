import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotUpdate } from './telegram-bot.update';
import { UserModule } from '../user/user.module';
import { AdModule } from '../ad/ad.module';
import { SettingModule } from '../setting/setting.module';
import { S3Module } from '../s3/s3.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, UserModule, AdModule, SettingModule, S3Module],
  providers: [TelegramBotService, TelegramBotUpdate],
  exports: [TelegramBotService],
})
export class TelegramModule {}
