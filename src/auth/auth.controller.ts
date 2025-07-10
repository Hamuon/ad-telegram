import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

export class TelegramAuthDto {
  telegramId: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async authenticateWithTelegram(@Body() authDto: TelegramAuthDto) {
    return this.authService.authenticateWithTelegram(
      authDto.telegramId,
      authDto.phoneNumber,
      authDto.firstName,
      authDto.lastName,
      authDto.username,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('verify')
  async verifyToken(@Body() body: { token: string }) {
    return this.authService.verifyToken(body.token);
  }
}
