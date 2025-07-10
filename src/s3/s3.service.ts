import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_S3_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        'AWS S3 configuration is incomplete. Please check your .env file.',
      );
    }

    this.s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    this.bucketName = bucketName;
  }

  /**
   * آپلود فایل به S3
   * @param file فایل برای آپلود
   * @param folder پوشه مقصد در S3
   * @returns URL فایل آپلود شده
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'ads',
  ): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        },
      });

      const result = await upload.done();
      const fileUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_S3_REGION')}.amazonaws.com/${fileName}`;

      this.logger.log(`File uploaded successfully: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      this.logger.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  /**
   * آپلود چندین فایل به S3
   * @param files آرایه فایل‌ها برای آپلود
   * @param folder پوشه مقصد در S3
   * @returns آرایه URL های فایل‌های آپلود شده
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'ads',
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadFile(file, folder));
      const urls = await Promise.all(uploadPromises);

      this.logger.log(`${files.length} files uploaded successfully`);
      return urls;
    } catch (error) {
      this.logger.error('Error uploading multiple files to S3:', error);
      throw new Error('Failed to upload files to S3');
    }
  }

  /**
   * حذف فایل از S3
   * @param fileUrl URL فایل برای حذف
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // استخراج key از URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // حذف / از ابتدا

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${fileUrl}`);
    } catch (error) {
      this.logger.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file from S3');
    }
  }

  /**
   * حذف چندین فایل از S3
   * @param fileUrls آرایه URL های فایل‌ها برای حذف
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    try {
      const deletePromises = fileUrls.map((url) => this.deleteFile(url));
      await Promise.all(deletePromises);

      this.logger.log(`${fileUrls.length} files deleted successfully`);
    } catch (error) {
      this.logger.error('Error deleting multiple files from S3:', error);
      throw new Error('Failed to delete files from S3');
    }
  }

  /**
   * دریافت URL امضا شده برای دسترسی موقت به فایل
   * @param fileUrl URL فایل
   * @param expiresIn مدت زمان انقضا به ثانیه (پیش‌فرض: 1 ساعت)
   * @returns URL امضا شده
   */
  async getSignedUrl(
    fileUrl: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      // برای URL امضا شده باید از getSignedUrl استفاده کرد
      // اما در اینجا فایل‌ها public هستند پس همان URL اصلی را برمی‌گردانیم
      return fileUrl;
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * بررسی وجود فایل در S3
   * @param fileUrl URL فایل
   * @returns true اگر فایل وجود داشته باشد
   */
  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      this.logger.error('Error checking file existence:', error);
      throw new Error('Failed to check file existence');
    }
  }

  /**
   * دریافت اطلاعات فایل از S3
   * @param fileUrl URL فایل
   * @returns اطلاعات فایل
   */
  async getFileInfo(fileUrl: string): Promise<any> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error('Error getting file info:', error);
      throw new Error('Failed to get file info');
    }
  }
}
