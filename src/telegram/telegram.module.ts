import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotUpdate } from './telegram-bot.update';
import { UserModule } from '../user/user.module';
import { AdModule } from '../ad/ad.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [UserModule, AdModule, SettingModule],
  providers: [TelegramBotService, TelegramBotUpdate],
  exports: [TelegramBotService],
})
export class TelegramModule {}

