import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { UserService } from '../user/user.service';
import { AdService } from '../ad/ad.service';
import { SettingService } from '../setting/setting.service';
import { S3Service } from '../s3/s3.service';

export interface BotContext extends Context {
  session?: any;
}

@Injectable()
export class TelegramBotService {
  private bot: Telegraf<BotContext>;
  private userSessions = new Map<number, any>();

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private adService: AdService,
    private settingService: SettingService,
    private s3Service: S3Service,
  ) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.bot = new Telegraf(botToken);
  }

  async sendWelcomeMessage(ctx: BotContext) {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);

    if (!user) {
      const welcomeMessage = `
سلام ${ctx.from.first_name}! 👋

به ربات آگهی تجهیزات عکاسی خوش آمدید! 📸

برای شروع، لطفاً شماره تلفن خود را به اشتراک بگذارید تا بتوانید آگهی ثبت کنید.
      `;

      const keyboard = {
        keyboard: [
          [{ text: '📱 اشتراک‌گذاری شماره تلفن', request_contact: true }],
          [{ text: '📖 راهنما' }, { text: '📞 پشتیبانی' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      await ctx.reply(welcomeMessage, { reply_markup: keyboard });
    } else {
      await this.showMainMenu(ctx);
    }
  }

  async handleContact(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('contact' in ctx.message)) return;

    const contact = ctx.message.contact;
    const telegramId = ctx.from.id.toString();

    if (contact.user_id !== ctx.from.id) {
      await ctx.reply('لطفاً شماره تلفن خود را به اشتراک بگذارید.');
      return;
    }

    const userData = {
      phoneNumber: contact.phone_number,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    };

    try {
      await this.userService.createOrUpdate(telegramId, userData);
      await ctx.reply('✅ شماره تلفن شما با موفقیت ثبت شد!');
      await this.showMainMenu(ctx);
    } catch (error) {
      console.error('Error saving user:', error);
      await ctx.reply('خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.');
    }
  }

  async showMainMenu(ctx: BotContext) {
    const keyboard = {
      keyboard: [
        [{ text: '📝 ثبت آگهی' }, { text: '📋 آگهی‌های من' }],
        [{ text: '📖 راهنما' }, { text: '📞 پشتیبانی' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await ctx.reply('چه کاری می‌خواهید انجام دهید؟', {
      reply_markup: keyboard,
    });
  }

  async startAdRegistration(ctx: BotContext) {
    if (!ctx.from) return;
    const telegramId = ctx.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('ابتدا باید شماره تلفن خود را به اشتراک بگذارید.');
      return this.sendWelcomeMessage(ctx);
    }

    if (user.freeAdsCount <= 0 && !user.isPremium) {
      await ctx.reply(
        'تعداد آگهی‌های رایگان شما تمام شده است. برای ثبت آگهی جدید باید پرداخت کنید.',
      );
      return;
    }

    this.setUserSession(ctx.from.id, {
      step: 'waiting_title',
      adData: {},
      uploadedFiles: [],
    });
    await ctx.reply('عنوان آگهی خود را وارد کنید:');
  }

  async handleAdTitle(ctx: BotContext, title: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.title = title;
    session.step = 'waiting_description';

    await ctx.reply('توضیحات آگهی را وارد کنید:');
  }

  async handleAdDescription(ctx: BotContext, description: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.description = description;
    session.step = 'waiting_images';

    await ctx.reply(
      'حداکثر 5 عکس از محصول خود ارسال کنید. پس از ارسال عکس‌ها، "تمام" را بفرستید:',
    );
  }

  async handleAdImages(ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);

    if (!session.uploadedFiles) {
      session.uploadedFiles = [];
    }

    if (ctx.message && 'photo' in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      if (session.uploadedFiles.length >= 5) {
        await ctx.reply('حداکثر 5 عکس مجاز است. برای ادامه "تمام" را بفرستید.');
        return;
      }

      try {
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const response = await fetch(fileLink.href);
        const buffer = await response.arrayBuffer();

        const file: Express.Multer.File = {
          buffer: Buffer.from(buffer),
          originalname: `${fileId}.jpg`,
          mimetype: 'image/jpeg',
          size: photo.file_size ?? 0,
          fieldname: 'images',
          encoding: '7bit',
          destination: '',
          filename: `${fileId}.jpg`,
          path: '',
          stream: null as any,
        };

        // آپلود فایل به Filebase
        await this.s3Service.uploadFile(file, 'ads');
        session.uploadedFiles.push(file);

        await ctx.reply(
          `عکس ${session.uploadedFiles.length} دریافت شد. برای ادامه "تمام" را بفرستید یا عکس بیشتری ارسال کنید.`,
        );
      } catch (error) {
        console.error('Error downloading file from Telegram:', error);
        await ctx.reply('خطا در دریافت عکس. لطفاً دوباره تلاش کنید.');
      }
    } else if (
      ctx.message &&
      'text' in ctx.message &&
      ctx.message.text === 'تمام'
    ) {
      if (session.uploadedFiles.length === 0) {
        await ctx.reply('حداقل یک عکس باید ارسال کنید.');
        return;
      }

      session.step = 'waiting_category';
      await this.showCategorySelection(ctx);
    }
  }

  async showCategorySelection(ctx: BotContext) {
    const keyboard = {
      keyboard: [
        [{ text: 'دوربین عکاسی' }],
        [{ text: 'لنز دوربین عکاسی' }],
        [{ text: 'تجهیزات جانبی' }],
        [{ text: '🔙 بازگشت به منوی اصلی' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await ctx.reply('دسته‌بندی محصول خود را انتخاب کنید:', {
      reply_markup: keyboard,
    });
  }

  async handleAdCategory(ctx: BotContext, category: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.category = category;
    session.step = 'waiting_condition';

    await this.showConditionSelection(ctx);
  }

  async showConditionSelection(ctx: BotContext) {
    const keyboard = {
      keyboard: [
        [{ text: 'نو' }, { text: 'در حد نو' }],
        [{ text: 'کارکرده' }, { text: 'معیوب' }],
        [{ text: '🔙 بازگشت به منوی اصلی' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await ctx.reply('وضعیت محصول را انتخاب کنید:', { reply_markup: keyboard });
  }

  async handleAdCondition(ctx: BotContext, condition: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.condition = condition;
    session.step = 'waiting_brand';

    await ctx.reply('برند محصول را وارد کنید:');
  }

  async handleAdBrand(ctx: BotContext, brand: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.brand = brand;
    session.step = 'waiting_province';

    await ctx.reply('استان خود را وارد کنید:');
  }

  async handleAdProvince(ctx: BotContext, province: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.province = province;
    session.step = 'waiting_city';

    await ctx.reply('شهر خود را وارد کنید:');
  }

  async handleAdCity(ctx: BotContext, city: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    session.adData.city = city;
    session.step = 'waiting_location';

    const keyboard = {
      keyboard: [
        [{ text: '📍 اشتراک‌گذاری موقعیت مکانی', request_location: true }],
        [{ text: 'رد کردن موقعیت مکانی' }],
        [{ text: '🔙 بازگشت به منوی اصلی' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await ctx.reply('موقعیت مکانی خود را به اشتراک بگذارید (اختیاری):', {
      reply_markup: keyboard,
    });
  }

  async handleAdLocation(ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);

    if (ctx.message && 'location' in ctx.message) {
      session.adData.latitude = ctx.message.location.latitude;
      session.adData.longitude = ctx.message.location.longitude;
    }

    session.step = 'waiting_price';
    await ctx.reply('قیمت محصول را به تومان وارد کنید:');
  }

  async handleAdPrice(ctx: BotContext, price: string) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);

    const numericPrice = parseInt(price.replace(/[^\d]/g, ''));
    if (isNaN(numericPrice) || numericPrice <= 0) {
      await ctx.reply('لطفاً قیمت معتبری وارد کنید:');
      return;
    }

    session.adData.price = numericPrice;
    session.step = 'waiting_confirmation';

    await this.showAdPreview(ctx);
  }

  async showAdPreview(ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    const adData = session.adData;

    const previewMessage = `
📋 پیش‌نمایش آگهی:

📝 عنوان: ${adData.title}
📄 توضیحات: ${adData.description}
🏷️ دسته‌بندی: ${adData.category}
🔧 وضعیت: ${adData.condition}
🏭 برند: ${adData.brand}
📍 موقعیت: ${adData.province}, ${adData.city}
💰 قیمت: ${adData.price.toLocaleString()} تومان
🖼️ تعداد عکس: ${session.uploadedFiles.length}

آیا اطلاعات صحیح است؟
    `;

    const keyboard = {
      keyboard: [
        [{ text: '✅ تایید و ثبت آگهی' }],
        [{ text: '❌ لغو' }],
        [{ text: '🔙 بازگشت به منوی اصلی' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await ctx.reply(previewMessage, { reply_markup: keyboard });
  }

  async confirmAdRegistration(ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.getUserSession(ctx.from.id);
    const telegramId = ctx.from.id.toString();

    try {
      const user = await this.userService.findByTelegramId(telegramId);

      const isValid = await this.adService.validateAdContent(
        session.adData.title,
        session.adData.description,
        session.adData.category,
      );

      if (!isValid) {
        await ctx.reply(
          '❌ آگهی شما مربوط به تجهیزات عکاسی نیست و رد شد. لطفاً آگهی مناسب ثبت کنید.',
        );
        this.clearUserSession(ctx.from.id);
        await this.showMainMenu(ctx);
        return;
      }

      const createAdDto = {
        title: session.adData.title,
        description: session.adData.description,
        category: session.adData.category,
        condition: session.adData.condition,
        brand: session.adData.brand,
        price: session.adData.price,
        province: session.adData.province,
        city: session.adData.city,
        latitude: session.adData.latitude,
        longitude: session.adData.longitude,
        userId: user!.id,
        expirationDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // تنظیم پیش‌فرض
      };

      await this.adService.create(createAdDto, user!.id, session.uploadedFiles);

      await ctx.reply(
        '✅ آگهی شما با موفقیت ثبت شد و پس از تایید ادمین منتشر خواهد شد.',
      );

      this.clearUserSession(ctx.from.id);
      await this.showMainMenu(ctx);
    } catch (error) {
      console.error('Error creating ad:', error);
      await ctx.reply('❌ خطا در ثبت آگهی. لطفاً دوباره تلاش کنید.');
    }
  }

  async showUserAds(ctx: BotContext) {
    if (!ctx.from) return;
    const telegramId = ctx.from.id.toString();

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      if (!user) {
        await ctx.reply('کاربر یافت نشد.');
        return;
      }

      const ads = await this.adService.findByUser(user.id);

      if (ads.length === 0) {
        await ctx.reply('شما هنوز آگهی ثبت نکرده‌اید.');
        return;
      }

      let message = '📋 آگهی‌های شما:\n\n';
      ads.forEach((ad, index) => {
        message += `${index + 1}. ${ad.title}\n`;
        message += `   💰 ${ad.price.toLocaleString()} تومان\n`;
        message += `   📊 وضعیت: ${ad.status}\n\n`;
      });

      await ctx.reply(message);
    } catch (error) {
      console.error('Error fetching user ads:', error);
      await ctx.reply('خطا در دریافت آگهی‌ها.');
    }
  }

  public setUserSession(userId: number, session: any) {
    this.userSessions.set(userId, session);
  }

  public getUserSession(userId: number): any {
    return this.userSessions.get(userId) || {};
  }

  public clearUserSession(userId: number) {
    this.userSessions.delete(userId);
  }

  async publishAdToChannel(ad: any) {
    const channelId = this.configService.get('TELEGRAM_CHANNEL_ID');
    if (!channelId) return;

    const message = `
🆕 آگهی جدید

📝 ${ad.title}
📄 ${ad.description}
🏷️ ${ad.category}
💰 ${ad.price.toLocaleString()} تومان
📍 ${ad.province}, ${ad.city}
🖼️ تصاویر: ${ad.images.map((img: any) => img.url).join('\n')}

#${ad.category.replace(/\s+/g, '_')}
    `;

    try {
      await this.bot.telegram.sendMessage(channelId, message);
    } catch (error) {
      console.error('Error publishing to channel:', error);
    }
  }
}
