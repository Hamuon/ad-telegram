import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Ad } from './ad.entity';

@Entity('ad_images')
export class AdImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ad, (ad) => ad.images, { onDelete: 'CASCADE' })
  ad: Ad;

  @Column()
  adId: number;

  @Column()
  url: string; // S3 URL

  @Column({ nullable: true })
  filename: string; // نام اصلی فایل

  @Column({ nullable: true })
  s3Key: string; // کلید فایل در S3

  @Column({ default: 0 })
  order: number; // ترتیب نمایش تصویر

  @Column({ nullable: true })
  size: number; // اندازه فایل به بایت

  @Column({ nullable: true })
  mimeType: string; // نوع فایل

  @CreateDateColumn()
  createdAt: Date;
}
