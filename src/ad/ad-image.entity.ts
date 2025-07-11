import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Ad } from './ad.entity';

@Entity('ad_images')
export class AdImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ad, (ad) => ad.images)
  ad: Ad;

  @Column()
  url: string;

  @Column()
  filename: string;

  @Column()
  s3Key: string;

  @Column()
  order: number;
}
