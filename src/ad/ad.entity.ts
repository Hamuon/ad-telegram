import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/user/user.entity';
import { AdImage } from './ad-image.entity';

export enum AdCategory {
  CAMERA = 'دوربین عکاسی',
  LENS = 'لنز دوربین عکاسی',
  ACCESSORIES = 'تجهیزات جانبی',
}

export enum AdCondition {
  NEW = 'نو',
  LIKE_NEW = 'در حد نو',
  USED = 'کارکرده',
  DEFECTIVE = 'معیوب',
}

export enum AdStatus {
  PENDING = 'در انتظار تایید',
  APPROVED = 'تایید شده',
  REJECTED = 'رد شده',
  EXPIRED = 'منقضی شده',
  DELETED = 'حذف شده',
}

@Entity('ads')
export class Ad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: AdCategory,
  })
  category: AdCategory;

  @Column()
  brand: string;

  @Column({
    type: 'enum',
    enum: AdCondition,
  })
  condition: AdCondition;

  @Column('decimal', { precision: 15, scale: 0 })
  price: number;

  @Column()
  province: string;

  @Column()
  city: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({
    type: 'enum',
    enum: AdStatus,
    default: AdStatus.PENDING,
  })
  status: AdStatus;

  @Column()
  expirationDate: Date;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isBoosted: boolean;

  @Column({ nullable: true })
  telegramMessageId: number;

  @Column({ type: 'timestamp', nullable: true })
  featuredUntil: Date;

  @Column({ type: 'timestamp', nullable: true })
  boostUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.ads)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => AdImage, (adImage) => adImage.ad, { cascade: true })
  images: AdImage[];
}
