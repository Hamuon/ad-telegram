import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { SettingService } from './setting.service';

export class SetSettingDto {
  key: string;
  value: string;
  description?: string;
}

@Controller('settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  findAll() {
    return this.settingService.findAll();
  }

  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.settingService.findByKey(key);
  }

  @Get(':key/value')
  getValue(@Param('key') key: string) {
    return this.settingService.getValue(key);
  }

  @Post()
  setValue(@Body() setSettingDto: SetSettingDto) {
    return this.settingService.setValue(
      setSettingDto.key,
      setSettingDto.value,
      setSettingDto.description,
    );
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.settingService.remove(key);
  }

  @Get('predefined/welcome-message')
  getWelcomeMessage() {
    return this.settingService.getWelcomeMessage();
  }

  @Get('predefined/ad-guidelines')
  getAdGuidelines() {
    return this.settingService.getAdGuidelines();
  }

  @Get('predefined/featured-ad-price')
  getFeaturedAdPrice() {
    return this.settingService.getFeaturedAdPrice();
  }

  @Get('predefined/boost-ad-price')
  getBoostAdPrice() {
    return this.settingService.getBoostAdPrice();
  }

  @Get('predefined/extra-ad-price')
  getExtraAdPrice() {
    return this.settingService.getExtraAdPrice();
  }
}
