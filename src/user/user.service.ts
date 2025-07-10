import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { telegramId } });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { phoneNumber } });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async createOrUpdate(telegramId: string, userData: any): Promise<User> {
    const user = await this.userRepository.findOne({ where: { telegramId } });

    if (user) {
      // Update existing user
      Object.assign(user, userData);
      return await this.userRepository.save(user);
    } else {
      // Create new user
      const createUserDto: CreateUserDto = {
        telegramId,
        phoneNumber: userData.phoneNumber || '',
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
      };

      const newUser = this.userRepository.create(createUserDto);
      return await this.userRepository.save(newUser);
    }
  }

  async decrementFreeAdsCount(userId: number): Promise<User> {
    const user = await this.findOne(userId);
    if (user.freeAdsCount > 0) {
      user.freeAdsCount -= 1;
      return await this.userRepository.save(user);
    }
    return user;
  }

  async resetMonthlyFreeAds(): Promise<void> {
    await this.userRepository.update({}, { freeAdsCount: 1 });
  }

  async blockUser(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.isBlocked = true;
    return await this.userRepository.save(user);
  }

  async unblockUser(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.isBlocked = false;
    return await this.userRepository.save(user);
  }
}
