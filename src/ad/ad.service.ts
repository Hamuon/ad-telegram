import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ad, AdStatus } from '../ad/ad.entity';
import { AdImage } from './ad-image.entity';
import { User } from 'src/user/user.entity';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { FilterAdDto } from './dto/filter-ad.dto';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class AdService {
  constructor(
    @InjectRepository(Ad)
    private adRepository: Repository<Ad>,
    @InjectRepository(AdImage)
    private adImageRepository: Repository<AdImage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private s3Service: S3Service,
  ) {}

  async create(
    createAdDto: CreateAdDto,
    userId: number,
    files?: Express.Multer.File[],
  ): Promise<Ad> {
    // بررسی وجود کاربر
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    // بررسی تعداد آگهی‌های رایگان
    if (user.freeAdsCount <= 0 && !user.isPremium) {
      throw new BadRequestException(
        'تعداد آگهی‌های رایگان شما به پایان رسیده است',
      );
    }

    // اعتبارسنجی محتوای آگهی
    const isValid = await this.validateAdContent(
      createAdDto.title,
      createAdDto.description,
      createAdDto.category,
    );
    if (!isValid) {
      throw new BadRequestException('محتوای آگهی مربوط به تجهیزات عکاسی نیست');
    }

    // ایجاد آگهی
    const ad = this.adRepository.create({
      ...createAdDto,
      user: user, // Assign the user object directly
      status: AdStatus.PENDING, // Use enum value
    });

    const savedAd = await this.adRepository.save(ad);

    // آپلود تصاویر به S3 (در صورت وجود)
    if (files && files.length > 0) {
      await this.uploadAdImages(savedAd.id, files);
    }

    // کاهش تعداد آگهی‌های رایگان (اگر کاربر پرمیوم نباشد)
    if (!user.isPremium) {
      user.freeAdsCount -= 1;
      await this.userRepository.save(user);
    }

    return this.findOne(savedAd.id);
  }

  async uploadAdImages(
    adId: number,
    files: Express.Multer.File[],
  ): Promise<AdImage[]> {
    // بررسی حداکثر 5 عکس
    if (files.length > 5) {
      throw new BadRequestException('حداکثر 5 عکس مجاز است');
    }

    // بررسی وجود آگهی
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) {
      throw new NotFoundException('آگهی یافت نشد');
    }

    try {
      // آپلود فایل‌ها به S3
      const uploadPromises = files.map(async (file, index) => {
        const s3Url = await this.s3Service.uploadFile(file, 'ads');

        // استخراج کلید S3 از URL
        const url = new URL(s3Url);
        const s3Key = url.pathname.substring(1);

        const adImage = this.adImageRepository.create({
          ad: ad, // Assign the ad object directly
          url: s3Url,
          filename: file.originalname,
          s3Key,
          order: index,
          size: file.size,
          mimeType: file.mimetype,
        });

        return this.adImageRepository.save(adImage);
      });

      const savedImages = await Promise.all(uploadPromises);
      return savedImages;
    } catch (error) {
      throw new BadRequestException('خطا در آپلود تصاویر: ' + error.message);
    }
  }

  async deleteAdImages(adId: number): Promise<void> {
    // دریافت تصاویر آگهی
    const images = await this.adImageRepository.find({
      where: { ad: { id: adId } },
    }); // Use relation

    if (images.length > 0) {
      // حذف فایل‌ها از S3
      const s3Urls = images.map((image) => image.url);
      await this.s3Service.deleteMultipleFiles(s3Urls);

      // حذف رکوردها از دیتابیس
      await this.adImageRepository.remove(images); // Use remove for entities
    }
  }

  async findAll(
    filterDto: FilterAdDto = {},
  ): Promise<{ data: Ad[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      province,
      city,
    } = filterDto;

    const queryBuilder = this.adRepository
      .createQueryBuilder('ad')
      .leftJoinAndSelect('ad.user', 'user')
      .leftJoinAndSelect('ad.images', 'images')
      .orderBy('ad.isFeatured', 'DESC')
      .addOrderBy('ad.isBoosted', 'DESC') // Corrected property name
      .addOrderBy('ad.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('ad.status = :status', { status });
    }

    if (category) {
      queryBuilder.andWhere('ad.category = :category', { category });
    }

    if (province) {
      queryBuilder.andWhere('ad.province = :province', { province });
    }

    if (city) {
      queryBuilder.andWhere('ad.city = :city', { city });
    }

    const total = await queryBuilder.getCount();
    const data = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async findOne(id: number): Promise<Ad> {
    const ad = await this.adRepository.findOne({
      where: { id },
      relations: ['user', 'images'],
    });

    if (!ad) {
      throw new NotFoundException('آگهی یافت نشد');
    }

    return ad;
  }

  async update(id: number, updateAdDto: UpdateAdDto): Promise<Ad> {
    const ad = await this.findOne(id);

    Object.assign(ad, updateAdDto);
    await this.adRepository.save(ad);

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const ad = await this.findOne(id);

    // حذف تصاویر از S3
    await this.deleteAdImages(id);

    // حذف آگهی
    await this.adRepository.delete(id);
  }

  async updateStatus(id: number, status: AdStatus): Promise<Ad> {
    const ad = await this.findOne(id);
    ad.status = status;
    await this.adRepository.save(ad);
    return ad;
  }

  async makeFeatured(id: number, duration: number = 7): Promise<Ad> {
    const ad = await this.findOne(id);
    ad.isFeatured = true;
    ad.featuredUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    await this.adRepository.save(ad);
    return ad;
  }

  async boost(id: number, duration: number = 3): Promise<Ad> {
    const ad = await this.findOne(id);
    ad.isBoosted = true; // Corrected property name
    ad.boostUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    await this.adRepository.save(ad);
    return ad;
  }

  async findByUser(userId: number): Promise<Ad[]> {
    return this.adRepository.find({
      where: { user: { id: userId } }, // Use relation
      relations: ['images'],
      order: { createdAt: 'DESC' },
    });
  }

  public async validateAdContent(
    title: string,
    description: string,
    category: string,
  ): Promise<boolean> {
    // کلمات کلیدی مربوط به تجهیزات عکاسی
    const photographyKeywords = [
      'دوربین',
      'لنز',
      'فلاش',
      'ترایپاد',
      'عکاسی',
      'فیلمبرداری',
      'کانن',
      'نیکون',
      'سونی',
      'فوجی',
      'پاناسونیک',
      'المپوس',
      'camera',
      'lens',
      'flash',
      'tripod',
      'photography',
      'canon',
      'nikon',
      'sony',
      'fuji',
      'panasonic',
      'olympus',
    ];

    const validCategories = [
      'دوربین عکاسی',
      'لنز دوربین عکاسی',
      'تجهیزات جانبی',
    ];

    // بررسی دسته‌بندی
    if (!validCategories.includes(category)) {
      return false;
    }

    // بررسی وجود کلمات کلیدی در عنوان یا توضیحات
    const content = (title + ' ' + description).toLowerCase();
    return photographyKeywords.some((keyword) =>
      content.includes(keyword.toLowerCase()),
    );
  }
}
