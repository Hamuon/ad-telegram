import { Injectable } from '@nestjs/common';
import { Start, Update, On, Hears, Context } from 'nestjs-telegraf';
import { TelegramBotService, BotContext } from './telegram-bot.service';

@Update()
@Injectable()
export class TelegramBotUpdate {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Start()
  async start(@Context() ctx: BotContext) {
    await this.telegramBotService.sendWelcomeMessage(ctx);
  }

  @On('contact')
  async onContact(@Context() ctx: BotContext) {
    await this.telegramBotService.handleContact(ctx);
  }

  @On('location')
  async onLocation(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (session.step === 'waiting_location') {
      await this.telegramBotService.handleAdLocation(ctx);
    }
  }

  @On('photo')
  async onPhoto(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (session.step === 'waiting_images') {
      await this.telegramBotService.handleAdImages(ctx);
    }
  }

  @Hears('📝 ثبت آگهی')
  async onRegisterAd(@Context() ctx: BotContext) {
    await this.telegramBotService.startAdRegistration(ctx);
  }

  @Hears('📋 آگهی‌های من')
  async onMyAds(@Context() ctx: BotContext) {
    await this.telegramBotService.showUserAds(ctx);
  }

  @Hears('🔙 بازگشت به منوی اصلی')
  async onBackToMainMenu(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    this.telegramBotService.clearUserSession(ctx.from.id);
    await this.telegramBotService.showMainMenu(ctx);
  }

  @Hears(['دوربین عکاسی', 'لنز دوربین عکاسی', 'تجهیزات جانبی'])
  async onCategorySelection(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (
      session.step === 'waiting_category' &&
      ctx.message &&
      'text' in ctx.message
    ) {
      await this.telegramBotService.handleAdCategory(ctx, ctx.message.text);
    }
  }

  @Hears(['نو', 'در حد نو', 'کارکرده', 'معیوب'])
  async onConditionSelection(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (
      session.step === 'waiting_condition' &&
      ctx.message &&
      'text' in ctx.message
    ) {
      await this.telegramBotService.handleAdCondition(ctx, ctx.message.text);
    }
  }

  @Hears(['Canon', 'Nikon', 'Fujifilm', 'Sony', 'دیگر'])
  async onBrandSelection(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (
      session.step === 'waiting_brand' &&
      ctx.message &&
      'text' in ctx.message
    ) {
      await this.telegramBotService.handleAdBrand(ctx, ctx.message.text);
    }
  }

  @Hears('تمام')
  async onImagesComplete(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (session.step === 'waiting_images') {
      await this.telegramBotService.handleAdImages(ctx);
    }
  }

  @Hears('رد کردن موقعیت مکانی')
  async onSkipLocation(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (session.step === 'waiting_location') {
      await this.telegramBotService.handleAdLocation(ctx);
    }
  }

  @Hears('✅ تایید و ثبت آگهی')
  async onConfirmAd(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    if (session.step === 'waiting_confirmation') {
      await this.telegramBotService.confirmAdRegistration(ctx);
    }
  }

  @Hears('❌ لغو')
  async onCancelAd(@Context() ctx: BotContext) {
    if (!ctx.from) return;
    this.telegramBotService.clearUserSession(ctx.from.id);
    await ctx.reply('ثبت آگهی لغو شد.');
    await this.telegramBotService.showMainMenu(ctx);
  }

  @Hears('📞 پشتیبانی')
  async onSupport(@Context() ctx: BotContext) {
    await ctx.reply('برای پشتیبانی با ادمین در ارتباط باشید: @admin_username');
  }

  @Hears('📖 راهنما')
  async onHelp(@Context() ctx: BotContext) {
    const helpMessage = `
📖 راهنمای استفاده از ربات:

1️⃣ ابتدا شماره تلفن خود را به اشتراک بگذارید
2️⃣ برای ثبت آگهی، روی "ثبت آگهی" کلیک کنید
3️⃣ مراحل ثبت آگهی را قدم به قدم دنبال کنید
4️⃣ آگهی شما پس از تایید ادمین منتشر می‌شود
5️⃣ در بخش "آگهی‌های من" می‌توانید آگهی‌هایتان را مدیریت کنید

⚠️ توجه: فقط آگهی‌های مربوط به تجهیزات عکاسی پذیرفته می‌شود.
    `;

    await ctx.reply(helpMessage);
  }

  @On('callback_query')
  async onCallbackQuery(@Context() ctx: BotContext) {
    if (!ctx.from || !ctx.callbackQuery || !('data' in ctx.callbackQuery))
      return;
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    const data = ctx.callbackQuery.data;

    switch (session.step) {
      case 'waiting_province_selection':
        await this.telegramBotService.handleProvinceSelection(ctx, data);
        break;
      case 'waiting_city_selection':
        await this.telegramBotService.handleCitySelection(ctx, data);
        break;
    }
    await ctx.answerCbQuery(); // Acknowledge the callback query
  }

  @On('text')
  async onText(@Context() ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
      return;
    }
    const session = this.telegramBotService.getUserSession(ctx.from.id);
    const text = ctx.message.text;

    switch (session.step) {
      case 'waiting_title':
        await this.telegramBotService.handleAdTitle(ctx, text);
        break;
      case 'waiting_description':
        await this.telegramBotService.handleAdDescription(ctx, text);
        break;
      case 'waiting_price':
        await this.telegramBotService.handleAdPrice(ctx, text);
        break;
      case 'waiting_province_selection': {
        const provinces = this.telegramBotService.getProvinces();
        const province = provinces.find((p) => p.provinceName === text);
        if (province) {
          await this.telegramBotService.handleProvinceSelection(
            ctx,
            province.provinceId,
          );
        } else {
          await ctx.reply(
            'استان نامعتبر است. لطفاً از دکمه‌های زیر انتخاب کنید:',
          );
          await this.telegramBotService.showProvinceSelection(ctx);
        }
        break;
      }
      default:
        await ctx.reply('دستور نامشخص. لطفاً از منوی اصلی استفاده کنید.');
        await this.telegramBotService.showMainMenu(ctx);
        break;
    }
  }
}
