import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdService } from './ad.service';
import { AdController } from './ad.controller';
import { Ad } from './ad.entity';
import { AdImage } from './ad-image.entity';
import { User } from '../user/user.entity'; // اضافه کردن User entity
import { UserModule } from '../user/user.module';
import { S3Module } from '../s3/s3.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ad, AdImage, User]), // اضافه کردن User به TypeOrmModule
    UserModule,
    S3Module,
    forwardRef(() => TelegramModule), // اضافه کردن TelegramModule با forwardRef
  ],
  controllers: [AdController],
  providers: [AdService],
  exports: [AdService],
})
export class AdModule {}
