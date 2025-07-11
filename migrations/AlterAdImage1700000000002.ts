import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAdImage1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ad_images" DROP COLUMN "size";
      ALTER TABLE "ad_images" DROP COLUMN "mimeType";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ad_images" ADD COLUMN "size" integer NOT NULL;
      ALTER TABLE "ad_images" ADD COLUMN "mimeType" character varying NOT NULL;
    `);
  }
}
