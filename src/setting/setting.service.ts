import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return await this.settingRepository.find();
  }

  async findByKey(key: string): Promise<Setting | null> {
    return await this.settingRepository.findOne({ where: { key } });
  }

  async getValue(key: string): Promise<string | null> {
    const setting = await this.findByKey(key);
    return setting ? setting.value : null;
  }

  async setValue(
    key: string,
    value: string,
    description?: string,
  ): Promise<Setting> {
    let setting = await this.findByKey(key);

    if (setting) {
      setting.value = value;
      if (description) {
        setting.description = description;
      }
    } else {
      setting = this.settingRepository.create({ key, value, description });
    }

    return await this.settingRepository.save(setting);
  }

  async remove(key: string): Promise<void> {
    const setting = await this.findByKey(key);
    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }
    await this.settingRepository.remove(setting);
  }

  // Predefined setting getters
  async getWelcomeMessage(): Promise<string> {
    return (
      (await this.getValue('welcome_message')) ||
      'سلام! به ربات آگهی تجهیزات عکاسی خوش آمدید.'
    );
  }

  async getAdGuidelines(): Promise<string> {
    return (
      (await this.getValue('ad_guidelines')) ||
      'لطفاً توجه داشته باشید که فقط آگهی‌های مربوط به تجهیزات عکاسی پذیرفته می‌شود.'
    );
  }

  async getFeaturedAdPrice(): Promise<number> {
    const price = await this.getValue('featured_ad_price');
    return price ? parseInt(price) : 50000;
  }

  async getBoostAdPrice(): Promise<number> {
    const price = await this.getValue('boost_ad_price');
    return price ? parseInt(price) : 20000;
  }

  async getExtraAdPrice(): Promise<number> {
    const price = await this.getValue('extra_ad_price');
    return price ? parseInt(price) : 30000;
  }
}
