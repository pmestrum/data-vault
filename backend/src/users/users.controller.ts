import { Body, Controller, Get, Patch, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req: any) {
    return { username: req.user.username, role: req.user.role };
  }

  @Patch('me/password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }
}

