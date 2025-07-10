import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AdService } from './ad.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { FilterAdDto } from './dto/filter-ad.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ads')
export class AdController {
  constructor(private readonly adService: AdService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 5)) // حداکثر 5 فایل
  create(
    @Body() createAdDto: CreateAdDto,
    @UploadedFiles() files: Express.Multer.File[],
    // در واقعیت باید userId از JWT token گرفته شود
    @Body('userId') userId: number,
  ) {
    return this.adService.create(createAdDto, userId, files);
  }

  @Get()
  findAll(@Query() filterDto: FilterAdDto) {
    return this.adService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateAdDto: UpdateAdDto) {
    return this.adService.update(+id, updateAdDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.adService.remove(+id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adService.updateStatus(+id, status as any);
  }
  @Patch(':id/featured')
  @UseGuards(JwtAuthGuard)
  makeFeatured(@Param('id') id: string, @Body('duration') duration?: number) {
    return this.adService.makeFeatured(+id, duration);
  }

  @Patch(':id/boost')
  @UseGuards(JwtAuthGuard)
  boost(@Param('id') id: string, @Body('duration') duration?: number) {
    return this.adService.boost(+id, duration);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  findByUser(@Param('userId') userId: string) {
    return this.adService.findByUser(+userId);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 5))
  uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.adService.uploadAdImages(+id, files);
  }
}
