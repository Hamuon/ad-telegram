import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

export interface JwtPayload {
  sub: number;
  telegramId: string;
  phoneNumber: string;
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(telegramId: string): Promise<User | null> {
    const user = await this.userService.findByTelegramId(telegramId);

    if (user && !user.isBlocked) {
      return user;
    }

    return null;
  }

  async login(user: User): Promise<{ access_token: string; user: User }> {
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      phoneNumber: user.phoneNumber,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async authenticateWithTelegram(
    telegramId: string,
    phoneNumber?: string,
    firstName?: string,
    lastName?: string,
    username?: string,
  ): Promise<{ access_token: string; user: User }> {
    let user = await this.userService.findByTelegramId(telegramId);

    if (!user && phoneNumber) {
      // Create new user if doesn't exist and phone number is provided
      user = await this.userService.createOrUpdate(telegramId, {
        phoneNumber,
        firstName,
        lastName,
        username,
      });
    } else if (user) {
      // Update existing user info
      user = await this.userService.createOrUpdate(telegramId, {
        phoneNumber: phoneNumber || user.phoneNumber,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        username: username || user.username,
      });
    } else {
      throw new UnauthorizedException('Phone number is required for new users');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    return this.login(user);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
