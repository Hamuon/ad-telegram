import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdService } from './ad.service';
import { AdController } from './ad.controller';
import { Ad } from './ad.entity';
import { AdImage } from './ad-image.entity';
import { User } from 'src/user/user.entity';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ad, AdImage, User]), S3Module],
  controllers: [AdController],
  providers: [AdService],
  exports: [AdService],
})
export class AdModule {}
