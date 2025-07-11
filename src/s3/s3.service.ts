import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
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
  private readonly filebaseGateway: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_S3_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    if (
      !region ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucketName ||
      !endpoint
    ) {
      throw new Error(
        'Filebase configuration is incomplete. Please check your .env file.',
      );
    }

    this.s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      endpoint: endpoint,
    });
    this.bucketName = bucketName;
    this.filebaseGateway = 'https://ipfs.filebase.io/ipfs/';
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `/${uuidv4()}.${fileExtension}`;

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read-write',
        },
      });

      const result = await upload.done();
      // Log the result to inspect CID
      this.logger.log('Upload result:', JSON.stringify(result));
      // Verify with Filebase API docs how CID is returned
      const cid = result.$metadata.extendedRequestId;
      const fileUrl = `${this.filebaseGateway}${cid}`;

      this.logger.log(`File uploaded successfully: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      this.logger.error('Error uploading file to Filebase:', error);
      throw new Error('Failed to upload file to Filebase');
    }
  }

  async uploadMultipleFiles(files: Express.Multer.File[]): Promise<string[]> {
    try {
      if (files.length > 5) {
        throw new Error('Maximum 5 files allowed');
      }
      const uploadPromises = files.map((file) => this.uploadFile(file));
      const urls = await Promise.all(uploadPromises);

      this.logger.log(`${files.length} files uploaded successfully`);
      return urls;
    } catch (error) {
      this.logger.error('Error uploading multiple files to Filebase:', error);
      throw new Error('Failed to upload files to Filebase');
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.replace('/ipfs/', '');

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${fileUrl}`);
    } catch (error) {
      this.logger.error('Error deleting file from Filebase:', error);
      throw new Error('Failed to delete file from Filebase');
    }
  }

  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    try {
      const deletePromises = fileUrls.map((url) => this.deleteFile(url));
      await Promise.all(deletePromises);

      this.logger.log(`${fileUrls.length} files deleted successfully`);
    } catch (error) {
      this.logger.error('Error deleting multiple files from Filebase:', error);
      throw new Error('Failed to delete files from Filebase');
    }
  }

  async getSignedUrl(
    fileUrl: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      return fileUrl; // Filebase URLs are public
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.replace('/ipfs/', '');

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

  async getFileInfo(fileUrl: string): Promise<any> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.replace('/ipfs/', '');

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
