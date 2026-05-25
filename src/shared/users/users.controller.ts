import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ChangeUserPasswordDto } from './dto/change-user-password.dto';
import { CreateCompanyAdminUserDto } from './dto/create-company-admin-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Auth(Role.SUPER_ADMIN)
  @Post('company-admins')
  createCompanyAdmin(@Body() createUserDto: CreateCompanyAdminUserDto) {
    return this.usersService.createCompanyAdmin(createUserDto);
  }

  @Auth(Role.SUPER_ADMIN)
  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Auth()
  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user);
  }

  @Auth()
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateMyProfileDto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMe(user, updateMyProfileDto);
  }

  @Auth()
  @Patch('me/password')
  changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changeMyPasswordDto: ChangeMyPasswordDto,
  ) {
    return this.usersService.changeMyPassword(user, changeMyPasswordDto);
  }

  @Auth(Role.SUPER_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Auth(Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Auth(Role.SUPER_ADMIN)
  @Patch(':id/password')
  changePassword(
    @Param('id') id: string,
    @Body() changeUserPasswordDto: ChangeUserPasswordDto,
  ) {
    return this.usersService.changePassword(id, changeUserPasswordDto);
  }

  @Auth(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
