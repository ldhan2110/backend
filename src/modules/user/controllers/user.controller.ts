import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto, UserQueryDto } from '../dtos/user.request.dto';
import { UserService } from '../services/user.service';

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  // GET /users?status=ACTIVE&keyword=al&sortBy=email&order=ASC&page=2&limit=20
  @Get()
  list(@Query() query: UserQueryDto) {
    return this.service.list(query); // { data: UserDto[], meta: {...} }
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() body: CreateUserDto) {
    // `by` would normally come from the authenticated user; hard-coded for the demo.
    return this.service.create(body, 'system');
  }

  @Patch(':id/email')
  changeEmail(@Param('id', ParseIntPipe) id: number, @Body('email') email: string) {
    return this.service.changeEmail(id, email, 'system');
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
