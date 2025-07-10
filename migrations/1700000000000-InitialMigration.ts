import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  name = 'InitialMigration1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "telegramId" bigint NOT NULL,
        "phoneNumber" character varying NOT NULL,  
        "firstName" character varying,
        "lastName" character varying,
        "username" character varying,
        "isPremium" boolean NOT NULL DEFAULT false,
        "freeAdsCount" integer NOT NULL DEFAULT 1,
        "isBlocked" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_telegramId" UNIQUE ("telegramId"),
        CONSTRAINT "UQ_users_phoneNumber" UNIQUE ("phoneNumber"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Create ads table
    await queryRunner.query(`
      CREATE TYPE "ad_category_enum" AS ENUM('دوربین عکاسی', 'لنز دوربین عکاسی', 'تجهیزات جانبی');
      CREATE TYPE "ad_condition_enum" AS ENUM('نو', 'در حد نو', 'کارکرده', 'معیوب');
      CREATE TYPE "ad_status_enum" AS ENUM('در انتظار تایید', 'تایید شده', 'رد شده', 'منقضی شده', 'حذف شده');
      
      CREATE TABLE "ads" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "category" "ad_category_enum" NOT NULL,
        "brand" character varying NOT NULL,
        "condition" "ad_condition_enum" NOT NULL,
        "price" numeric(15,0) NOT NULL,
        "province" character varying NOT NULL,
        "city" character varying NOT NULL,
        "latitude" numeric(10,8),
        "longitude" numeric(11,8),
        "status" "ad_status_enum" NOT NULL DEFAULT 'در انتظار تایید',
        "expirationDate" TIMESTAMP NOT NULL,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "isBoosted" boolean NOT NULL DEFAULT false,
        "telegramMessageId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ads_id" PRIMARY KEY ("id")
      )
    `);

    // Create ad_images table
    await queryRunner.query(`
      CREATE TABLE "ad_images" (
        "id" SERIAL NOT NULL,
        "adId" integer NOT NULL,
        "url" character varying NOT NULL,
        "filename" character varying NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_images_id" PRIMARY KEY ("id")
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TYPE "payment_type_enum" AS ENUM('ویژه کردن آگهی', 'نردبان کردن آگهی', 'خرید آگهی رایگان اضافی', 'اشتراک ویژه');
      CREATE TYPE "payment_status_enum" AS ENUM('در انتظار', 'موفق', 'ناموفق', 'لغو شده');
      
      CREATE TABLE "payments" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "amount" numeric(15,0) NOT NULL,
        "type" "payment_type_enum" NOT NULL,
        "status" "payment_status_enum" NOT NULL DEFAULT 'در انتظار',
        "transactionId" character varying,
        "gatewayResponse" character varying,
        "adId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id")
      )
    `);

    // Create settings table
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" SERIAL NOT NULL,
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_settings_key" UNIQUE ("key"),
        CONSTRAINT "PK_settings_id" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "ads" ADD CONSTRAINT "FK_ads_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ad_images" ADD CONSTRAINT "FK_ad_images_adId" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Insert default settings
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value", "description") VALUES
      ('welcome_message', 'سلام! به ربات آگهی تجهیزات عکاسی خوش آمدید. برای شروع، لطفاً شماره تلفن خود را به اشتراک بگذارید.', 'پیام خوش‌آمدگویی ربات'),
      ('ad_guidelines', 'لطفاً توجه داشته باشید که فقط آگهی‌های مربوط به تجهیزات عکاسی پذیرفته می‌شود.', 'راهنمای ثبت آگهی'),
      ('featured_ad_price', '50000', 'قیمت ویژه کردن آگهی (تومان)'),
      ('boost_ad_price', '20000', 'قیمت نردبان کردن آگهی (تومان)'),
      ('extra_ad_price', '30000', 'قیمت خرید آگهی رایگان اضافی (تومان)')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ad_images" DROP CONSTRAINT "FK_ad_images_adId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ads" DROP CONSTRAINT "FK_ads_userId"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_type_enum"`);
    await queryRunner.query(`DROP TABLE "ad_images"`);
    await queryRunner.query(`DROP TABLE "ads"`);
    await queryRunner.query(`DROP TYPE "ad_status_enum"`);
    await queryRunner.query(`DROP TYPE "ad_condition_enum"`);
    await queryRunner.query(`DROP TYPE "ad_category_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
