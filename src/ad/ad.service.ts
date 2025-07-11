import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ad, AdStatus } from './ad.entity';
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
    @Inject(forwardRef(() => 'TelegramBotService'))
    private telegramBotService: any,
  ) {}

  async create(
    createAdDto: CreateAdDto,
    userId: number,
    filesOrUrls?: Array<
      | Express.Multer.File
      | { url: string; filename: string; originalname: string }
    >,
  ): Promise<Ad> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (user.freeAdsCount <= 0 && !user.isPremium) {
      throw new BadRequestException(
        'تعداد آگهی‌های رایگان شما به پایان رسیده است',
      );
    }

    const isValid = await this.validateAdContent(
      createAdDto.title,
      createAdDto.description,
      createAdDto.category,
    );
    if (!isValid) {
      throw new BadRequestException('محتوای آگهی مربوط به تجهیزات عکاسی نیست');
    }

    const expirationDate = createAdDto.expirationDate
      ? new Date(createAdDto.expirationDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const ad = this.adRepository.create({
      ...createAdDto,
      user: user,
      status: AdStatus.APPROVED,
      expirationDate,
    });

    const savedAd = await this.adRepository.save(ad);

    if (filesOrUrls && filesOrUrls.length > 0) {
      // Ensure filesOrUrls is a flat array
      const flatFilesOrUrls = Array.isArray(filesOrUrls[0])
        ? filesOrUrls.flat()
        : filesOrUrls;
      const images = await this.uploadAdImages(savedAd.id, flatFilesOrUrls);
      savedAd.images = images;
    }

    if (!user.isPremium) {
      user.freeAdsCount -= 1;
      await this.userRepository.save(user);
    }

    const completeAd = await this.findOne(savedAd.id);

    try {
      await this.telegramBotService.publishAdToChannel(completeAd);
    } catch (error) {
      console.error('Error publishing ad to channel:', error);
    }

    return completeAd;
  }

  async uploadAdImages(
    adId: number,
    filesOrUrls: Array<
      | Express.Multer.File
      | { url: string; filename: string; originalname: string }
    >,
  ): Promise<AdImage[]> {
    if (filesOrUrls.length > 5) {
      throw new BadRequestException('حداکثر 5 عکس مجاز است');
    }

    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) {
      throw new NotFoundException('آگهی یافت نشد');
    }

    try {
      const uploadPromises = filesOrUrls.map(async (item, index) => {
        let fileUrl: string;
        let s3Key: string;
        let filename: string;

        if ('url' in item) {
          // Handle Telegram-uploaded images with pre-existing URLs
          fileUrl = item.url;
          s3Key = new URL(fileUrl).pathname.replace('/ipfs/', '');
          filename = item.filename;
        } else {
          // Handle API-uploaded files
          fileUrl = await this.s3Service.uploadFile(item);
          s3Key = new URL(fileUrl).pathname.replace('/ipfs/', '');
          filename = item.filename;
        }

        const adImage = this.adImageRepository.create({
          ad,
          url: fileUrl,
          filename,
          s3Key,
          order: index,
        });

        return this.adImageRepository.save(adImage);
      });

      const savedImages = (await Promise.all(uploadPromises)).flat();
      console.log('Saved images:', savedImages); // Debug log
      return savedImages;
    } catch (error) {
      console.error('Error in uploadAdImages:', error);
      throw new BadRequestException('خطا در آپلود تصاویر: ' + error.message);
    }
  }

  async deleteAdImages(adId: number): Promise<void> {
    const images = await this.adImageRepository.find({
      where: { ad: { id: adId } },
    });

    if (images.length > 0) {
      const fileUrls = images.map((image) => image.url);
      await this.s3Service.deleteMultipleFiles(fileUrls);
      await this.adImageRepository.remove(images);
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
      .addOrderBy('ad.isBoosted', 'DESC')
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
    await this.findOne(id);
    await this.deleteAdImages(id);
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
    ad.isBoosted = true;
    ad.boostUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    await this.adRepository.save(ad);
    return ad;
  }

  async findByUser(userId: number): Promise<Ad[]> {
    return this.adRepository.find({
      where: { user: { id: userId } },
      relations: ['images'],
      order: { createdAt: 'DESC' },
    });
  }

  public async validateAdContent(
    title: string,
    description: string,
    category: string,
  ): Promise<boolean> {
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

    if (!validCategories.includes(category)) {
      return false;
    }

    const content = (title + ' ' + description).toLowerCase();
    return photographyKeywords.some((keyword) =>
      content.includes(keyword.toLowerCase()),
    );
  }
}
