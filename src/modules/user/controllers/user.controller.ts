import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { UserQueryRequestDto } from '../dtos/user.request.dto';
import { UserService } from '../services/user.service';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get()
  list(@Query() query: UserQueryRequestDto) {
    return this.service.list(query);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
