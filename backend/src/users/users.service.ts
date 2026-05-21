import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async onModuleInit() {
    const count = await this.userModel.countDocuments();
    if (count === 0) {
      const password = this.generatePassword();
      const passwordHash = await bcrypt.hash(password, 12);
      await this.userModel.create({ username: 'admin', passwordHash, role: 'admin' });
      console.log('======================================================');
      console.log('  Admin password (first-boot only): ' + password);
      console.log('  Change this via Profile → Change Password in the UI.');
      console.log('======================================================');
    }
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 16; i++) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return pw;
  }
}

